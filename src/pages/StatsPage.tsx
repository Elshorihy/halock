/**
 * HALOCK — Statistics: totals, 7-day chart (lightweight hand-rolled SVG),
 * filters (day / 7d / 30d) and full session history. No fake numbers ever.
 */

import { useMemo, useState } from "react";
import { BarChart3, Clock, ListTodo, Trophy, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatHoursMinutes, filterSessionsByRange } from "@shared/stats";
import { formatDurationLabel } from "@shared/timer";
import type { FocusSession, StatsRange } from "@shared/types";
import { Badge, Card, EmptyState, StatTile } from "@/components/ui";

export function StatsPage() {
  const { dict, statsFor, sessions, tasks } = useApp();
  const [range, setRange] = useState<StatsRange>("7d");

  const stats = useMemo(() => statsFor(range), [statsFor, range]);
  const history = useMemo(() => filterSessionsByRange(sessions, range, Date.now()), [sessions, range]);
  const completedHistory = history.filter((s) => s.status === "completed");

  const rangeLabel =
    range === "day" ? dict.stats.filterDay : range === "7d" ? dict.stats.filter7 : dict.stats.filter30;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">{dict.stats.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{rangeLabel}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["day", "7d", "30d"] as StatsRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`min-h-[44px] rounded-xl px-5 text-sm font-semibold transition focus-visible-ring ${
              range === r ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.05]"
            }`}
          >
            {r === "day" ? dict.stats.filterDay : r === "7d" ? dict.stats.filter7 : dict.stats.filter30}
          </button>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={dict.stats.totalFocus} value={formatHoursMinutes(stats.totalFocusSeconds)} icon={<Clock size={16} />} />
        <StatTile label={dict.stats.todaySessions} value={String(stats.todaySessions)} icon={<Zap size={16} />} />
        <StatTile label={dict.stats.weekSessions} value={String(stats.weekSessions)} icon={<BarChart3 size={16} />} />
        <StatTile
          label={dict.stats.avgSession}
          value={
            stats.averageSessionSeconds > 0
              ? formatDurationLabel(stats.averageSessionSeconds, { minute: dict.common.minutes, hour: dict.common.hours })
              : "—"
          }
          icon={<Clock size={16} />}
        />
        <StatTile label={dict.stats.completedTasks} value={String(stats.completedTasks)} icon={<ListTodo size={16} />} />
        <StatTile
          label={dict.stats.bestSession}
          value={
            stats.bestSessionSeconds > 0
              ? formatDurationLabel(stats.bestSessionSeconds, { minute: dict.common.minutes, hour: dict.common.hours })
              : "—"
          }
          icon={<Trophy size={16} />}
        />
      </div>

      {/* Chart */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-300">
          {range === "7d" ? dict.stats.chart7 : rangeLabel} — {dict.stats.minutes}
        </h2>
        {stats.series.every((d) => d.minutes === 0) ? (
          <EmptyState title={dict.stats.noData} desc={dict.stats.noDataDesc} />
        ) : (
          <BarChart data={stats.series.map((d) => ({ label: d.date.slice(5), value: d.minutes }))} />
        )}
      </Card>

      {/* History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{dict.stats.sessionsLog}</h2>
        {completedHistory.length === 0 && history.length === 0 ? (
          <EmptyState title={dict.stats.noData} desc={dict.stats.noDataDesc} />
        ) : (
          <div className="flex flex-col gap-2">
            {history.slice(0, 30).map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionRow({ session }: { session: FocusSession }) {
  const { dict, tasks } = useApp();
  const taskTitle =
    session.taskTitle ?? tasks.find((t) => t.id === session.taskId)?.title ?? null;

  const statusBadge =
    session.status === "completed" ? (
      <Badge tone="success">{dict.stats.statuses.completed}</Badge>
    ) : session.status === "active" ? (
      <Badge tone="info">{dict.stats.statuses.active}</Badge>
    ) : (
      <Badge tone="danger">{dict.stats.statuses.failed}</Badge>
    );

  return (
    <div className="glass flex items-center justify-between gap-3 rounded-xl px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {formatDurationLabel(session.durationSeconds, {
              minute: dict.common.minutes,
              hour: dict.common.hours,
            })}
          </span>
          {taskTitle && <span className="truncate text-sm text-slate-400">— {taskTitle}</span>}
        </div>
        <div className="mt-1 text-xs text-slate-500 tnum">
          {new Date(session.startTime).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-2">{statusBadge}</div>
    </div>
  );
}

/** Lightweight SVG bar chart — no external chart library. */
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const height = 180;
  const barWidth = 100 / data.length;

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 100 ${height + 28}`} className="w-full" preserveAspectRatio="none" style={{ height: height + 28 }}>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={100}
            y1={height - f * height + 0.5}
            y2={height - f * height + 0.5}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 12);
          const x = i * barWidth + barWidth * 0.18;
          const w = barWidth * 0.64;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={height - h}
                width={w}
                height={Math.max(h, d.value > 0 ? 2 : 0)}
                rx={1.6}
                fill="url(#halock-bar)"
                opacity={d.value > 0 ? 1 : 0.25}
              />
              {d.value === 0 && (
                <rect x={x} y={height - 1.5} width={w} height={1.5} rx={0.8} fill="rgba(255,255,255,0.12)" />
              )}
              <text
                x={x + w / 2}
                y={height + 12}
                textAnchor="middle"
                fontSize={6.5}
                fill="rgba(148,163,184,0.9)"
              >
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + w / 2} y={height - h - 3} textAnchor="middle" fontSize={6.5} fill="rgba(226,232,240,0.95)">
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
        <defs>
          <linearGradient id="halock-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
