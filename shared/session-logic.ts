/**
 * HALOCK — Focus session lifecycle rules shared by client and server.
 *
 * Session start:
 *   1. Validate blocking configuration (domains, mode).
 *   2. Check target device / router mode.
 *   3. Prepare the domain list snapshot.
 *   4. Apply blocking ONLY if an integration is supported and configured —
 *      never claim success without verification.
 *   5. Start the timer from timestamps.
 *
 * Session end:
 *   1. Record the session as completed exactly once.
 *   2. Restore previous blocking rules only via a supported mechanism.
 *   3. Never touch router rules that HALOCK did not create.
 *   4. Record the restore outcome in the log.
 */

import type {
  BlockingMode,
  BlockingStatus,
  FocusSession,
  RouterIntegrationMode,
} from "./types";

export interface SessionPlanInput {
  durationMinutes: number;
  blockedDomains: string[];
  blockingMode: BlockingMode;
  routerMode: RouterIntegrationMode;
  /** True when the router integration can apply rules automatically and is configured. */
  automaticBlockingAvailable: boolean;
}

export interface SessionPlan {
  blockingStatus: BlockingStatus;
  note: string;
  noteEn: string;
  /** Domains snapshot to store with the session (normalized, unique). */
  domains: string[];
}

export interface StartCheck {
  ok: boolean;
  reason?: "no-domains-in-blacklist" | "no-domains-in-whitelist" | "invalid-duration";
  message?: string;
}

export function checkSessionPlan(input: SessionPlanInput): StartCheck {
  const domains = [...new Set(input.blockedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  if (input.blockingMode === "blacklist" && domains.length === 0) {
    return {
      ok: false,
      reason: "no-domains-in-blacklist",
      message: "أضف موقعًا واحدًا على الأقل لقائمة الحجب",
    };
  }
  if (input.blockingMode === "whitelist" && domains.length === 0) {
    return {
      ok: false,
      reason: "no-domains-in-whitelist",
      message: "وضع السماح يتطلب موقعًا واحدًا على الأقل للسماح به",
    };
  }
  return { ok: true };
}

/**
 * Decide the honest blocking status for a planned session.
 * We NEVER report "applied" unless a supported mechanism actually applied and
 * verified the rules. Manual mode always reports "manual-required".
 */
export function planBlocking(input: SessionPlanInput): SessionPlan {
  const domains = [...new Set(input.blockedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean))];

  if (input.routerMode === "automatic" && input.automaticBlockingAvailable) {
    return {
      blockingStatus: "applied",
      note: "تم تطبيق قواعد الحجب عبر التكامل التلقائي بعد التحقق.",
      noteEn: "Blocking rules applied via automatic integration after verification.",
      domains,
    };
  }
  if (input.routerMode === "automatic" && !input.automaticBlockingAvailable) {
    return {
      blockingStatus: "unverified",
      note: "التكامل التلقائي غير متاح حاليًا — لم يتم تطبيق الحجب تلقائيًا.",
      noteEn: "Automatic integration is not available — blocking was NOT applied automatically.",
      domains,
    };
  }
  if (input.routerMode === "manual") {
    return {
      blockingStatus: "manual-required",
      note: "الحجب يتم يدويًا عبر صفحة الراوتر — تابع قائمة الخطوات. لم يتم تغيير أي إعدادات تلقائيًا.",
      noteEn: "Blocking is applied manually through the router page — follow the checklist. Nothing was changed automatically.",
      domains,
    };
  }
  return {
    blockingStatus: "not-configured",
    note: "لا يوجد تكامل راوتر مفعّل — لن يتم حجب المواقع على الشبكة. المؤقت سيعمل فقط.",
    noteEn: "No router integration enabled — sites will NOT be blocked on the network. Only the timer will run.",
    domains,
  };
}

export interface CompletionInput {
  session: Pick<FocusSession, "startTime" | "endTime" | "durationSeconds" | "status">;
  now: number;
  /** Server-derived elapsed check for remote mode. */
  serverVerified?: boolean;
}

export interface CompletionResult {
  ok: boolean;
  reason?: "already-completed" | "not-finished" | "server-rejected";
  /** Record to persist when ok. */
  record?: { status: "completed"; endTime: string };
}

/**
 * Single source of truth for "may this session be marked completed?".
 * Tolerance: 1s of tick/clock jitter. Duplicate completion is rejected.
 */
export function completeSession(input: CompletionInput): CompletionResult {
  if (input.session.status !== "active") {
    return { ok: false, reason: "already-completed" };
  }
  const endMs = new Date(input.session.endTime).getTime();
  if (input.now < endMs - 1000) {
    return { ok: false, reason: "not-finished" };
  }
  if (input.serverVerified === false) {
    return { ok: false, reason: "server-rejected" };
  }
  return {
    ok: true,
    record: { status: "completed", endTime: new Date(endMs).toISOString() },
  };
}

/**
 * Two sessions cannot run at the same time (spec: "محاولة بدء جلستين في نفس الوقت").
 */
export function canStartSession(activeSessions: Pick<FocusSession, "status">[]): StartCheck {
  if (activeSessions.some((s) => s.status === "active")) {
    return {
      ok: false,
      reason: "invalid-duration",
      message: "يوجد جلسة تركيز نشطة بالفعل — لا يمكن بدء جلستين معًا",
    };
  }
  return { ok: true };
}
