/**
 * Tests — Router provider behavior & failure/recovery handling
 * (spec §16: "Router provider behavior", "Failure and recovery handling").
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  AutomaticRouterProvider,
  ManualRouterProvider,
  PROOF_REQUIREMENTS,
  createRouterProvider,
} from "../src/lib/router-provider";
import { LocalDataSource, memoryStorage, type StorageLike } from "../src/lib/datasource";

describe("ManualRouterProvider", () => {
  let ds: LocalDataSource;
  let provider: ManualRouterProvider;

  beforeEach(() => {
    ds = new LocalDataSource(memoryStorage());
    provider = new ManualRouterProvider(ds);
  });

  it("reports manual-incomplete until all 10 steps are done", async () => {
    expect(await provider.getStatus()).toBe("manual-incomplete");
  });

  it("reports manual-configured after every checklist step is done", async () => {
    const steps: Record<string, boolean> = {};
    for (let i = 1; i <= 10; i++) steps[`s${i}`] = true;
    await ds.saveRouterConfig({ manualSteps: steps });
    expect(await provider.getStatus()).toBe("manual-configured");
  });

  it("capabilities are honest: cannot push rules, can best-effort verify", async () => {
    const caps = await provider.getCapabilities();
    expect(caps.canApplyBlocking).toBe(false);
    expect(caps.canRestoreBlocking).toBe(false);
    expect(caps.canVerifyBlocking).toBe(true);
    expect(caps.proofRequirements).toHaveLength(6);
  });

  it("applyBlocking returns manual-delegated and logs the action (never fake success)", async () => {
    const diag = await provider.applyBlocking({
      domains: ["youtube.com"],
      mode: "blacklist",
      targetDevice: "laptop",
    });
    expect(diag.result).toBe("manual-delegated");
    expect(diag.message).toContain("يدويًا");

    const logs = await ds.listRouterLogs();
    expect(logs[0]).toMatchObject({ action: "apply-blocking", result: "manual-delegated", device: "laptop" });
  });

  it("restoreBlocking returns manual-delegated guidance and logs it", async () => {
    const diag = await provider.restoreBlocking({
      domains: ["youtube.com"],
      mode: "blacklist",
      targetDevice: "laptop",
    });
    expect(diag.result).toBe("manual-delegated");
    const logs = await ds.listRouterLogs();
    expect(logs[0]).toMatchObject({ action: "restore-blocking", result: "manual-delegated" });
  });

  it("verifyBlocking reports honestly when offline", async () => {
    // Simulate offline
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
    });
    const diag = await provider.verifyBlocking("youtube.com");
    expect(diag.result).toBe("unverified");
    expect(diag.message).toContain("لا يوجد اتصال");
  });

  it("verifyBlocking reports likely-blocked when fetch fails while online", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });
    // Force fetch to fail with a network error.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError("network error"))) as typeof fetch;
    try {
      const diag = await provider.verifyBlocking("youtube.com");
      expect(diag.result).toBe("likely-blocked");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("verifyBlocking reports likely-reachable when the network answers", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve({ ok: true, type: "opaque" } as Response)) as typeof fetch;
    try {
      const diag = await provider.verifyBlocking("youtube.com");
      expect(diag.result).toBe("likely-reachable");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("AutomaticRouterProvider — honestly unsupported", () => {
  let ds: LocalDataSource;
  let provider: AutomaticRouterProvider;

  beforeEach(() => {
    ds = new LocalDataSource(memoryStorage());
    provider = new AutomaticRouterProvider(ds);
  });

  it("status is unsupported", async () => {
    expect(await provider.getStatus()).toBe("unsupported");
  });

  it("capabilities deny everything and cite firmware verification", async () => {
    const caps = await provider.getCapabilities();
    expect(caps.canApplyBlocking).toBe(false);
    expect(caps.canRestoreBlocking).toBe(false);
    expect(caps.canVerifyBlocking).toBe(false);
    expect(caps.evidence).toContain("Firmware");
  });

  it("applyBlocking refuses and logs — never claims success", async () => {
    const diag = await provider.applyBlocking({ domains: [], mode: "blacklist", targetDevice: null });
    expect(diag.ok).toBe(false);
    expect(diag.result).toBe("not-supported");
    expect(diag.message).toContain("غير مدعوم");
    const logs = await ds.listRouterLogs();
    expect(logs[0]).toMatchObject({ result: "not-supported" });
  });

  it("restoreBlocking refuses", async () => {
    const diag = await provider.restoreBlocking({ domains: [], mode: "blacklist", targetDevice: null });
    expect(diag.result).toBe("not-supported");
  });

  it("all six proof requirements exist and are unsatisfied", () => {
    expect(PROOF_REQUIREMENTS).toHaveLength(6);
    expect(PROOF_REQUIREMENTS.every((p) => !p.satisfied)).toBe(true);
  });
});

describe("provider factory", () => {
  it("creates the right provider per mode", () => {
    const ds = new LocalDataSource(memoryStorage());
    expect(createRouterProvider("manual", ds).id).toBe("manual");
    expect(createRouterProvider("automatic", ds).id).toBe("automatic");
  });
});

describe("failure & recovery handling (local data source)", () => {
  let storage: StorageLike;
  let ds: LocalDataSource;

  beforeEach(() => {
    storage = memoryStorage();
    ds = new LocalDataSource(storage);
  });

  it("unknown session completion fails cleanly", async () => {
    await expect(ds.completeSession("missing-id")).rejects.toThrow(/غير موجودة/);
  });

  it("updating a missing task fails cleanly", async () => {
    await expect(ds.updateTask("missing", { title: "x" })).rejects.toThrow(/غير موجودة/);
  });

  it("deleting a missing domain is a safe no-op", async () => {
    await expect(ds.deleteDomain("missing")).resolves.toBeUndefined();
  });

  it("data survives export round-trip", async () => {
    await ds.createTask({ title: "مهمة", category: "عام", priority: "high", dueDate: null });
    const exported = await ds.exportAll();
    const parsed = JSON.parse(exported);
    expect(parsed.product).toBe("HALOCK");
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.settings).toBeDefined();
    expect(Array.isArray(parsed.domains)).toBe(true);
  });

  it("deleteAccount wipes everything (account & data deletion)", async () => {
    await ds.createTask({ title: "مهمة", category: "عام", priority: "low", dueDate: null });
    await ds.deleteAccount();
    const ds2 = new LocalDataSource(storage);
    expect(await ds2.listTasks()).toHaveLength(0);
    // Re-seeded defaults only:
    expect((await ds2.listDomains()).every((d) => d.createdAt)).toBe(true);
  });
});
