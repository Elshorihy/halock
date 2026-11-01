/**
 * HALOCK — Cloudflare Worker API.
 *
 * Security posture (spec §13):
 *  - Passwords: PBKDF2-SHA256, 150k iterations, random salt (never plain text).
 *  - Tokens: stored SHA-256 hashed; raw token returned once at login only.
 *  - Every data query is scoped by the authenticated user_id (isolation).
 *  - Rate limiting on auth + session-start endpoints (KV or in-memory).
 *  - No router credentials are ever accepted or stored by this API.
 *  - Security headers on every response; no secrets in responses or logs.
 */

import {
  completeFocusSession,
  createAuthSession,
  createUser,
  deleteAuthSession,
  deleteDomainRow,
  deleteTaskRow,
  deleteUserCascade,
  findAuthSession,
  findUserByEmail,
  findUserById,
  getActiveFocusSession,
  getRouterConfigRow,
  getSettingsRow,
  insertDomain,
  insertFocusSession,
  insertRouterLog,
  insertTask,
  listDomains,
  listFocusSessions,
  listRouterLogs,
  listTasks,
  saveRouterConfigRow,
  saveSettingsRow,
  updateDomainRow,
  updateTaskRow,
  type D1Like,
} from "./lib/repo";
import {
  generateSessionToken,
  hashPassword,
  newId,
  sha256Hex,
  verifyPassword,
} from "./lib/auth-crypto";
import { enforceRateLimit, type KvLike } from "./lib/rate-limit";
import {
  parseBlockingMode,
  parseCategory,
  parseDisplayName,
  parseDomainCategory,
  parseDueDate,
  parseDurationMinutes,
  parseEmail,
  parsePassword,
  parsePriority,
  parseSettings,
  parseTaskTitle,
  sanitizeText,
  isValidId,
  DEFAULT_SETTINGS,
} from "../shared/validation";
import { parseDomainInput, findDuplicate, parseImportedDomains } from "../shared/domains";
import { completeSession as completeSessionRule, planBlocking, canStartSession } from "../shared/session-logic";
import { computeStats, filterSessionsByRange } from "../shared/stats";
import type {
  FocusSession,
  RouterConfiguration,
  RouterLog,
  StatsRange,
  Task,
  User,
  UserSettings,
} from "../shared/types";

interface Env {
  DB: D1Like;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  RATE_LIMIT?: KvLike;
  ALLOWED_ORIGIN?: string;
  SESSION_TTL_DAYS?: string;
  SESSION_SECRET?: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

function error(message: string, status = 400, extra: Record<string, string> = {}): Response {
  return json({ error: message }, status, extra);
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function hashToken(token: string, secret?: string): string {
  return sha256Hex(secret ? `${secret}:${token}` : token);
}

interface AuthContext {
  userId: string;
  user: User;
}

async function authenticate(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length < 32 || token.length > 128) return null;
  const record = await findAuthSession(env.DB, hashToken(token, env.SESSION_SECRET), new Date().toISOString());
  if (!record) return null;
  const row = await findUserById(env.DB, record.user_id);
  if (!row) return null;
  return {
    userId: row.id,
    user: { id: row.id, displayName: row.display_name, createdAt: row.created_at, mode: "remote" },
  };
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  // ----- public endpoints -----
  if (path === "/health" && method === "GET") {
    return json({ ok: true, service: "halock-api", time: Date.now() });
  }

  if (path === "/time" && method === "GET") {
    return json({ now: Date.now() });
  }

  if (path === "/auth/guest" && method === "POST") {
    // Passwordless guest profile: a random bearer token is stored in the browser.
    // This removes the login UI without exposing one shared public user account.
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rl = await enforceRateLimit(env.RATE_LIMIT, `guest:${ip}`, Date.now(), {
      limit: 20,
      windowSeconds: 300,
    });
    if (!rl.allowed) return error("طلبات كثيرة — حاول بعد قليل", 429, { "Retry-After": String(rl.retryAfterSeconds) });

    const id = newId("guest");
    const displayName = "مستخدم HALOCK";
    const email = `${id}@guest.halock.invalid`;
    const passwordHash = await hashPassword(crypto.randomUUID());
    const user = await createUser(env.DB, { id, email, displayName, passwordHash });
    const { token } = generateSessionToken();
    const ttlDays = Number(env.SESSION_TTL_DAYS ?? 3650);
    await createAuthSession(env.DB, {
      id: newId("sess"),
      userId: id,
      tokenHash: hashToken(token, env.SESSION_SECRET),
      expiresAt: new Date(Date.now() + ttlDays * 86400_000).toISOString(),
    });
    await saveSettingsRow(env.DB, id, DEFAULT_SETTINGS);
    return json({
      user: { id, displayName, createdAt: new Date().toISOString(), mode: "remote" } satisfies User,
      token,
    }, 201);
  }

  if (path === "/auth/register" && method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rl = await enforceRateLimit(env.RATE_LIMIT, `register:${ip}`, Date.now(), {
      limit: 5,
      windowSeconds: 300,
    });
    if (!rl.allowed) return error("محاولات كثيرة — حاول لاحقًا", 429, { "Retry-After": String(rl.retryAfterSeconds) });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = parseDisplayName(body.displayName);
    const email = parseEmail(body.email);
    const password = parsePassword(body.password);
    if (!name.ok) return error(name.error);
    if (!email.ok) return error(email.error);
    if (!password.ok) return error(password.error);

    const existing = await findUserByEmail(env.DB, email.value);
    if (existing) return error("البريد الإلكتروني مسجّل بالفعل", 409);

    const id = newId("user");
    const passwordHash = await hashPassword(password.value);
    const user = await createUser(env.DB, {
      id,
      email: email.value,
      displayName: name.value,
      passwordHash,
    });

    const { token, tokenHash } = generateSessionToken();
    const ttlDays = Number(env.SESSION_TTL_DAYS ?? 30);
    await createAuthSession(env.DB, {
      id: newId("sess"),
      userId: id,
      tokenHash: hashToken(token, env.SESSION_SECRET),
      expiresAt: new Date(Date.now() + ttlDays * 86400_000).toISOString(),
    });
    await saveSettingsRow(env.DB, id, DEFAULT_SETTINGS);
    return json({ user, token }, 201);
  }

  if (path === "/auth/login" && method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rl = await enforceRateLimit(env.RATE_LIMIT, `login:${ip}`, Date.now(), {
      limit: 5,
      windowSeconds: 300,
    });
    if (!rl.allowed) return error("محاولات كثيرة — حاول لاحقًا", 429, { "Retry-After": String(rl.retryAfterSeconds) });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = parseEmail(body.email);
    const password = parsePassword(body.password);
    if (!email.ok || !password.ok) return error("بيانات غير صالحة", 401);

    const row = await findUserByEmail(env.DB, email.value);
    // Constant-ish work on both paths would be ideal; verifyPassword is fast-fail on
    // malformed rows, so we only hash-compare when a user exists.
    const ok = row ? await verifyPassword(password.value, row.password_hash) : false;
    if (!row || !ok) return error("بيانات الدخول غير صحيحة", 401);

    const { token, tokenHash } = generateSessionToken();
    const ttlDays = Number(env.SESSION_TTL_DAYS ?? 30);
    await createAuthSession(env.DB, {
      id: newId("sess"),
      userId: row.id,
      tokenHash: hashToken(token, env.SESSION_SECRET),
      expiresAt: new Date(Date.now() + ttlDays * 86400_000).toISOString(),
    });
    return json({
      user: { id: row.id, displayName: row.display_name, createdAt: row.created_at, mode: "remote" } satisfies User,
      token,
    });
  }

  // ----- authenticated endpoints -----
  const auth = await authenticate(request, env);
  if (!auth) return error("غير مصرّح — سجّل الدخول", 401);
  const userId = auth.userId;

  if (path === "/auth/logout" && method === "POST") {
    const header = request.headers.get("Authorization") ?? "";
    const token = header.slice(7).trim();
    await deleteAuthSession(env.DB, hashToken(token, env.SESSION_SECRET));
    return json({ ok: true });
  }

  if (path === "/me" && method === "GET") {
    return json({ user: auth.user });
  }

  if (path === "/me" && method === "DELETE") {
    await deleteUserCascade(env.DB, userId);
    return json({ ok: true });
  }

  // ----- focus sessions -----
  if (path === "/sessions" && method === "GET") {
    return json({ sessions: await listFocusSessions(env.DB, userId) });
  }

  if (path === "/sessions/active" && method === "GET") {
    return json({ session: await getActiveFocusSession(env.DB, userId) });
  }

  if (path === "/sessions" && method === "POST") {
    const rl = await enforceRateLimit(env.RATE_LIMIT, `session:${userId}`, Date.now(), {
      limit: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) return error("محاولات كثيرة — حاول لاحقًا", 429, { "Retry-After": String(rl.retryAfterSeconds) });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const duration = parseDurationMinutes(Math.round(Number(body.durationSeconds ?? 0) / 60));
    const blockingMode = parseBlockingMode(body.blockingMode ?? "blacklist");
    if (!blockingMode.ok) return error(blockingMode.error);

    const active = await getActiveFocusSession(env.DB, userId);
    const startCheck = canStartSession(active ? [active] : []);
    if (!startCheck.ok) return error(startCheck.message ?? "جلسة نشطة موجودة", 409);

    const durationSeconds = Number(body.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 180 * 60) {
      return error("المدة يجب أن تكون بين 1 و180 دقيقة");
    }

    const blockedDomainsRaw = Array.isArray(body.blockedDomains) ? body.blockedDomains : [];
    const blockedDomains = [...new Set(blockedDomainsRaw.map((d) => String(d).toLowerCase().trim()).filter(Boolean))].slice(0, 500);

    const routerMode =
      body.routerMode === "manual" || body.routerMode === "automatic" ? body.routerMode : "none";
    const blocking = planBlocking({
      durationMinutes: Math.round(durationSeconds / 60),
      blockedDomains,
      blockingMode: blockingMode.value,
      routerMode,
      automaticBlockingAvailable: false,
    });

    const now = Date.now();
    const session: FocusSession = {
      id: newId("focus"),
      userId,
      taskId: typeof body.taskId === "string" && isValidId(body.taskId) ? body.taskId : null,
      taskTitle: sanitizeText(body.taskTitle ?? "", 160) || null,
      startTime: new Date(now).toISOString(),
      endTime: new Date(now + durationSeconds * 1000).toISOString(),
      durationSeconds,
      status: "active",
      blockedDomains: blocking.domains,
      blockingMode: blockingMode.value,
      blockingStatus: blocking.blockingStatus,
      routerMode,
      note: blocking.note,
    };
    await insertFocusSession(env.DB, session);
    return json({ session }, 201);
  }

  const completeMatch = /^\/sessions\/([a-zA-Z0-9_-]+)\/complete$/.exec(path);
  if (completeMatch && method === "POST") {
    const sessionId = completeMatch[1];
    if (!isValidId(sessionId)) return error("معرف غير صالح");
    const active = await getActiveFocusSession(env.DB, userId);
    if (!active || active.id !== sessionId) {
      // Either already completed (idempotence) or belongs to someone else (isolation).
      const sessions = await listFocusSessions(env.DB, userId);
      const target = sessions.find((s) => s.id === sessionId);
      if (target && target.status === "completed") return error("الجلسة محفوظة بالفعل", 409);
      return error("الجلسة غير موجودة", 404);
    }

    // Server-side completion check using SERVER time (device clock cannot cheat).
    const result = completeSessionRule({
      session: active,
      now: Date.now(),
      serverVerified: true,
    });
    if (!result.ok) {
      if (result.reason === "already-completed") return error("الجلسة محفوظة بالفعل", 409);
      return error("لم تنتهِ مدة الجلسة بعد", 400);
    }

    const updated = await completeFocusSession(env.DB, userId, sessionId, result.record!.endTime);
    if (!updated.changed) return error("الجلسة محفوظة بالفعل", 409);
    return json({ session: updated.session });
  }

  // ----- tasks -----
  if (path === "/tasks" && method === "GET") {
    return json({ tasks: await listTasks(env.DB, userId) });
  }

  if (path === "/tasks" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = parseTaskTitle(body.title);
    const category = parseCategory(body.category);
    const priority = parsePriority(body.priority);
    const dueDate = parseDueDate(body.dueDate);
    if (!title.ok) return error(title.error);
    if (!category.ok) return error(category.error);
    if (!priority.ok) return error(priority.error);
    if (!dueDate.ok) return error(dueDate.error);

    const task: Task = {
      id: newId("task"),
      userId,
      title: title.value,
      category: category.value,
      priority: priority.value,
      completed: false,
      dueDate: dueDate.value,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await insertTask(env.DB, task);
    return json({ task }, 201);
  }

  const taskMatch = /^\/tasks\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (taskMatch && method === "PUT") {
    const taskId = taskMatch[1];
    if (!isValidId(taskId)) return error("معرف غير صالح");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Partial<Task> = {};
    if (body.title !== undefined) {
      const title = parseTaskTitle(body.title);
      if (!title.ok) return error(title.error);
      patch.title = title.value;
    }
    if (body.category !== undefined) {
      const category = parseCategory(body.category);
      if (!category.ok) return error(category.error);
      patch.category = category.value;
    }
    if (body.priority !== undefined) {
      const priority = parsePriority(body.priority);
      if (!priority.ok) return error(priority.error);
      patch.priority = priority.value;
    }
    if (body.dueDate !== undefined) {
      const dueDate = parseDueDate(body.dueDate);
      if (!dueDate.ok) return error(dueDate.error);
      patch.dueDate = dueDate.value;
    }
    if (body.completed !== undefined) {
      patch.completed = body.completed === true;
      patch.completedAt = patch.completed ? new Date().toISOString() : null;
    }
    const updated = await updateTaskRow(env.DB, userId, taskId, patch);
    if (!updated) return error("المهمة غير موجودة", 404);
    return json({ task: updated });
  }

  if (taskMatch && method === "DELETE") {
    const deleted = await deleteTaskRow(env.DB, userId, taskMatch[1]);
    if (!deleted) return error("المهمة غير موجودة", 404);
    return json({ ok: true });
  }

  // ----- blocked domains -----
  if (path === "/domains" && method === "GET") {
    return json({ domains: await listDomains(env.DB, userId) });
  }

  if (path === "/domains" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseDomainInput(String(body.domain ?? ""));
    const category = parseDomainCategory(body.category ?? "other");
    if (!parsed.ok || !parsed.domain) return error(parsed.message ?? "نطاق غير صالح");
    if (!category.ok) return error(category.error);

    const existing = await listDomains(env.DB, userId);
    if (findDuplicate(parsed.domain, existing)) return error("هذا الموقع مضاف بالفعل", 409);

    const domain = {
      id: newId("dom"),
      userId,
      domain: parsed.domain,
      category: category.value,
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString(),
    };
    await insertDomain(env.DB, domain);
    return json({ domain }, 201);
  }

  const domainMatch = /^\/domains\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (domainMatch && method === "PUT") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: { domain?: string; category?: import("../shared/types").DomainCategory; enabled?: boolean } = {};
    if (body.domain !== undefined) {
      const parsed = parseDomainInput(String(body.domain));
      if (!parsed.ok || !parsed.domain) return error(parsed.message ?? "نطاق غير صالح");
      patch.domain = parsed.domain;
    }
    if (body.category !== undefined) {
      const category = parseDomainCategory(body.category);
      if (!category.ok) return error(category.error);
      patch.category = category.value;
    }
    if (body.enabled !== undefined) patch.enabled = body.enabled === true;

    const updated = await updateDomainRow(env.DB, userId, domainMatch[1], patch);
    if (!updated) return error("الموقع غير موجود", 404);
    return json({ domain: updated });
  }

  if (domainMatch && method === "DELETE") {
    const deleted = await deleteDomainRow(env.DB, userId, domainMatch[1]);
    if (!deleted) return error("الموقع غير موجود", 404);
    return json({ ok: true });
  }

  if (path === "/domains/import" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { entries?: unknown };
    const result = parseImportedDomains(body.entries ?? body);
    if (!result.ok) return error("قائمة غير صالحة", 400, {});
    const existing = await listDomains(env.DB, userId);
    let added = 0;
    let skipped = 0;
    for (const entry of result.entries) {
      if (findDuplicate(entry.domain, existing)) {
        skipped += 1;
        continue;
      }
      const domain = {
        id: newId("dom"),
        userId,
        domain: entry.domain,
        category: entry.category,
        enabled: entry.enabled,
        createdAt: new Date().toISOString(),
      };
      await insertDomain(env.DB, domain);
      existing.push(domain);
      added += 1;
    }
    return json({ added, skipped, errors: result.errors });
  }

  // ----- settings -----
  if (path === "/settings" && method === "GET") {
    const settings = (await getSettingsRow(env.DB, userId)) ?? DEFAULT_SETTINGS;
    return json({ settings });
  }

  if (path === "/settings" && method === "PUT") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseSettings(body);
    if (!parsed.ok) return error("إعدادات غير صالحة");
    await saveSettingsRow(env.DB, userId, parsed.value);
    return json({ settings: parsed.value });
  }

  // ----- router (configuration + logs only; credentials are never accepted) -----
  if (path === "/router/settings" && method === "GET") {
    const config =
      (await getRouterConfigRow(env.DB, userId)) ??
      ({
        id: newId("router"),
        userId,
        provider: "manual",
        integrationMode: "none",
        targetDevice: null,
        status: "disconnected",
        routerUrl: null,
        manualSteps: {},
        updatedAt: new Date(0).toISOString(),
      } satisfies RouterConfiguration);
    return json({ config });
  }

  if (path === "/router/settings" && method === "PUT") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const current = (await getRouterConfigRow(env.DB, userId)) ?? {
      id: newId("router"),
      userId,
      provider: "manual",
      integrationMode: "none",
      targetDevice: null,
      status: "disconnected",
      routerUrl: null,
      manualSteps: {},
      updatedAt: new Date(0).toISOString(),
    } as RouterConfiguration;

    const provider = body.provider === "automatic" ? "automatic" : "manual";
    const integrationMode =
      body.integrationMode === "manual" || body.integrationMode === "automatic"
        ? body.integrationMode
        : "none";
    const targetDevice = sanitizeText(body.targetDevice ?? "", 120) || null;
    const routerUrl = sanitizeText(body.routerUrl ?? "", 300) || null;
    const manualSteps: Record<string, boolean> = {};
    if (body.manualSteps && typeof body.manualSteps === "object") {
      for (const [key, value] of Object.entries(body.manualSteps as Record<string, unknown>)) {
        if (/^s\d{1,2}$/.test(key)) manualSteps[key] = value === true;
      }
    }

    const config: RouterConfiguration = {
      ...current,
      provider,
      integrationMode,
      targetDevice,
      routerUrl,
      manualSteps,
      status: Object.values(manualSteps).filter(Boolean).length >= 10 ? "manual-configured" : "manual-incomplete",
      updatedAt: new Date().toISOString(),
    };
    await saveRouterConfigRow(env.DB, userId, config);
    return json({ config });
  }

  if (path === "/router/logs" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return json({ logs: await listRouterLogs(env.DB, userId, limit) });
  }

  if (path === "/router/logs" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const log: RouterLog = {
      id: newId("rlog"),
      userId,
      action: sanitizeText(body.action ?? "", 60) || "unknown",
      result: sanitizeText(body.result ?? "", 40) || "unknown",
      message: sanitizeText(body.message ?? "", 300),
      device: sanitizeText(body.device ?? "", 120) || null,
      createdAt: new Date().toISOString(),
    };
    await insertRouterLog(env.DB, log);
    return json({ log }, 201);
  }

  // ----- statistics & export -----
  if (path === "/stats" && method === "GET") {
    const rangeParam = url.searchParams.get("range") ?? "7d";
    const range: StatsRange = rangeParam === "day" || rangeParam === "30d" ? rangeParam : "7d";
    const [sessions, tasks] = await Promise.all([listFocusSessions(env.DB, userId), listTasks(env.DB, userId)]);
    return json({ stats: computeStats(sessions, tasks, Date.now(), range) });
  }

  if (path === "/sessions/history" && method === "GET") {
    const rangeParam = url.searchParams.get("range") ?? "7d";
    const range: StatsRange = rangeParam === "day" || rangeParam === "30d" ? rangeParam : "7d";
    const sessions = await listFocusSessions(env.DB, userId);
    return json({ sessions: filterSessionsByRange(sessions, range, Date.now()) });
  }

  if (path === "/export" && method === "GET") {
    const [sessions, tasks, domains, settings, logs] = await Promise.all([
      listFocusSessions(env.DB, userId),
      listTasks(env.DB, userId),
      listDomains(env.DB, userId),
      getSettingsRow(env.DB, userId),
      listRouterLogs(env.DB, userId, 200),
    ]);
    return json({
      data: JSON.stringify(
        {
          product: "HALOCK",
          exportedAt: new Date().toISOString(),
          user: auth.user,
          settings: settings ?? DEFAULT_SETTINGS,
          sessions,
          tasks,
          domains,
          routerLogs: logs,
        },
        null,
        2,
      ),
    });
  }

  return error("المسار غير موجود", 404);
}

export default {
  async fetch(request: Request, env: Env, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) {
        const response = await handleApi(request, env, url);
        // Attach CORS + cache headers to API responses.
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(corsHeaders(env))) headers.set(k, v);
        headers.set("Cache-Control", "no-store");
        return new Response(response.body, { status: response.status, headers });
      }

      // Static assets / SPA fallback.
      return env.ASSETS.fetch(request);
    } catch (err) {
      // Never leak internals to clients.
      console.error("HALOCK worker error:", err instanceof Error ? err.message : err);
      return error("خطأ داخلي في الخادم", 500);
    }
  },
};
