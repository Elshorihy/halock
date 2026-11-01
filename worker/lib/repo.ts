/**
 * HALOCK — Worker data-access layer (D1).
 *
 * Every function is scoped by userId: cross-user access is impossible because
 * every SELECT/UPDATE/DELETE carries `user_id = ?`. Tests verify this isolation.
 *
 * The D1Like interface matches Cloudflare's D1 prepared-statement API surface
 * used here, so tests can run against a small in-memory fake.
 */

import type {
  BlockedDomain,
  DomainCategory,
  FocusSession,
  RouterConfiguration,
  RouterLog,
  Task,
  TaskPriority,
  User,
  UserSettings,
} from "../../shared/types";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}

export interface D1Like {
  prepare(sql: string): D1PreparedStatementLike;
}

/* ------------------------------- users ------------------------------- */

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

export async function createUser(
  db: D1Like,
  input: { id: string; email: string; displayName: string; passwordHash: string },
): Promise<User> {
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(input.id, input.email, input.displayName, input.passwordHash, now)
    .run();
  return { id: input.id, displayName: input.displayName, createdAt: now, mode: "remote" };
}

export async function findUserByEmail(db: D1Like, email: string): Promise<(UserRow & { password_hash: string }) | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
}

export async function findUserById(db: D1Like, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function deleteUserCascade(db: D1Like, userId: string): Promise<void> {
  // Order matters only for readability; each statement is user-scoped.
  await db.prepare("DELETE FROM router_logs WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM router_settings WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM user_settings WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM blocked_domains WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM focus_sessions WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM tasks WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(userId).run();
  await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}

/* --------------------------- auth sessions --------------------------- */

export async function createAuthSession(
  db: D1Like,
  input: { id: string; userId: string; tokenHash: string; expiresAt: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(input.id, input.userId, input.tokenHash, input.expiresAt)
    .run();
}

export async function findAuthSession(
  db: D1Like,
  tokenHash: string,
  nowIso: string,
): Promise<{ user_id: string } | null> {
  return db
    .prepare("SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, nowIso)
    .first<{ user_id: string }>();
}

export async function deleteAuthSession(db: D1Like, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

/* ---------------------------- focus sessions ------------------------- */

interface FocusSessionRow {
  id: string;
  user_id: string;
  task_id: string | null;
  task_title: string | null;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  status: string;
  blocked_domains: string;
  blocking_mode: string;
  blocking_status: string;
  router_mode: string;
  note: string | null;
}

function rowToSession(row: FocusSessionRow): FocusSession {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    startTime: row.start_time,
    endTime: row.end_time,
    durationSeconds: row.duration_seconds,
    status: row.status as FocusSession["status"],
    blockedDomains: JSON.parse(row.blocked_domains || "[]"),
    blockingMode: row.blocking_mode as FocusSession["blockingMode"],
    blockingStatus: row.blocking_status as FocusSession["blockingStatus"],
    routerMode: row.router_mode as FocusSession["routerMode"],
    note: row.note,
  };
}

export async function insertFocusSession(db: D1Like, session: FocusSession): Promise<void> {
  await db
    .prepare(
      `INSERT INTO focus_sessions
       (id, user_id, task_id, task_title, start_time, end_time, duration_seconds, status,
        blocked_domains, blocking_mode, blocking_status, router_mode, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      session.id,
      session.userId,
      session.taskId,
      session.taskTitle,
      session.startTime,
      session.endTime,
      session.durationSeconds,
      session.status,
      JSON.stringify(session.blockedDomains),
      session.blockingMode,
      session.blockingStatus,
      session.routerMode,
      session.note ?? null,
    )
    .run();
}

export async function listFocusSessions(db: D1Like, userId: string): Promise<FocusSession[]> {
  const { results } = await db
    .prepare("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time DESC")
    .bind(userId)
    .all<FocusSessionRow>();
  return results.map(rowToSession);
}

export async function getActiveFocusSession(db: D1Like, userId: string): Promise<FocusSession | null> {
  const row = await db
    .prepare("SELECT * FROM focus_sessions WHERE user_id = ? AND status = 'active' LIMIT 1")
    .bind(userId)
    .first<FocusSessionRow>();
  return row ? rowToSession(row) : null;
}

/**
 * Idempotent completion: the UPDATE only matches an ACTIVE session belonging to
 * this user. A second call updates 0 rows → the caller reports "already completed".
 */
export async function completeFocusSession(
  db: D1Like,
  userId: string,
  sessionId: string,
  endTimeIso: string,
): Promise<{ changed: boolean; session: FocusSession | null }> {
  const result = await db
    .prepare(
      `UPDATE focus_sessions SET status = 'completed', end_time = ?
       WHERE id = ? AND user_id = ? AND status = 'active'`,
    )
    .bind(endTimeIso, sessionId, userId)
    .run();
  const changed = (result.meta?.changes ?? 0) > 0;
  const row = await db
    .prepare("SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, userId)
    .first<FocusSessionRow>();
  return { changed, session: row ? rowToSession(row) : null };
}

/* -------------------------------- tasks ------------------------------ */

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  category: string;
  priority: string;
  completed: number;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    priority: row.priority as TaskPriority,
    completed: row.completed === 1,
    dueDate: row.due_date,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function insertTask(db: D1Like, task: Task): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tasks (id, user_id, title, category, priority, completed, due_date, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      task.id,
      task.userId,
      task.title,
      task.category,
      task.priority,
      task.completed ? 1 : 0,
      task.dueDate,
      task.createdAt,
      task.completedAt,
    )
    .run();
}

export async function listTasks(db: D1Like, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<TaskRow>();
  return results.map(rowToTask);
}

export async function updateTaskRow(
  db: D1Like,
  userId: string,
  taskId: string,
  patch: Partial<Task>,
): Promise<Task | null> {
  const existing = await db
    .prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
    .bind(taskId, userId)
    .first<TaskRow>();
  if (!existing) return null;

  const merged: Task = { ...rowToTask(existing), ...patch };
  if (patch.completed === true && !merged.completedAt) merged.completedAt = new Date().toISOString();
  if (patch.completed === false) merged.completedAt = null;

  await db
    .prepare(
      `UPDATE tasks SET title = ?, category = ?, priority = ?, completed = ?, due_date = ?, completed_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(
      merged.title,
      merged.category,
      merged.priority,
      merged.completed ? 1 : 0,
      merged.dueDate,
      merged.completedAt,
      taskId,
      userId,
    )
    .run();
  return merged;
}

export async function deleteTaskRow(db: D1Like, userId: string, taskId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
    .bind(taskId, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/* ------------------------------ domains ------------------------------ */

interface DomainRow {
  id: string;
  user_id: string;
  domain: string;
  category: string;
  enabled: number;
  created_at: string;
}

function rowToDomain(row: DomainRow): BlockedDomain {
  return {
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    category: row.category as DomainCategory,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export async function insertDomain(db: D1Like, domain: BlockedDomain): Promise<void> {
  await db
    .prepare(
      "INSERT INTO blocked_domains (id, user_id, domain, category, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(domain.id, domain.userId, domain.domain, domain.category, domain.enabled ? 1 : 0, domain.createdAt)
    .run();
}

export async function listDomains(db: D1Like, userId: string): Promise<BlockedDomain[]> {
  const { results } = await db
    .prepare("SELECT * FROM blocked_domains WHERE user_id = ? ORDER BY created_at ASC")
    .bind(userId)
    .all<DomainRow>();
  return results.map(rowToDomain);
}

export async function updateDomainRow(
  db: D1Like,
  userId: string,
  domainId: string,
  patch: Partial<BlockedDomain>,
): Promise<BlockedDomain | null> {
  const existing = await db
    .prepare("SELECT * FROM blocked_domains WHERE id = ? AND user_id = ?")
    .bind(domainId, userId)
    .first<DomainRow>();
  if (!existing) return null;
  const merged = rowToDomain({ ...existing, ...(patch as Partial<DomainRow>) });
  await db
    .prepare("UPDATE blocked_domains SET domain = ?, category = ?, enabled = ? WHERE id = ? AND user_id = ?")
    .bind(merged.domain, merged.category, merged.enabled ? 1 : 0, domainId, userId)
    .run();
  return merged;
}

export async function deleteDomainRow(db: D1Like, userId: string, domainId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM blocked_domains WHERE id = ? AND user_id = ?")
    .bind(domainId, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/* ------------------------------ settings ----------------------------- */

export async function getSettingsRow(db: D1Like, userId: string): Promise<UserSettings | null> {
  const row = await db
    .prepare("SELECT settings_json FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ settings_json: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.settings_json) as UserSettings;
  } catch {
    return null;
  }
}

export async function saveSettingsRow(db: D1Like, userId: string, settings: UserSettings): Promise<void> {
  const json = JSON.stringify(settings);
  const existing = await db
    .prepare("SELECT user_id FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ user_id: string }>();
  if (existing) {
    await db
      .prepare("UPDATE user_settings SET settings_json = ? WHERE user_id = ?")
      .bind(json, userId)
      .run();
  } else {
    await db
      .prepare("INSERT INTO user_settings (user_id, settings_json) VALUES (?, ?)")
      .bind(userId, json)
      .run();
  }
}

/* --------------------------- router settings ------------------------- */

export async function getRouterConfigRow(db: D1Like, userId: string): Promise<RouterConfiguration | null> {
  const row = await db
    .prepare("SELECT * FROM router_settings WHERE user_id = ?")
    .bind(userId)
    .first<{
      id: string;
      user_id: string;
      provider: string;
      integration_mode: string;
      target_device: string | null;
      status: string;
      router_url: string | null;
      manual_steps: string;
      updated_at: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as RouterConfiguration["provider"],
    integrationMode: row.integration_mode as RouterConfiguration["integrationMode"],
    targetDevice: row.target_device,
    status: row.status as RouterConfiguration["status"],
    routerUrl: row.router_url,
    manualSteps: JSON.parse(row.manual_steps || "{}"),
    updatedAt: row.updated_at,
  };
}

export async function saveRouterConfigRow(db: D1Like, userId: string, config: RouterConfiguration): Promise<void> {
  const existing = await db
    .prepare("SELECT user_id FROM router_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ user_id: string }>();
  const values = [
    config.provider,
    config.integrationMode,
    config.targetDevice,
    config.status,
    config.routerUrl,
    JSON.stringify(config.manualSteps ?? {}),
    config.updatedAt,
    userId,
  ];
  if (existing) {
    await db
      .prepare(
        `UPDATE router_settings SET provider = ?, integration_mode = ?, target_device = ?, status = ?,
         router_url = ?, manual_steps = ?, updated_at = ? WHERE user_id = ?`,
      )
      .bind(...values)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO router_settings (id, user_id, provider, integration_mode, target_device, status, router_url, manual_steps, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(config.id, ...values)
      .run();
  }
}

/* ------------------------------ router logs -------------------------- */

export async function insertRouterLog(db: D1Like, log: RouterLog): Promise<void> {
  await db
    .prepare(
      "INSERT INTO router_logs (id, user_id, action, result, message, device, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(log.id, log.userId, log.action, log.result, log.message, log.device, log.createdAt)
    .run();
}

export async function listRouterLogs(db: D1Like, userId: string, limit = 50): Promise<RouterLog[]> {
  const { results } = await db
    .prepare("SELECT * FROM router_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(userId, Math.min(200, Math.max(1, limit)))
    .all<{
      id: string;
      user_id: string;
      action: string;
      result: string;
      message: string;
      device: string | null;
      created_at: string;
    }>();
  return results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    action: row.action,
    result: row.result,
    message: row.message,
    device: row.device,
    createdAt: row.created_at,
  }));
}
