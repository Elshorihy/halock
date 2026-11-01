/**
 * HALOCK — Data source abstraction.
 *
 * Two real implementations:
 *  - RemoteDataSource: talks to the Cloudflare Worker API (/api/*) with bearer auth.
 *  - LocalDataSource:  full offline functionality using browser localStorage.
 *
 * The app probes /api/health at boot and picks remote when available, otherwise
 * local. The UI always tells the user which mode is active — no fake syncing.
 */

import type {
  BlockedDomain,
  DomainCategory,
  FocusSession,
  RouterConfiguration,
  RouterIntegrationMode,
  RouterLog,
  StatsRange,
  StatsSummary,
  Task,
  TaskPriority,
  User,
  UserSettings,
} from "@shared/types";
import { DEFAULT_SETTINGS, parseSettings } from "@shared/validation";
import { computeStats } from "@shared/stats";
import { DEFAULT_DOMAINS } from "@shared/domains";

export type DataSourceMode = "local" | "remote";

export interface StartSessionInput {
  taskId: string | null;
  taskTitle: string | null;
  durationSeconds: number;
  blockedDomains: string[];
  blockingMode: "blacklist" | "whitelist";
  routerMode: RouterIntegrationMode;
  blockingStatus: FocusSession["blockingStatus"];
  note: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  token?: string;
}

export interface DataSource {
  readonly mode: DataSourceMode;
  /** Server clock offset (ms). 0 in local mode. */
  timeOffsetMs(): Promise<number>;

  // --- auth ---
  register(displayName: string, email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  currentUser(): Promise<User | null>;
  deleteAccount(): Promise<void>;

  // --- focus sessions ---
  listSessions(): Promise<FocusSession[]>;
  getActiveSession(): Promise<FocusSession | null>;
  startSession(input: StartSessionInput): Promise<FocusSession>;
  completeSession(id: string): Promise<FocusSession>;

  // --- tasks ---
  listTasks(): Promise<Task[]>;
  createTask(input: {
    title: string;
    category: string;
    priority: TaskPriority;
    dueDate: string | null;
  }): Promise<Task>;
  updateTask(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // --- blocked domains ---
  listDomains(): Promise<BlockedDomain[]>;
  addDomain(input: { domain: string; category: DomainCategory }): Promise<BlockedDomain>;
  updateDomain(id: string, patch: Partial<Pick<BlockedDomain, "domain" | "category" | "enabled">>): Promise<BlockedDomain>;
  deleteDomain(id: string): Promise<void>;

  // --- settings ---
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<UserSettings>;

  // --- router ---
  getRouterConfig(): Promise<RouterConfiguration>;
  saveRouterConfig(patch: Partial<RouterConfiguration>): Promise<RouterConfiguration>;
  listRouterLogs(limit?: number): Promise<RouterLog[]>;
  addRouterLog(log: Omit<RouterLog, "id" | "userId" | "createdAt">): Promise<RouterLog>;

  // --- stats ---
  stats(range: StatsRange): Promise<StatsSummary>;

  // --- data export ---
  exportAll(): Promise<string>;
}

/* ------------------------------------------------------------------ */
/* Local implementation                                                */
/* ------------------------------------------------------------------ */

const LS_PREFIX = "halock:v1:";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface LocalDb {
  user: User | null;
  settings: UserSettings;
  sessions: FocusSession[];
  tasks: Task[];
  domains: BlockedDomain[];
  router: RouterConfiguration;
  routerLogs: RouterLog[];
  seeded: boolean;
}

const DEFAULT_ROUTER: RouterConfiguration = {
  id: "router-default",
  userId: "local",
  provider: "manual",
  integrationMode: "none",
  targetDevice: null,
  status: "disconnected",
  routerUrl: null,
  manualSteps: {},
  updatedAt: new Date(0).toISOString(),
};

export class LocalDataSource implements DataSource {
  readonly mode = "local" as const;
  private storage: StorageLike;

  constructor(storage: StorageLike = defaultStorage()) {
    this.storage = storage;
    this.ensureSeeded();
  }

  private key(name: string) {
    return `${LS_PREFIX}${name}`;
  }

  private readDb(): LocalDb {
    const raw = this.storage.getItem(this.key("db"));
    if (!raw) {
      const fresh: LocalDb = {
        user: { id: "local", displayName: "مستخدم HALOCK", createdAt: new Date().toISOString(), mode: "local" },
        settings: { ...DEFAULT_SETTINGS },
        sessions: [],
        tasks: [],
        domains: [],
        router: { ...DEFAULT_ROUTER },
        routerLogs: [],
        seeded: false,
      };
      return fresh;
    }
    const parsed = JSON.parse(raw) as LocalDb;
    return {
      ...parsed,
      settings: parseSettings(parsed.settings).ok ? (parsed.settings as UserSettings) : { ...DEFAULT_SETTINGS },
      router: { ...DEFAULT_ROUTER, ...parsed.router },
    };
  }

  private writeDb(db: LocalDb): void {
    this.storage.setItem(this.key("db"), JSON.stringify(db));
  }

  /** First run: add editable default domains (never forced on the user). */
  private ensureSeeded(): void {
    const db = this.readDb();
    if (db.seeded) return;
    db.seeded = true;
    const now = new Date().toISOString();
    db.domains = DEFAULT_DOMAINS.map((d) => ({
      id: newId(),
      userId: "local",
      domain: d.domain,
      category: d.category,
      enabled: true,
      createdAt: now,
    }));
    this.writeDb(db);
  }

  async timeOffsetMs(): Promise<number> {
    return 0;
  }

  async register(displayName: string): Promise<AuthResult> {
    const db = this.readDb();
    db.user = {
      id: "local",
      displayName,
      createdAt: new Date().toISOString(),
      mode: "local",
    };
    this.writeDb(db);
    return { ok: true, user: db.user };
  }

  async login(): Promise<AuthResult> {
    return { ok: false, error: "local-mode" };
  }

  async logout(): Promise<void> {
    /* Local mode has no session to end. */
  }

  async currentUser(): Promise<User | null> {
    return this.readDb().user;
  }

  async deleteAccount(): Promise<void> {
    this.storage.removeItem(this.key("db"));
  }

  async listSessions(): Promise<FocusSession[]> {
    return [...this.readDb().sessions].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  }

  async getActiveSession(): Promise<FocusSession | null> {
    return this.readDb().sessions.find((s) => s.status === "active") ?? null;
  }

  async startSession(input: StartSessionInput): Promise<FocusSession> {
    const db = this.readDb();
    if (db.sessions.some((s) => s.status === "active")) {
      throw new Error("يوجد جلسة نشطة بالفعل — لا يمكن بدء جلستين معًا");
    }
    const now = Date.now();
    const session: FocusSession = {
      id: newId(),
      userId: "local",
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      startTime: new Date(now).toISOString(),
      endTime: new Date(now + input.durationSeconds * 1000).toISOString(),
      durationSeconds: input.durationSeconds,
      status: "active",
      blockedDomains: input.blockedDomains,
      blockingMode: input.blockingMode,
      blockingStatus: input.blockingStatus,
      routerMode: input.routerMode,
      note: input.note,
    };
    db.sessions.push(session);
    this.writeDb(db);
    return session;
  }

  async completeSession(id: string): Promise<FocusSession> {
    const db = this.readDb();
    const session = db.sessions.find((s) => s.id === id);
    if (!session) throw new Error("الجلسة غير موجودة");
    if (session.status !== "active") throw new Error("الجلسة محفوظة بالفعل");
    const endMs = new Date(session.endTime).getTime();
    if (Date.now() < endMs - 1000) throw new Error("لم تنتهِ مدة الجلسة بعد");
    session.status = "completed";
    this.writeDb(db);
    return session;
  }

  async listTasks(): Promise<Task[]> {
    return [...this.readDb().tasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async createTask(input: { title: string; category: string; priority: TaskPriority; dueDate: string | null }): Promise<Task> {
    const db = this.readDb();
    const task: Task = {
      id: newId(),
      userId: "local",
      title: input.title,
      category: input.category,
      priority: input.priority,
      completed: false,
      dueDate: input.dueDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    db.tasks.push(task);
    this.writeDb(db);
    return task;
  }

  async updateTask(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task> {
    const db = this.readDb();
    const task = db.tasks.find((t) => t.id === id);
    if (!task) throw new Error("المهمة غير موجودة");
    Object.assign(task, patch);
    if (patch.completed === true && !task.completedAt) task.completedAt = new Date().toISOString();
    if (patch.completed === false) task.completedAt = null;
    this.writeDb(db);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const db = this.readDb();
    db.tasks = db.tasks.filter((t) => t.id !== id);
    this.writeDb(db);
  }

  async listDomains(): Promise<BlockedDomain[]> {
    return this.readDb().domains;
  }

  async addDomain(input: { domain: string; category: DomainCategory }): Promise<BlockedDomain> {
    const db = this.readDb();
    const domain: BlockedDomain = {
      id: newId(),
      userId: "local",
      domain: input.domain,
      category: input.category,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    db.domains.push(domain);
    this.writeDb(db);
    return domain;
  }

  async updateDomain(id: string, patch: Partial<Pick<BlockedDomain, "domain" | "category" | "enabled">>): Promise<BlockedDomain> {
    const db = this.readDb();
    const domain = db.domains.find((d) => d.id === id);
    if (!domain) throw new Error("الموقع غير موجود");
    Object.assign(domain, patch);
    this.writeDb(db);
    return domain;
  }

  async deleteDomain(id: string): Promise<void> {
    const db = this.readDb();
    db.domains = db.domains.filter((d) => d.id !== id);
    this.writeDb(db);
  }

  async getSettings(): Promise<UserSettings> {
    return { ...DEFAULT_SETTINGS, ...this.readDb().settings };
  }

  async saveSettings(settings: UserSettings): Promise<UserSettings> {
    const db = this.readDb();
    const parsed = parseSettings(settings);
    if (!parsed.ok) throw new Error("إعدادات غير صالحة");
    db.settings = parsed.value;
    this.writeDb(db);
    return parsed.value;
  }

  async getRouterConfig(): Promise<RouterConfiguration> {
    return { ...DEFAULT_ROUTER, ...this.readDb().router };
  }

  async saveRouterConfig(patch: Partial<RouterConfiguration>): Promise<RouterConfiguration> {
    const db = this.readDb();
    db.router = {
      ...DEFAULT_ROUTER,
      ...db.router,
      ...patch,
      id: db.router.id,
      userId: "local",
      updatedAt: new Date().toISOString(),
    };
    this.writeDb(db);
    return db.router;
  }

  async listRouterLogs(limit = 50): Promise<RouterLog[]> {
    return [...this.readDb().routerLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async addRouterLog(log: Omit<RouterLog, "id" | "userId" | "createdAt">): Promise<RouterLog> {
    const db = this.readDb();
    const entry: RouterLog = {
      id: newId(),
      userId: "local",
      createdAt: new Date().toISOString(),
      ...log,
    };
    db.routerLogs.unshift(entry);
    db.routerLogs = db.routerLogs.slice(0, 200);
    this.writeDb(db);
    return entry;
  }

  async stats(range: StatsRange): Promise<StatsSummary> {
    return computeStats(await this.listSessions(), await this.listTasks(), Date.now(), range);
  }

  async exportAll(): Promise<string> {
    const db = this.readDb();
    return JSON.stringify(
      {
        product: "HALOCK",
        exportedAt: new Date().toISOString(),
        user: db.user,
        settings: db.settings,
        sessions: db.sessions,
        tasks: db.tasks,
        domains: db.domains,
        router: db.router,
        routerLogs: db.routerLogs,
      },
      null,
      2,
    );
  }
}

function defaultStorage(): StorageLike {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* ignore */
  }
  return memoryStorage();
}

/* ------------------------------------------------------------------ */
/* Remote implementation                                               */
/* ------------------------------------------------------------------ */

export class RemoteDataSource implements DataSource {
  readonly mode = "remote" as const;
  private baseUrl: string;
  private token: string | null;
  private storage: StorageLike;

  constructor(baseUrl = "/api", storage: StorageLike = defaultStorage()) {
    this.baseUrl = baseUrl;
    this.storage = storage;
    this.token = storage.getItem(`${LS_PREFIX}token`);
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) this.storage.setItem(`${LS_PREFIX}token`, token);
    else this.storage.removeItem(`${LS_PREFIX}token`);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body;
  }

  async timeOffsetMs(): Promise<number> {
    try {
      const data = await this.request<{ now: number }>("/time");
      return data.now - Date.now();
    } catch {
      return 0;
    }
  }

  async register(displayName: string, email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.request<{ user: User; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName, email, password }),
      });
      this.setToken(data.token);
      return { ok: true, user: data.user, token: data.token };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.request<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      this.setToken(data.token);
      return { ok: true, user: data.user, token: data.token };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async createGuestSession(): Promise<boolean> {
    try {
      const data = await this.request<{ user: User; token: string }>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({}),
      });
      this.setToken(data.token);
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    this.setToken(null);
  }

  async currentUser(): Promise<User | null> {
    if (!this.token) return null;
    try {
      const data = await this.request<{ user: User | null }>("/me");
      return data.user;
    } catch {
      this.setToken(null);
      return null;
    }
  }

  async deleteAccount(): Promise<void> {
    await this.request("/me", { method: "DELETE" });
    this.setToken(null);
    // Start a fresh anonymous profile so the app remains usable after clearing data.
    await this.createGuestSession();
  }

  async listSessions(): Promise<FocusSession[]> {
    return this.request<{ sessions: FocusSession[] }>("/sessions").then((d) => d.sessions);
  }

  async getActiveSession(): Promise<FocusSession | null> {
    return this.request<{ session: FocusSession | null }>("/sessions/active").then((d) => d.session);
  }

  async startSession(input: StartSessionInput): Promise<FocusSession> {
    return this.request<{ session: FocusSession }>("/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((d) => d.session);
  }

  async completeSession(id: string): Promise<FocusSession> {
    return this.request<{ session: FocusSession }>(`/sessions/${id}/complete`, {
      method: "POST",
    }).then((d) => d.session);
  }

  async listTasks(): Promise<Task[]> {
    return this.request<{ tasks: Task[] }>("/tasks").then((d) => d.tasks);
  }

  async createTask(input: { title: string; category: string; priority: TaskPriority; dueDate: string | null }): Promise<Task> {
    return this.request<{ task: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((d) => d.task);
  }

  async updateTask(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task> {
    return this.request<{ task: Task }>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }).then((d) => d.task);
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/tasks/${id}`, { method: "DELETE" });
  }

  async listDomains(): Promise<BlockedDomain[]> {
    return this.request<{ domains: BlockedDomain[] }>("/domains").then((d) => d.domains);
  }

  async addDomain(input: { domain: string; category: DomainCategory }): Promise<BlockedDomain> {
    return this.request<{ domain: BlockedDomain }>("/domains", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((d) => d.domain);
  }

  async updateDomain(id: string, patch: Partial<Pick<BlockedDomain, "domain" | "category" | "enabled">>): Promise<BlockedDomain> {
    return this.request<{ domain: BlockedDomain }>(`/domains/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }).then((d) => d.domain);
  }

  async deleteDomain(id: string): Promise<void> {
    await this.request(`/domains/${id}`, { method: "DELETE" });
  }

  async getSettings(): Promise<UserSettings> {
    return this.request<{ settings: UserSettings }>("/settings").then((d) => d.settings);
  }

  async saveSettings(settings: UserSettings): Promise<UserSettings> {
    return this.request<{ settings: UserSettings }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }).then((d) => d.settings);
  }

  async getRouterConfig(): Promise<RouterConfiguration> {
    return this.request<{ config: RouterConfiguration }>("/router/settings").then((d) => d.config);
  }

  async saveRouterConfig(patch: Partial<RouterConfiguration>): Promise<RouterConfiguration> {
    return this.request<{ config: RouterConfiguration }>("/router/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }).then((d) => d.config);
  }

  async listRouterLogs(limit = 50): Promise<RouterLog[]> {
    return this.request<{ logs: RouterLog[] }>(`/router/logs?limit=${limit}`).then((d) => d.logs);
  }

  async addRouterLog(log: Omit<RouterLog, "id" | "userId" | "createdAt">): Promise<RouterLog> {
    return this.request<{ log: RouterLog }>("/router/logs", {
      method: "POST",
      body: JSON.stringify(log),
    }).then((d) => d.log);
  }

  async stats(range: StatsRange): Promise<StatsSummary> {
    return this.request<{ stats: StatsSummary }>(`/stats?range=${range}`).then((d) => d.stats);
  }

  async exportAll(): Promise<string> {
    return this.request<{ data: string }>("/export").then((d) => d.data);
  }
}

/** Probe the API and return the best available data source. */
export async function createDataSource(): Promise<DataSource> {
  try {
    // Preserve an existing local profile when there is no remote session.
    // Switching storage backends silently would make previous local data appear lost.
    const hasLocalProfile = typeof localStorage !== "undefined" && !!localStorage.getItem(`${LS_PREFIX}db`);
    const hasRemoteToken = typeof localStorage !== "undefined" && !!localStorage.getItem(`${LS_PREFIX}token`);
    if (hasLocalProfile && !hasRemoteToken) return new LocalDataSource();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("/api/health", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const remote = new RemoteDataSource();
      // Ensure every browser has a private, passwordless guest profile.
      // Existing guest tokens are reused; invalid/missing tokens are replaced.
      const current = await remote.currentUser();
      if (!current) {
        const created = await remote.createGuestSession();
        if (!created) return new LocalDataSource();
      }
      return remote;
    }
  } catch {
    /* API not deployed or unreachable — fall back to local. */
  }
  return new LocalDataSource();
}
