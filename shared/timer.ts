/**
 * HALOCK — Timer engine.
 *
 * Design rules (from product spec):
 *  - Never rely on setInterval alone: every displayed value is computed from timestamps.
 *  - A session has fixed start/end instants; nothing can pause or shorten it.
 *  - Duplicate completion must be impossible (idempotence helper below + server check).
 *  - Survives page reload, browser close/reopen and offline periods.
 */

export interface TimerSnapshot {
  /** Epoch ms when the session started (fixed). */
  startedAt: number;
  /** Epoch ms when the session is planned to end (fixed). */
  endsAt: number;
  /** Planned duration in seconds. */
  durationSeconds: number;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Milliseconds remaining until the session ends. Never negative. */
export function remainingMs(snapshot: TimerSnapshot, now: number): number {
  return Math.max(0, snapshot.endsAt - now);
}

/** Whole seconds remaining (rounded up so 0 only shows at the very end). */
export function remainingSeconds(snapshot: TimerSnapshot, now: number): number {
  return Math.ceil(remainingMs(snapshot, now) / 1000);
}

/** Progress through the session in [0, 1]. */
export function progressRatio(snapshot: TimerSnapshot, now: number): number {
  const total = snapshot.durationSeconds * 1000;
  if (total <= 0) return 1;
  return clamp((now - snapshot.startedAt) / total, 0, 1);
}

/** True when the planned end has been reached. */
export function isFinished(snapshot: TimerSnapshot, now: number): boolean {
  return now >= snapshot.endsAt;
}

/** "MM:SS" or "H:MM:SS" for display. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Human duration like "25 دقيقة" (caller supplies unit labels). */
export function formatDurationLabel(
  seconds: number,
  labels: { minute: string; hour: string },
): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} ${labels.minute}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = `${hours} ${labels.hour}`;
  return minutes > 0 ? `${hourText} ${minutes} ${labels.minute}` : hourText;
}

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 180;

export const PRESET_DURATIONS_MINUTES = [25, 50, 60, 90, 120] as const;

/** Validate a custom duration in minutes. */
export function isValidDurationMinutes(minutes: number): boolean {
  return (
    Number.isFinite(minutes) &&
    Number.isInteger(minutes) &&
    minutes >= MIN_DURATION_MINUTES &&
    minutes <= MAX_DURATION_MINUTES
  );
}

export function buildSnapshot(
  startedAt: number,
  durationSeconds: number,
): TimerSnapshot {
  return {
    startedAt,
    endsAt: startedAt + durationSeconds * 1000,
    durationSeconds,
  };
}

/**
 * Completion guard: a session may only be recorded as completed once the planned
 * end has been reached (with a small tolerance for clock/tick jitter), and only
 * if a completion has not already been recorded.
 */
export function canComplete(
  snapshot: TimerSnapshot,
  now: number,
  alreadyCompleted: boolean,
  toleranceMs = 1000,
): { ok: boolean; reason?: string } {
  if (alreadyCompleted) {
    return { ok: false, reason: "already-completed" };
  }
  if (now < snapshot.endsAt - toleranceMs) {
    return { ok: false, reason: "not-finished" };
  }
  return { ok: true };
}

/**
 * Recovery after reload / reopen: decide what to do with a persisted session.
 * - still running -> "running"
 * - finished but not completed -> "awaiting-completion" (show the completion screen)
 * - already completed -> "done"
 */
export type RecoveryState = "running" | "awaiting-completion" | "done";

export function recoveryState(
  snapshot: TimerSnapshot,
  now: number,
  status: "active" | "completed" | "failed",
): RecoveryState {
  if (status !== "active") return "done";
  return isFinished(snapshot, now) ? "awaiting-completion" : "running";
}

/**
 * Clock-skew safe planning: when the server time is known, translate "now on the
 * server" into a start instant that survives local clock tampering.
 */
export function syncOffsetMs(serverNow: number, localNow: number): number {
  return serverNow - localNow;
}

export function serverNow(localNow: number, offsetMs: number): number {
  return localNow + offsetMs;
}
