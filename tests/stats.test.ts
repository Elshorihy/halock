/**
 * Tests — Statistics calculations (spec §16: "Statistics calculations").
 * No fabricated numbers: empty ranges must produce zeros.
 */
import { describe, expect, it } from "vitest";
import { buildSeries, computeStats, dateKey, filterSessionsByRange, formatHoursMinutes } from "../shared/stats";
import type { FocusSession, Task } from "../shared/types";

function session(overrides: Partial<FocusSession>): FocusSession {
  return {
    id: "s",
    userId: "u",
    taskId: null,
    taskTitle: null,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationSeconds: 1500,
    status: "completed",
    blockedDomains: [],
    blockingMode: "blacklist",
    blockingStatus: "not-configured",
    routerMode: "none",
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t",
    userId: "u",
    title: "x",
    category: "general",
    priority: "medium",
    completed: false,
    dueDate: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

const NOW = new Date("2026-11-01T15:00:00").getTime();

describe("statistics calculations", () => {
  it("returns all zeros for empty data (no fake numbers)", () => {
    const stats = computeStats([], [], NOW);
    expect(stats.totalFocusSeconds).toBe(0);
    expect(stats.todaySeconds).toBe(0);
    expect(stats.todaySessions).toBe(0);
    expect(stats.averageSessionSeconds).toBe(0);
    expect(stats.bestSessionSeconds).toBe(0);
    expect(stats.completedTasks).toBe(0);
  });

  it("computes today / week / total correctly", () => {
    const today = session({
      id: "s1",
      startTime: new Date("2026-11-01T10:00:00").toISOString(),
      durationSeconds: 1800,
    });
    const yesterday = session({
      id: "s2",
      startTime: new Date("2026-10-31T10:00:00").toISOString(),
      durationSeconds: 3600,
    });
    const lastMonth = session({
      id: "s3",
      startTime: new Date("2026-09-15T10:00:00").toISOString(),
      durationSeconds: 900,
      status: "completed",
    });
    const active = session({
      id: "s4",
      startTime: new Date("2026-11-01T12:00:00").toISOString(),
      durationSeconds: 5000,
      status: "active",
    });

    const stats = computeStats([today, yesterday, lastMonth, active], [], NOW);

    // Active sessions never count.
    expect(stats.todaySessions).toBe(1);
    expect(stats.todaySeconds).toBe(1800);
    expect(stats.weekSessions).toBe(2);
    expect(stats.weekSeconds).toBe(1800 + 3600);
    expect(stats.totalFocusSeconds).toBe(1800 + 3600 + 900);
    expect(stats.bestSessionSeconds).toBe(3600);
    expect(stats.averageSessionSeconds).toBe(Math.round((1800 + 3600 + 900) / 3));
  });

  it("counts completed tasks only", () => {
    const stats = computeStats(
      [],
      [task({ id: "t1", completed: true }), task({ id: "t2" }), task({ id: "t3", completed: true })],
      NOW,
    );
    expect(stats.completedTasks).toBe(2);
  });

  it("builds a 7-day series including empty days", () => {
    const s = session({
      startTime: new Date("2026-10-30T09:00:00").toISOString(),
      durationSeconds: 1200,
    });
    const series = buildSeries([s], "7d", NOW);
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].date).toBe(dateKey(new Date(NOW)));
    const day = series.find((d) => d.date === "2026-10-30");
    expect(day?.minutes).toBe(20);
    expect(day?.sessions).toBe(1);
    // Honest zeros elsewhere:
    const empty = series.find((d) => d.date === "2026-10-29");
    expect(empty?.minutes).toBe(0);
    expect(empty?.sessions).toBe(0);
  });

  it("filters sessions by range", () => {
    const inRange = session({ id: "a", startTime: new Date("2026-11-01T08:00:00").toISOString() });
    const outRange = session({ id: "b", startTime: new Date("2026-09-01T08:00:00").toISOString() });
    const within30 = session({ id: "c", startTime: new Date("2026-10-15T08:00:00").toISOString() });
    expect(filterSessionsByRange([inRange, outRange, within30], "day", NOW).map((s) => s.id)).toEqual(["a"]);
    expect(filterSessionsByRange([inRange, outRange, within30], "7d", NOW).map((s) => s.id)).toEqual(["a"]);
    expect(filterSessionsByRange([inRange, outRange, within30], "30d", NOW).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("formats hours/minutes", () => {
    expect(formatHoursMinutes(0)).toBe("0 د");
    expect(formatHoursMinutes(1800)).toBe("30 د");
    expect(formatHoursMinutes(3600)).toBe("1 س 0 د");
    expect(formatHoursMinutes(5400)).toBe("1 س 30 د");
  });
});
