/**
 * HALOCK — Input validation shared by the Worker API and the local data source.
 * Every user-supplied value must pass through one of these parsers.
 */

import type {
  BlockingMode,
  DomainCategory,
  TaskPriority,
  UserSettings,
} from "./types";
import { isValidDurationMinutes } from "./timer";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseDisplayName(raw: unknown): ParseResult<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 2) return { ok: false, error: "الاسم قصير جدًا" };
  if (name.length > 60) return { ok: false, error: "الاسم طويل جدًا" };
  return { ok: true, value: name };
}

export function parseEmail(raw: unknown): ParseResult<string> {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "البريد الإلكتروني غير صالح" };
  }
  return { ok: true, value: email };
}

export function parsePassword(raw: unknown): ParseResult<string> {
  const password = typeof raw === "string" ? raw : "";
  if (password.length < 8) return { ok: false, error: "كلمة المرور 8 أحرف على الأقل" };
  if (password.length > 200) return { ok: false, error: "كلمة المرور طويلة جدًا" };
  return { ok: true, value: password };
}

export function parseTaskTitle(raw: unknown): ParseResult<string> {
  const title = typeof raw === "string" ? raw.trim() : "";
  if (title.length < 1) return { ok: false, error: "عنوان المهمة مطلوب" };
  if (title.length > 160) return { ok: false, error: "عنوان المهمة طويل جدًا" };
  return { ok: true, value: title };
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export function parsePriority(raw: unknown): ParseResult<TaskPriority> {
  const value = typeof raw === "string" ? raw : "medium";
  if (!PRIORITIES.includes(value as TaskPriority)) {
    return { ok: false, error: "أولوية غير صالحة" };
  }
  return { ok: true, value: value as TaskPriority };
}

export function parseCategory(raw: unknown): ParseResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length > 60) return { ok: false, error: "التصنيف طويل جدًا" };
  return { ok: true, value: value || "عام" };
}

export function parseDueDate(raw: unknown): ParseResult<string | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "تاريخ غير صالح (yyyy-mm-dd)" };
  }
  return { ok: true, value };
}

export function parseBlockingMode(raw: unknown): ParseResult<BlockingMode> {
  return raw === "whitelist" || raw === "blacklist"
    ? { ok: true, value: raw }
    : { ok: false, error: "وضع حجب غير صالح" };
}

export function parseDomainCategory(raw: unknown): ParseResult<DomainCategory> {
  const allowed: DomainCategory[] = ["social", "video", "gaming", "other"];
  return allowed.includes(raw as DomainCategory)
    ? { ok: true, value: raw as DomainCategory }
    : { ok: false, error: "تصنيف غير صالح" };
}

export function parseDurationMinutes(raw: unknown): ParseResult<number> {
  const minutes = typeof raw === "number" ? raw : Number(raw);
  if (!isValidDurationMinutes(minutes)) {
    return { ok: false, error: "المدة يجب أن تكون بين 1 و180 دقيقة" };
  }
  return { ok: true, value: minutes };
}

/** Sanitize free text used in logs / notes. */
export function sanitizeText(raw: unknown, maxLength = 300): string {
  const text = typeof raw === "string" ? raw : "";
  return text
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, maxLength)
    .trim();
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: "ar",
  theme: "dark",
  soundEnabled: true,
  soundVolume: 0.5,
  defaultDurationMinutes: 25,
  defaultBlockingMode: "blacklist",
  confirmBeforeStart: true,
  showDesktopNotifications: false,
};

export function parseSettings(raw: unknown): ParseResult<UserSettings> {
  const input = (raw ?? {}) as Partial<UserSettings>;
  const language = input.language === "en" ? "en" : "ar";
  const theme = input.theme === "light" ? "light" : "dark";
  const soundEnabled = input.soundEnabled !== false;
  const soundVolume = clampNumber(input.soundVolume, 0, 1, 0.5);
  const defaultDurationMinutes = isValidDurationMinutes(Number(input.defaultDurationMinutes))
    ? Number(input.defaultDurationMinutes)
    : 25;
  const defaultBlockingMode = input.defaultBlockingMode === "whitelist" ? "whitelist" : "blacklist";
  return {
    ok: true,
    value: {
      language,
      theme,
      soundEnabled,
      soundVolume,
      defaultDurationMinutes,
      defaultBlockingMode,
      confirmBeforeStart: input.confirmBeforeStart !== false,
      showDesktopNotifications: input.showDesktopNotifications === true,
    },
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Simple ID validation (UUID-ish or our generated ids). */
export function isValidId(raw: unknown): boolean {
  return typeof raw === "string" && /^[a-zA-Z0-9_-]{6,64}$/.test(raw);
}
