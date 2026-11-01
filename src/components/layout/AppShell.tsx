/**
 * HALOCK — App shell: header + responsive navigation.
 * Mobile: fixed bottom bar with large touch targets.
 * Desktop (md+): compact top navigation. No giant sidebar (per spec).
 */

import React from "react";
import {
  BarChart3,
  Globe,
  Home,
  ListTodo,
  Router,
  Settings as SettingsIcon,
  Timer,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/store";

export type RouteName =
  | "dashboard"
  | "focus"
  | "websites"
  | "tasks"
  | "stats"
  | "router"
  | "settings";

const NAV_ITEMS: { key: RouteName; icon: React.ElementType; labelKey: keyof ReturnType<typeof navLabels> }[] = [
  { key: "dashboard", icon: Home, labelKey: "dashboard" },
  { key: "focus", icon: Timer, labelKey: "focus" },
  { key: "websites", icon: Globe, labelKey: "websites" },
  { key: "tasks", icon: ListTodo, labelKey: "tasks" },
  { key: "stats", icon: BarChart3, labelKey: "stats" },
  { key: "router", icon: Router, labelKey: "router" },
  { key: "settings", icon: SettingsIcon, labelKey: "settings" },
];

function navLabels() {
  return {
    dashboard: "",
    focus: "",
    websites: "",
    tasks: "",
    stats: "",
    router: "",
    settings: "",
  } as Record<RouteName, string>;
}

export function AppShell({
  route,
  navigate,
  children,
}: {
  route: RouteName;
  navigate: (r: RouteName) => void;
  children: React.ReactNode;
}) {
  const { dict, isLocalMode, online, settings } = useApp();

  const labels: Record<RouteName, string> = {
    dashboard: dict.nav.dashboard,
    focus: dict.nav.focus,
    websites: dict.nav.websites,
    tasks: dict.nav.tasks,
    stats: dict.nav.stats,
    router: dict.nav.router,
    settings: dict.nav.settings,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate("dashboard")}
            className="flex items-center gap-2.5 focus-visible-ring rounded-xl"
            aria-label={dict.app.name}
          >
            <Logo />
            <div className="text-start">
              <div className="text-base font-extrabold leading-tight tracking-wide">HALOCK</div>
              <div className="text-[10px] text-slate-400 leading-tight">{dict.app.slogan}</div>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = route === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition focus-visible-ring ${
                    active ? "bg-white/[0.08] text-focus" : "text-slate-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={17} />
                  <span>{labels[item.key]}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!online && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                <WifiOff size={13} /> {dict.common.offline}
              </span>
            )}
            {isLocalMode && (
              <span className="hidden sm:flex items-center rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-slate-300">
                {dict.common.localMode}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-ink-950/90 backdrop-blur-xl md:hidden safe-bottom">
        <div className="mx-auto flex w-full max-w-5xl items-stretch justify-between gap-0.5 px-1 py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={`nav-item flex-1 ${active ? "nav-item-active" : ""}`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{labels[item.key]}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Small hint when light theme is chosen — the design system is dark-first. */}
      {settings.theme === "light" && null}
    </div>
  );
}

function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#lg)" stroke="rgba(255,255,255,0.12)" />
      <path
        d="M24 12.5a7 7 0 0 1 7 7V22h1.2a2.8 2.8 0 0 1 2.8 2.8v8.4a2.8 2.8 0 0 1-2.8 2.8H15.8a2.8 2.8 0 0 1-2.8-2.8v-8.4a2.8 2.8 0 0 1 2.8-2.8H17v-2.5a7 7 0 0 1 7-7Zm0 3.4a3.6 3.6 0 0 0-3.6 3.6V22h7.2v-2.5a3.6 3.6 0 0 0-3.6-3.6Z"
        fill="#e2e8f0"
      />
      <circle cx="24" cy="28.6" r="2.3" fill="#22d3ee" />
      <defs>
        <linearGradient id="lg" x1="4" y1="4" x2="44" y2="44">
          <stop stopColor="#1e2438" />
          <stop offset="1" stopColor="#0b0d13" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-sm shadow-glass backdrop-blur-xl border ${
            t.tone === "success"
              ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-200"
              : t.tone === "error"
                ? "border-red-500/30 bg-red-950/80 text-red-200"
                : "border-white/10 bg-ink-800/90 text-slate-200"
          }`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
