/**
 * HALOCK — Central application state (React context).
 * All pages consume this store; all mutations go through the DataSource
 * (remote API when deployed, local storage otherwise).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BlockedDomain,
  DomainCategory,
  FocusSession,
  RouterConfiguration,
  RouterLog,
  StatsRange,
  Task,
  TaskPriority,
  User,
  UserSettings,
} from "@shared/types";
import { DEFAULT_SETTINGS, parseSettings } from "@shared/validation";
import { computeStats } from "@shared/stats";
import { findDuplicate, parseDomainInput } from "@shared/domains";
import {
  createDataSource,
  LocalDataSource,
  type DataSource,
  type StartSessionInput,
} from "./datasource";
import { getDict, type Dict, type Lang } from "./i18n";

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface AppState {
  ready: boolean;
  lang: Lang;
  dict: Dict;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;

  dataSource: DataSource;
  isLocalMode: boolean;

  online: boolean;

  user: User | null;
  settings: UserSettings;

  sessions: FocusSession[];
  tasks: Task[];
  domains: BlockedDomain[];
  routerConfig: RouterConfiguration;
  routerLogs: RouterLog[];

  activeSession: FocusSession | null;

  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;

  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;

  startSession: (input: StartSessionInput) => Promise<FocusSession>;
  saveCompletedSession: (id: string) => Promise<FocusSession>;
  discardActiveSession: () => Promise<void>;

  createTask: (input: { title: string; category: string; priority: TaskPriority; dueDate: string | null }) => Promise<void>;
  updateTask: (id: string, patch: Partial<Omit<Task, "id" | "userId">>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  addDomain: (input: { domain: string; category: DomainCategory }) => Promise<{ ok: boolean; message: string }>;
  updateDomain: (id: string, patch: Partial<Pick<BlockedDomain, "domain" | "category" | "enabled">>) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;
  importDomains: (entries: { domain: string; category: DomainCategory; enabled: boolean }[]) => Promise<{ added: number; skipped: number }>;

  saveRouterConfig: (patch: Partial<RouterConfiguration>) => Promise<void>;
  addRouterLog: (log: Omit<RouterLog, "id" | "userId" | "createdAt">) => Promise<void>;

  statsFor: (range: StatsRange) => ReturnType<typeof computeStats>;

  authLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  authRegister: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  authLogout: () => Promise<void>;
  authDeleteAccount: () => Promise<void>;

  exportData: () => Promise<string>;
  clearLocalData: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppStateProvider>");
  return ctx;
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem("halock:v1:lang");
    return saved === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>(readLang);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [routerConfig, setRouterConfig] = useState<RouterConfiguration>({
    id: "router-default",
    userId: "local",
    provider: "manual",
    integrationMode: "none",
    targetDevice: null,
    status: "disconnected",
    routerUrl: null,
    manualSteps: {},
    updatedAt: new Date(0).toISOString(),
  });
  const [routerLogs, setRouterLogs] = useState<RouterLog[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const dsRef = useRef<DataSource | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>(() => new LocalDataSource());
  const toastIdRef = useRef(0);

  const dict = useMemo(() => getDict(lang), [lang]);

  // Apply language / direction to the document.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;
    try {
      localStorage.setItem("halock:v1:lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang, dict.dir]);

  // Track connectivity.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    const ds = dsRef.current;
    if (!ds) return;
    try {
      const [nextSessions, nextTasks, nextDomains, nextRouter, nextLogs, nextUser] = await Promise.all([
        ds.listSessions(),
        ds.listTasks(),
        ds.listDomains(),
        ds.getRouterConfig(),
        ds.listRouterLogs(50),
        ds.currentUser(),
      ]);
      setSessions(nextSessions);
      setTasks(nextTasks);
      setDomains(nextDomains);
      setRouterConfig(nextRouter);
      setRouterLogs(nextLogs);
      setUser(nextUser);
    } catch (e) {
      // Never hide errors from the user.
      toast((e as Error).message || dict.toasts.error, "error");
    }
  }, [toast, dict.toasts.error]);

  // Boot: pick data source, load settings & data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ds = await createDataSource();
      if (cancelled) return;
      dsRef.current = ds;
      setDataSource(ds);
      try {
        const s = await ds.getSettings();
        const parsed = parseSettings(s);
        setSettings(parsed.ok ? parsed.value : DEFAULT_SETTINGS);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      const ds = dsRef.current;
      if (!ds) return;
      const next = { ...settings, ...patch };
      const saved = await ds.saveSettings(next);
      setSettings(saved);
    },
    [settings],
  );

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      void updateSettings({ language: next });
    },
    [updateSettings],
  );

  const activeSession = useMemo(() => sessions.find((s) => s.status === "active") ?? null, [sessions]);

  const startSession = useCallback(
    async (input: StartSessionInput) => {
      const ds = dsRef.current;
      if (!ds) throw new Error("Data source not ready");
      const session = await ds.startSession(input);
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [],
  );

  const saveCompletedSession = useCallback(
    async (id: string) => {
      const ds = dsRef.current;
      if (!ds) throw new Error("Data source not ready");
      const session = await ds.completeSession(id);
      setSessions((prev) => prev.map((s) => (s.id === id ? session : s)));
      return session;
    },
    [],
  );

  /**
   * Discard an unfinished local session (only allowed BEFORE its end time has
   * elapsed — i.e. the user explicitly aborts a plan that never ran to zero,
   * which we mark "failed" rather than silently deleting history).
   */
  const discardActiveSession = useCallback(async () => {
    const ds = dsRef.current;
    if (!ds || !dsRef.current) return;
    if (ds instanceof LocalDataSource) {
      // Mark as failed via a tiny local mutation.
      const db = (ds as unknown as { storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } });
      const raw = db.storage.getItem("halock:v1:db");
      if (raw) {
        const parsed = JSON.parse(raw) as { sessions: FocusSession[] };
        parsed.sessions = parsed.sessions.map((s) =>
          s.status === "active" ? { ...s, status: "failed" as const } : s,
        );
        db.storage.setItem("halock:v1:db", JSON.stringify(parsed));
      }
      await refresh();
    }
  }, [refresh]);

  const createTask = useCallback(
    async (input: { title: string; category: string; priority: TaskPriority; dueDate: string | null }) => {
      const ds = dsRef.current;
      if (!ds) return;
      const task = await ds.createTask(input);
      setTasks((prev) => [task, ...prev]);
    },
    [],
  );

  const updateTask = useCallback(async (id: string, patch: Partial<Omit<Task, "id" | "userId">>) => {
    const ds = dsRef.current;
    if (!ds) return;
    const task = await ds.updateTask(id, patch);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const ds = dsRef.current;
    if (!ds) return;
    await ds.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addDomain = useCallback(
    async (input: { domain: string; category: DomainCategory }) => {
      const ds = dsRef.current;
      if (!ds) return { ok: false, message: "not-ready" };
      const parsed = parseDomainInput(input.domain);
      if (!parsed.ok || !parsed.domain) {
        return { ok: false, message: parsed.message ?? "invalid" };
      }
      const dup = findDuplicate(parsed.domain, domains);
      if (dup) return { ok: false, message: "duplicate" };
      const domain = await ds.addDomain({ domain: parsed.domain, category: input.category });
      setDomains((prev) => [...prev, domain]);
      return { ok: true, message: "added" };
    },
    [domains],
  );

  const updateDomain = useCallback(
    async (id: string, patch: Partial<Pick<BlockedDomain, "domain" | "category" | "enabled">>) => {
      const ds = dsRef.current;
      if (!ds) return;
      const domain = await ds.updateDomain(id, patch);
      setDomains((prev) => prev.map((d) => (d.id === id ? domain : d)));
    },
    [],
  );

  const deleteDomain = useCallback(async (id: string) => {
    const ds = dsRef.current;
    if (!ds) return;
    await ds.deleteDomain(id);
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const importDomains = useCallback(
    async (entries: { domain: string; category: DomainCategory; enabled: boolean }[]) => {
      const ds = dsRef.current;
      if (!ds) return { added: 0, skipped: 0 };
      let added = 0;
      let skipped = 0;
      for (const entry of entries) {
        const dup = findDuplicate(entry.domain, domains);
        if (dup) {
          skipped += 1;
          continue;
        }
        const domain = await ds.addDomain({ domain: entry.domain, category: entry.category });
        if (!entry.enabled) await ds.updateDomain(domain.id, { enabled: false });
        setDomains((prev) => [...prev, { ...domain, enabled: entry.enabled }]);
        added += 1;
      }
      return { added, skipped };
    },
    [domains],
  );

  const saveRouterConfig = useCallback(async (patch: Partial<RouterConfiguration>) => {
    const ds = dsRef.current;
    if (!ds) return;
    const config = await ds.saveRouterConfig(patch);
    setRouterConfig(config);
  }, []);

  const addRouterLog = useCallback(async (log: Omit<RouterLog, "id" | "userId" | "createdAt">) => {
    const ds = dsRef.current;
    if (!ds) return;
    const entry = await ds.addRouterLog(log);
    setRouterLogs((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const statsFor = useCallback(
    (range: StatsRange) => computeStats(sessions, tasks, Date.now(), range),
    [sessions, tasks],
  );

  const authLogin = useCallback(
    async (email: string, password: string) => {
      const ds = dsRef.current;
      if (!ds) return { ok: false, error: "not-ready" };
      const result = await ds.login(email, password);
      if (result.ok) {
        setUser(result.user ?? null);
        await refresh();
      }
      return { ok: result.ok, error: result.error };
    },
    [refresh],
  );

  const authRegister = useCallback(
    async (name: string, email: string, password: string) => {
      const ds = dsRef.current;
      if (!ds) return { ok: false, error: "not-ready" };
      const result = await ds.register(name, email, password);
      if (result.ok) {
        setUser(result.user ?? null);
        await refresh();
      }
      return { ok: result.ok, error: result.error };
    },
    [refresh],
  );

  const authLogout = useCallback(async () => {
    const ds = dsRef.current;
    if (!ds) return;
    await ds.logout();
    setUser(null);
    await refresh();
  }, [refresh]);

  const authDeleteAccount = useCallback(async () => {
    const ds = dsRef.current;
    if (!ds) return;
    await ds.deleteAccount();
    setUser(null);
    await refresh();
  }, [refresh]);

  const exportData = useCallback(async () => {
    const ds = dsRef.current;
    if (!ds) return "";
    return ds.exportAll();
  }, []);

  const clearLocalData = useCallback(async () => {
    const ds = dsRef.current;
    if (ds instanceof LocalDataSource) {
      await ds.deleteAccount();
      await refresh();
    }
  }, [refresh]);

  const value: AppState = {
    ready,
    lang,
    dict,
    dir: dict.dir,
    setLang,
    dataSource,
    isLocalMode: dataSource.mode === "local",
    online,
    user,
    settings,
    sessions,
    tasks,
    domains,
    routerConfig,
    routerLogs,
    activeSession,
    toasts,
    toast,
    dismissToast,
    refresh,
    updateSettings,
    startSession,
    saveCompletedSession,
    discardActiveSession,
    createTask,
    updateTask,
    deleteTask,
    addDomain,
    updateDomain,
    deleteDomain,
    importDomains,
    saveRouterConfig,
    addRouterLog,
    statsFor,
    authLogin,
    authRegister,
    authLogout,
    authDeleteAccount,
    exportData,
    clearLocalData,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
