/**
 * HALOCK — App root: hash routing + boot + PWA install prompt.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Loader2, X } from "lucide-react";
import { AppShell, Toasts, type RouteName } from "@/components/layout/AppShell";
import { useApp } from "@/lib/store";
import { DashboardPage } from "@/pages/DashboardPage";
import { FocusPage } from "@/pages/FocusPage";
import { WebsitesPage } from "@/pages/WebsitesPage";
import { TasksPage } from "@/pages/TasksPage";
import { StatsPage } from "@/pages/StatsPage";
import { RouterPage } from "@/pages/RouterPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { Button } from "@/components/ui";

const ROUTES: RouteName[] = ["dashboard", "focus", "websites", "tasks", "stats", "router", "settings"];

function parseHash(): RouteName {
  const hash = window.location.hash.replace("#/", "").replace("#", "") as RouteName;
  return ROUTES.includes(hash) ? hash : "dashboard";
}

export function App() {
  const { ready, dict, settings, lang } = useApp();
  const [route, setRoute] = useState<RouteName>(parseHash);
  const reduce = useReducedMotion();

  // Apply persisted theme on boot.
  useEffect(() => {
    if (settings.theme === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
  }, [settings.theme]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((r: RouteName) => {
    window.location.hash = `#/${r}`;
    setRoute(r);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-glow/15">
          <Loader2 size={32} className="animate-spin text-violet-glow" />
        </div>
        <div className="text-sm text-slate-400">{dict.common.loading}</div>
      </div>
    );
  }

  return (
    <>
      <AppShell route={route} navigate={navigate}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${route}-${lang}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {route === "dashboard" && <DashboardPage navigate={navigate} />}
            {route === "focus" && <FocusPage navigate={navigate} />}
            {route === "websites" && <WebsitesPage />}
            {route === "tasks" && <TasksPage />}
            {route === "stats" && <StatsPage />}
            {route === "router" && <RouterPage />}
            {route === "settings" && <SettingsPage />}
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <Toasts />
      <PwaInstallPrompt />
    </>
  );
}

/** Real beforeinstallprompt handling — only shows when the browser offers it. */
function PwaInstallPrompt() {
  const { dict } = useApp();
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 inset-x-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-md">
      <div className="glass-strong flex items-center gap-3 rounded-2xl p-4">
        <Download size={22} className="shrink-0 text-violet-glow" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{dict.pwa.installTitle}</div>
          <div className="text-xs text-slate-400">{dict.pwa.installDesc}</div>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const promptEvent = deferred as unknown as { prompt: () => Promise<void> };
            await promptEvent.prompt();
            setVisible(false);
          }}
        >
          {dict.pwa.install}
        </Button>
        <button
          aria-label={dict.pwa.later}
          onClick={() => setVisible(false)}
          className="rounded-full p-2 text-slate-400 hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
