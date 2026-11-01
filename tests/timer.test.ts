/**
 * Tests — Timer calculations (spec §16: "Timer calculations").
 */
import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  canComplete,
  clamp,
  formatClock,
  formatDurationLabel,
  isFinished,
  isValidDurationMinutes,
  progressRatio,
  recoveryState,
  remainingMs,
  remainingSeconds,
  serverNow,
  syncOffsetMs,
} from "../shared/timer";

const MIN = 60_000;

describe("timer calculations", () => {
  const snap = buildSnapshot(1_000_000, 25 * 60); // 25 min session

  it("builds a snapshot with a fixed end instant", () => {
    expect(snap.endsAt).toBe(1_000_000 + 25 * MIN);
    expect(snap.durationSeconds).toBe(1500);
  });

  it("computes remaining time from timestamps (not ticks)", () => {
    expect(remainingMs(snap, 1_000_000)).toBe(25 * MIN);
    expect(remainingMs(snap, 1_000_000 + 10 * MIN)).toBe(15 * MIN);
    // Never negative after the end:
    expect(remainingMs(snap, 1_000_000 + 30 * MIN)).toBe(0);
  });

  it("rounds remaining seconds up so 0 only shows at the end", () => {
    expect(remainingSeconds(snap, 1_000_000 + 24 * MIN + 59_500)).toBe(1);
    expect(remainingSeconds(snap, 1_000_000 + 25 * MIN)).toBe(0);
  });

  it("reports progress in [0,1]", () => {
    expect(progressRatio(snap, 1_000_000)).toBe(0);
    expect(progressRatio(snap, 1_000_000 + 12.5 * MIN)).toBeCloseTo(0.5, 5);
    expect(progressRatio(snap, 1_000_000 + 25 * MIN)).toBe(1);
    expect(progressRatio(snap, 1_000_000 + 40 * MIN)).toBe(1);
  });

  it("detects finish exactly at the end instant", () => {
    expect(isFinished(snap, 1_000_000 + 25 * MIN - 1)).toBe(false);
    expect(isFinished(snap, 1_000_000 + 25 * MIN)).toBe(true);
  });

  it("survives page reload: same timestamps give same remaining time", () => {
    // Simulate reload 7 minutes later — the source of truth is the timestamps.
    const now = 1_000_000 + 7 * MIN;
    expect(remainingSeconds(snap, now)).toBe(18 * 60);
  });

  it("handles device clock skew via server offset", () => {
    const offset = syncOffsetMs(5_000_000, 4_000_000); // server is 1000s ahead
    expect(offset).toBe(1_000_000);
    expect(serverNow(4_000_000, offset)).toBe(5_000_000);
  });

  it("formats clocks correctly", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-10)).toBe("00:00");
  });

  it("formats duration labels", () => {
    expect(formatDurationLabel(1500, { minute: "دقيقة", hour: "ساعة" })).toBe("25 دقيقة");
    expect(formatDurationLabel(3600, { minute: "دقيقة", hour: "ساعة" })).toBe("1 ساعة");
    expect(formatDurationLabel(5400, { minute: "دقيقة", hour: "ساعة" })).toBe("1 ساعة 30 دقيقة");
  });

  it("validates custom durations 1..180 minutes", () => {
    expect(isValidDurationMinutes(1)).toBe(true);
    expect(isValidDurationMinutes(180)).toBe(true);
    expect(isValidDurationMinutes(0)).toBe(false);
    expect(isValidDurationMinutes(181)).toBe(false);
    expect(isValidDurationMinutes(25.5)).toBe(false);
    expect(isValidDurationMinutes(NaN)).toBe(false);
  });

  it("clamps values", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });
});

describe("completion guard (duplicate prevention & premature completion)", () => {
  const snap = buildSnapshot(0, 10 * 60);

  it("rejects completion before the end", () => {
    const r = canComplete(snap, 5 * MIN, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-finished");
  });

  it("allows completion at/after the end", () => {
    expect(canComplete(snap, 10 * MIN, false).ok).toBe(true);
    expect(canComplete(snap, 11 * MIN, false).ok).toBe(true);
  });

  it("allows a 1s tolerance for tick jitter", () => {
    expect(canComplete(snap, 10 * MIN - 900, false).ok).toBe(true);
  });

  it("rejects duplicate completion", () => {
    const r = canComplete(snap, 11 * MIN, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already-completed");
  });
});

describe("recovery after close/reopen", () => {
  const snap = buildSnapshot(0, 10 * 60); // 10-minute session

  it("returns running when time remains", () => {
    expect(recoveryState(snap, 5 * MIN, "active")).toBe("running");
  });

  it("returns awaiting-completion when the app was closed past the end", () => {
    expect(recoveryState(snap, 20 * MIN, "active")).toBe("awaiting-completion");
  });

  it("returns done for finished sessions", () => {
    expect(recoveryState(snap, 20 * MIN, "completed")).toBe("done");
    expect(recoveryState(snap, 1 * MIN, "failed")).toBe("done");
  });
});
