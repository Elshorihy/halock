/**
 * HALOCK — Shared domain types used by the frontend, the Cloudflare Worker, and tests.
 * Keep this file free of runtime dependencies.
 */

export type BlockingMode = "blacklist" | "whitelist";

export type Lang = "ar" | "en";

export type SessionStatus = "active" | "completed" | "failed";

export type RouterIntegrationMode = "manual" | "automatic" | "none";

export type BlockingStatus =
  | "not-configured" // no blocking requested
  | "manual-required" // user must apply blocking on the router by hand
  | "applied" // blocking applied and verified via a supported mechanism
  | "not-applied" // an attempt was made and failed
  | "unverified"; // we cannot verify whether blocking is active

export type DomainCategory =
  | "social"
  | "video"
  | "gaming"
  | "other";

export type TaskPriority = "low" | "medium" | "high";

export interface User {
  id: string;
  displayName: string;
  createdAt: string; // ISO
  mode: "local" | "remote";
}

export interface FocusSession {
  id: string;
  userId: string;
  taskId: string | null;
  taskTitle: string | null;
  startTime: string; // ISO
  endTime: string; // ISO — planned end (for active) or actual end (for completed)
  durationSeconds: number;
  status: SessionStatus;
  blockedDomains: string[];
  blockingMode: BlockingMode;
  blockingStatus: BlockingStatus;
  routerMode: RouterIntegrationMode;
  /** Extra context for honest reporting (e.g. why blocking is unverified). */
  note?: string | null;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  category: string;
  priority: TaskPriority;
  completed: boolean;
  dueDate: string | null; // ISO date (yyyy-mm-dd) or null
  createdAt: string; // ISO
  completedAt: string | null;
}

export interface BlockedDomain {
  id: string;
  userId: string;
  domain: string;
  category: DomainCategory;
  enabled: boolean;
  createdAt: string;
}

export interface UserSettings {
  language: "ar" | "en";
  theme: "dark" | "light";
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  defaultDurationMinutes: number;
  defaultBlockingMode: BlockingMode;
  confirmBeforeStart: boolean;
  showDesktopNotifications: boolean;
}

export type RouterConnectionStatus =
  | "disconnected"
  | "manual-configured"
  | "manual-incomplete"
  | "connected"
  | "unsupported"
  | "error";

export interface RouterCapabilities {
  /** Can the provider apply website filter rules automatically? */
  canApplyBlocking: boolean;
  /** Can the provider restore previous rules automatically? */
  canRestoreBlocking: boolean;
  /** Can the provider verify whether a domain is blocked? */
  canVerifyBlocking: boolean;
  /** Human-readable evidence/state for why automatic control is or is not available. */
  evidence: string;
  /** Proof requirements that must be satisfied before Automatic mode is enabled. */
  proofRequirements: RouterProofRequirement[];
}

export interface RouterProofRequirement {
  id: string;
  title: string;
  titleEn: string;
  satisfied: boolean;
}

export interface RouterConfiguration {
  id: string;
  userId: string;
  provider: "manual" | "automatic";
  integrationMode: RouterIntegrationMode;
  targetDevice: string | null;
  status: RouterConnectionStatus;
  /** URL of the router admin page — convenience only, never credentials. */
  routerUrl: string | null;
  /** Checklist state for the manual setup wizard (step id -> done). */
  manualSteps: Record<string, boolean>;
  updatedAt: string;
}

export interface RouterDiagnostics {
  ok: boolean;
  operation: "apply" | "restore" | "verify" | "test" | "status";
  result:
    | "manual-delegated"
    | "not-supported"
    | "skipped"
    | "likely-blocked"
    | "likely-reachable"
    | "unverified"
    | "error";
  message: string;
  messageEn: string;
  createdAt: string;
}

export interface RouterLog {
  id: string;
  userId: string;
  action: string;
  result: string;
  message: string;
  device: string | null;
  createdAt: string;
}

export interface DailyFocusStat {
  /** yyyy-mm-dd */
  date: string;
  minutes: number;
  sessions: number;
}

export interface StatsSummary {
  totalFocusSeconds: number;
  todaySeconds: number;
  todaySessions: number;
  weekSeconds: number;
  weekSessions: number;
  completedTasks: number;
  averageSessionSeconds: number;
  bestSessionSeconds: number;
  series: DailyFocusStat[];
}

export type StatsRange = "day" | "7d" | "30d";

/** Time on the server (epoch ms) plus client offset helper. */
export interface ServerTime {
  now: number;
}
