/**
 * HALOCK — Dashboard: live focus state, today's summary, quick access.
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  Crown,
  Globe,
  ListTodo,
  Play,
  Router as RouterIcon,
  Settings as SettingsIcon,
  ShieldCheck,
  Timer,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { formatClock, progressRatio, remainingSeconds } from "@shared/timer";
import { formatHoursMinutes } from "@shared/stats";
import { Badge, Button, Card, ProgressRing, StatTile } from "@/components/ui";
import type { RouteName } from "@/components/layout/AppShell";

export function DashboardPage({ navigate }: { navigate: (r: RouteName) => void }) {
  const { dict, domains, sessions, tasks, activeSession, routerConfig, statsFor, online } = useApp();
  const [now, setNow] = useState(Date.now());
  const reduce = useReducedMotion();

  // Live tick for the dashboard ring — values are computed from timestamps.
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const stats = statsFor("7d");
  const enabledDomains = domains.filter((d) => d.enabled).length;

  const routerBadge = () => {
    switch (routerConfig.integrationMode) {
      case "automatic":
        return <Badge tone="info"><Wifi size={12} /> {dict.dashboard.routerConnected}</Badge>;
      case "manual":
        return <Badge tone="warning"><Wifi size={12} /> {dict.dashboard.routerManual}</Badge>;
      default:
        return <Badge tone="default"><WifiOff size={12} /> {dict.dashboard.routerNone}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-extrabold">{dict.dashboard.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{dict.app.slogan}</p>
      </motion.div>

      {/* --- Focus state --- */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-glow/10 via-transparent to-focus/10 pointer-events-none" />
        <div className="relative flex flex-col items-center gap-5">
          <div className="flex w-full items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">{dict.dashboard.focusState}</h2>
            {routerBadge()}
          </div>

          {activeSession ? (
            <>
              <ProgressRing
                ratio={progressRatio(
                  {
                    startedAt: new Date(activeSession.startTime).getTime(),
                    endsAt: new Date(activeSession.endTime).getTime(),
                    durationSeconds: activeSession.durationSeconds,
                  },
                  now,
                )}
                size={230}
              >
                <div className="text-4xl font-extrabold tnum">
                  {formatClock(
                    remainingSeconds(
                      {
                        startedAt: new Date(activeSession.startTime).getTime(),
                        endsAt: new Date(activeSession.endTime).getTime(),
                        durationSeconds: activeSession.durationSeconds,
                      },
                      now,
                    ),
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-400">{dict.dashboard.remaining}</div>
                {activeSession.taskTitle && (
                  <div className="mt-2 max-w-[170px] truncate text-sm text-focus">{activeSession.taskTitle}</div>
                )}
              </ProgressRing>
              <Button size="lg" variant="secondary" onClick={() => navigate("focus")}>
                <Timer size={20} /> {dict.dashboard.resumeSession}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-glow/15">
                  <Timer size={40} className="text-violet-glow" />
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{dict.dashboard.noActiveSession}</div>
                  <p className="mt-1 max-w-xs text-sm text-slate-400">{dict.dashboard.noActiveDesc}</p>
                </div>
              </div>
              <Button size="lg" onClick={() => navigate("focus")}>
                <Play size={20} /> {dict.dashboard.startSession}
              </Button>
            </>
          )}

          <div className="mt-2 flex w-full items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Globe size={14} /> {enabledDomains} {dict.dashboard.blockedCount}
            </span>
            <span className={`flex items-center gap-1.5 ${online ? "text-emerald-400" : "text-amber-400"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? dict.focus.connected : dict.common.offline}
            </span>
          </div>
        </div>
      </Card>

      {/* --- Today summary --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{dict.dashboard.todaySummary}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={dict.dashboard.focusToday}
            value={formatHoursMinutes(stats.todaySeconds)}
            icon={<Timer size={16} />}
          />
          <StatTile
            label={dict.dashboard.sessionsDone}
            value={String(stats.todaySessions)}
            icon={<CheckCircle2 size={16} />}
          />
          <StatTile
            label={dict.dashboard.tasksDone}
            value={String(stats.completedTasks)}
            icon={<ListTodo size={16} />}
          />
          <StatTile
            label={dict.dashboard.bestSession}
            value={stats.bestSessionSeconds > 0 ? formatHoursMinutes(stats.bestSessionSeconds) : "—"}
            icon={<Crown size={16} />}
          />
          <StatTile
            label={dict.dashboard.weekFocus}
            value={formatHoursMinutes(stats.weekSeconds)}
            sub={`${stats.weekSessions} ${dict.dashboard.sessionsDone}`}
            icon={<BarChart3 size={16} />}
          />
        </div>
      </section>

      {/* --- Quick access --- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{dict.dashboard.quickAccess}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickAction icon={<Timer size={22} />} label={dict.dashboard.quick.focus} onClick={() => navigate("focus")} />
          <QuickAction icon={<Globe size={22} />} label={dict.dashboard.quick.websites} onClick={() => navigate("websites")} />
          <QuickAction icon={<ListTodo size={22} />} label={dict.dashboard.quick.tasks} onClick={() => navigate("tasks")} />
          <QuickAction icon={<BarChart3 size={22} />} label={dict.dashboard.quick.stats} onClick={() => navigate("stats")} />
          <QuickAction icon={<RouterIcon size={22} />} label={dict.dashboard.quick.router} onClick={() => navigate("router")} />
          <QuickAction icon={<SettingsIcon size={22} />} label={dict.dashboard.quick.settings} onClick={() => navigate("settings")} />
        </div>
      </section>

      {/* Honest product note */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
        <ShieldCheck size={32} className="shrink-0 text-focus/70" />
        <p>{dict.focus.blockingHonestNote}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl p-4 text-sm font-medium text-slate-200 transition active:scale-[0.97] hover:bg-white/[0.07] focus-visible-ring"
    >
      <span className="text-violet-glow">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
