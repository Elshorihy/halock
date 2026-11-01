/**
 * HALOCK — Statistics calculations.
 * Pure functions over session + task lists. No fabrication: zeros are real zeros.
 */

import type {
  DailyFocusStat,
  FocusSession,
  StatsRange,
  StatsSummary,
  Task,
} from "./types";

/** Local date key "yyyy-mm-dd" (spec: charts use the user's local days). */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeStart(range: StatsRange, now: number): number {
  const todayStart = startOfDay(now);
  if (range === "day") return todayStart;
  const daysBack = range === "7d" ? 6 : 29; // inclusive of today
  return todayStart - daysBack * 24 * 60 * 60 * 1000;
}

function isCompleted(session: FocusSession): boolean {
  return session.status === "completed";
}

/** Build the per-day series for the requested range (empty days included). */
export function buildSeries(
  sessions: FocusSession[],
  range: StatsRange,
  now: number,
): DailyFocusStat[] {
  const start = rangeStart(range, now);
  const days: DailyFocusStat[] = [];
  const byDate = new Map<string, DailyFocusStat>();

  // Seed every day in range so charts show gaps honestly instead of lying.
  for (let t = start; t <= startOfDay(now); t += 24 * 60 * 60 * 1000) {
    const key = dateKey(new Date(t));
    const entry = { date: key, minutes: 0, sessions: 0 };
    byDate.set(key, entry);
    days.push(entry);
  }

  for (const s of sessions) {
    if (!isCompleted(s)) continue;
    const t = new Date(s.startTime).getTime();
    if (t < start || t > now + 24 * 60 * 60 * 1000) continue;
    const key = dateKey(new Date(t));
    const entry = byDate.get(key);
    if (entry) {
      entry.minutes += Math.round(s.durationSeconds / 60);
      entry.sessions += 1;
    }
  }
  return days;
}

/** Full summary used by the Dashboard and the Statistics page. */
export function computeStats(
  sessions: FocusSession[],
  tasks: Task[],
  now: number,
  range: StatsRange = "7d",
): StatsSummary {
  const completed = sessions.filter(isCompleted);

  const todayStart = startOfDay(now);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const totalFocusSeconds = completed.reduce((a, s) => a + s.durationSeconds, 0);
  const todaySessions = completed.filter(
    (s) => new Date(s.startTime).getTime() >= todayStart,
  );
  const weekSessions = completed.filter(
    (s) => new Date(s.startTime).getTime() >= weekStart,
  );

  const bestSessionSeconds = completed.reduce(
    (a, s) => Math.max(a, s.durationSeconds),
    0,
  );

  return {
    totalFocusSeconds,
    todaySeconds: todaySessions.reduce((a, s) => a + s.durationSeconds, 0),
    todaySessions: todaySessions.length,
    weekSeconds: weekSessions.reduce((a, s) => a + s.durationSeconds, 0),
    weekSessions: weekSessions.length,
    completedTasks: tasks.filter((t) => t.completed).length,
    averageSessionSeconds:
      completed.length > 0 ? Math.round(totalFocusSeconds / completed.length) : 0,
    bestSessionSeconds,
    series: buildSeries(sessions, range, now),
  };
}

/** Filter sessions for the history list. */
export function filterSessionsByRange(
  sessions: FocusSession[],
  range: StatsRange,
  now: number,
): FocusSession[] {
  const start = rangeStart(range, now);
  return sessions
    .filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= start && t <= now + 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

export function formatHoursMinutes(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} د`;
  return `${hours} س ${minutes} د`;
}
