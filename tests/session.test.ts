/**
 * Tests — Session lifecycle, persistence & duplicate prevention (spec §16).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  canStartSession,
  checkSessionPlan,
  completeSession,
  planBlocking,
} from "../shared/session-logic";
import { LocalDataSource, memoryStorage, type StorageLike } from "../src/lib/datasource";
import type { FocusSession } from "../shared/types";

describe("session plan validation", () => {
  it("requires at least one domain in blacklist mode", () => {
    const r = checkSessionPlan({
      durationMinutes: 25,
      blockedDomains: [],
      blockingMode: "blacklist",
      routerMode: "manual",
      automaticBlockingAvailable: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-domains-in-blacklist");
  });

  it("requires at least one domain in whitelist mode", () => {
    const r = checkSessionPlan({
      durationMinutes: 25,
      blockedDomains: [],
      blockingMode: "whitelist",
      routerMode: "manual",
      automaticBlockingAvailable: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-domains-in-whitelist");
  });

  it("passes with domains and normalizes them", () => {
    const r = checkSessionPlan({
      durationMinutes: 25,
      blockedDomains: ["YouTube.com", "youtube.com", " x.com "],
      blockingMode: "blacklist",
      routerMode: "manual",
      automaticBlockingAvailable: false,
    });
    expect(r.ok).toBe(true);
  });
});

describe("honest blocking status", () => {
  const base = {
    durationMinutes: 25,
    blockedDomains: ["youtube.com"],
    blockingMode: "blacklist" as const,
  };

  it("manual mode → manual-required (never claims success)", () => {
    const plan = planBlocking({ ...base, routerMode: "manual", automaticBlockingAvailable: false });
    expect(plan.blockingStatus).toBe("manual-required");
  });

  it("automatic mode without proven API → unverified (never claims success)", () => {
    const plan = planBlocking({ ...base, routerMode: "automatic", automaticBlockingAvailable: false });
    expect(plan.blockingStatus).toBe("unverified");
    expect(plan.note).toContain("غير متاح");
  });

  it("automatic mode with proven integration → applied", () => {
    const plan = planBlocking({ ...base, routerMode: "automatic", automaticBlockingAvailable: true });
    expect(plan.blockingStatus).toBe("applied");
  });

  it("no integration → not-configured with an honest note", () => {
    const plan = planBlocking({ ...base, routerMode: "none", automaticBlockingAvailable: false });
    expect(plan.blockingStatus).toBe("not-configured");
    expect(plan.note).toContain("لن يتم حجب المواقع");
  });
});

describe("completion rules", () => {
  const session = {
    startTime: new Date(1_000_000).toISOString(),
    endTime: new Date(1_000_000 + 25 * 60_000).toISOString(),
    durationSeconds: 1500,
    status: "active" as const,
  };

  it("rejects completion before the end", () => {
    const r = completeSession({ session, now: 1_000_000 + 10 * 60_000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-finished");
  });

  it("allows completion after the end", () => {
    const r = completeSession({ session, now: 1_000_000 + 25 * 60_000 });
    expect(r.ok).toBe(true);
    expect(r.record?.status).toBe("completed");
  });

  it("rejects duplicate completion", () => {
    const done = { ...session, status: "completed" as const };
    const r = completeSession({ session: done, now: 1_000_000 + 30 * 60_000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already-completed");
  });

  it("rejects when the server rejects (remote verification)", () => {
    const r = completeSession({
      session,
      now: 1_000_000 + 26 * 60_000,
      serverVerified: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("server-rejected");
  });

  it("blocks starting two sessions at once", () => {
    expect(canStartSession([{ status: "active" }]).ok).toBe(false);
    expect(canStartSession([{ status: "completed" }]).ok).toBe(true);
    expect(canStartSession([]).ok).toBe(true);
  });
});

describe("session persistence (LocalDataSource)", () => {
  let storage: StorageLike;
  let ds: LocalDataSource;

  beforeEach(() => {
    storage = memoryStorage();
    ds = new LocalDataSource(storage);
  });

  it("persists an active session and recovers it after a reload", async () => {
    const session = await ds.startSession({
      taskId: null,
      taskTitle: null,
      durationSeconds: 1500,
      blockedDomains: ["youtube.com"],
      blockingMode: "blacklist",
      routerMode: "manual",
      blockingStatus: "manual-required",
      note: "test",
    });

    // "Reload": a brand-new data source over the same storage.
    const ds2 = new LocalDataSource(storage);
    const recovered = await ds2.getActiveSession();
    expect(recovered?.id).toBe(session.id);
    expect(recovered?.status).toBe("active");
    expect(recovered?.blockedDomains).toEqual(["youtube.com"]);
    // Timestamps survive — the timer can be recomputed exactly.
    expect(recovered?.startTime).toBe(session.startTime);
    expect(recovered?.endTime).toBe(session.endTime);
  });

  it("prevents starting a second session while one is active", async () => {
    await ds.startSession({
      taskId: null,
      taskTitle: null,
      durationSeconds: 60,
      blockedDomains: [],
      blockingMode: "blacklist",
      routerMode: "none",
      blockingStatus: "not-configured",
      note: "",
    });
    await expect(
      ds.startSession({
        taskId: null,
        taskTitle: null,
        durationSeconds: 60,
        blockedDomains: [],
        blockingMode: "blacklist",
        routerMode: "none",
        blockingStatus: "not-configured",
        note: "",
      }),
    ).rejects.toThrow(/نشطة/);
  });

  it("prevents duplicate completion and premature completion", async () => {
    const session = await ds.startSession({
      taskId: null,
      taskTitle: null,
      durationSeconds: 3600,
      blockedDomains: [],
      blockingMode: "blacklist",
      routerMode: "none",
      blockingStatus: "not-configured",
      note: "",
    });

    // Premature completion is rejected.
    await expect(ds.completeSession(session.id)).rejects.toThrow();

    // Force the end into the past to test the happy path.
    const raw = JSON.parse(storage.getItem("halock:v1:db")!);
    const target = raw.sessions.find((s: FocusSession) => s.id === session.id);
    target.endTime = new Date(Date.now() - 2000).toISOString();
    storage.setItem("halock:v1:db", JSON.stringify(raw));

    const completed = await ds.completeSession(session.id);
    expect(completed.status).toBe("completed");

    // Second completion must fail.
    await expect(ds.completeSession(session.id)).rejects.toThrow(/بالفعل/);
  });

  it("seeds editable default domains on first run only", async () => {
    const domains = await ds.listDomains();
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.map((d) => d.domain)).toContain("youtube.com");

    await ds.deleteDomain(domains[0].id);
    const ds2 = new LocalDataSource(storage);
    const after = await ds2.listDomains();
    // Deletion persists; seeding does not repeat.
    expect(after.length).toBe(domains.length - 1);
  });
});
