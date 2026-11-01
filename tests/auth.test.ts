/**
 * Tests — Authentication crypto + rate limiting (spec §16: "Authentication").
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  generateSessionToken,
  hashPassword,
  newId,
  sha256Hex,
  verifyPassword,
} from "../worker/lib/auth-crypto";
import {
  checkMemoryRateLimit,
  enforceRateLimit,
  resetMemoryRateLimits,
  type KvLike,
} from "../worker/lib/rate-limit";
import {
  parseDisplayName,
  parseEmail,
  parsePassword,
  parseSettings,
  parseDurationMinutes,
  sanitizeText,
} from "../shared/validation";

describe("password hashing", () => {
  it("never stores the plain password", async () => {
    const stored = await hashPassword("S3cure-Pass!");
    expect(stored).not.toContain("S3cure-Pass!");
    expect(stored.startsWith("pbkdf2$")).toBe(true);
  });

  it("produces unique hashes (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("verifies correct passwords and rejects wrong ones", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
    expect(await verifyPassword("correct horse battery", "garbage")).toBe(false);
    expect(await verifyPassword("correct horse battery", "md5$1$aa$bb")).toBe(false);
  });
});

describe("session tokens", () => {
  it("stores only a hash of the token", () => {
    const { token, tokenHash } = generateSessionToken();
    expect(token).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toBe(sha256Hex(token));
  });

  it("generates unique tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a.token).not.toBe(b.token);
  });

  it("sha256 matches known vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("generates collision-resistant ids", () => {
    expect(newId()).not.toBe(newId());
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetMemoryRateLimits());

  it("blocks requests over the limit within the window", () => {
    const now = 1_000_000;
    const opts = { limit: 3, windowSeconds: 60 };
    expect(checkMemoryRateLimit("login:1.2.3.4", now, opts).allowed).toBe(true);
    expect(checkMemoryRateLimit("login:1.2.3.4", now + 100, opts).allowed).toBe(true);
    expect(checkMemoryRateLimit("login:1.2.3.4", now + 200, opts).allowed).toBe(true);
    const blocked = checkMemoryRateLimit("login:1.2.3.4", now + 300, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows requests again after the window slides", () => {
    const now = 1_000_000;
    const opts = { limit: 1, windowSeconds: 60 };
    expect(checkMemoryRateLimit("k", now, opts).allowed).toBe(true);
    expect(checkMemoryRateLimit("k", now + 1000, opts).allowed).toBe(false);
    expect(checkMemoryRateLimit("k", now + 61_000, opts).allowed).toBe(true);
  });

  it("keys are independent", () => {
    const opts = { limit: 1, windowSeconds: 60 };
    expect(checkMemoryRateLimit("a", 0, opts).allowed).toBe(true);
    expect(checkMemoryRateLimit("b", 0, opts).allowed).toBe(true);
    expect(checkMemoryRateLimit("a", 1, opts).allowed).toBe(false);
  });

  it("falls back to memory when KV fails", async () => {
    const failingKv: KvLike = {
      get: async () => {
        throw new Error("kv down");
      },
      put: async () => {
        throw new Error("kv down");
      },
    };
    const r = await enforceRateLimit(failingKv, "x", Date.now(), { limit: 2, windowSeconds: 60 });
    expect(r.allowed).toBe(true);
  });

  it("uses KV when available", async () => {
    const store = new Map<string, string>();
    const kv: KvLike = {
      get: async (k) => store.get(k) ?? null,
      put: async (k, v) => void store.set(k, v),
    };
    const opts = { limit: 2, windowSeconds: 60 };
    expect((await enforceRateLimit(kv, "y", 1000, opts)).allowed).toBe(true);
    expect((await enforceRateLimit(kv, "y", 1100, opts)).allowed).toBe(true);
    expect((await enforceRateLimit(kv, "y", 1200, opts)).allowed).toBe(false);
  });
});

describe("input validation", () => {
  it("validates display names", () => {
    expect(parseDisplayName("أحمد").ok).toBe(true);
    expect(parseDisplayName("a").ok).toBe(false);
    expect(parseDisplayName("x".repeat(100)).ok).toBe(false);
    expect(parseDisplayName(123).ok).toBe(false);
  });

  it("validates emails", () => {
    expect(parseEmail("user@example.com").ok).toBe(true);
    expect(parseEmail("USER@EXAMPLE.COM")).toEqual({ ok: true, value: "user@example.com" });
    expect(parseEmail("not-an-email").ok).toBe(false);
    expect(parseEmail("a@b").ok).toBe(false);
  });

  it("validates passwords", () => {
    expect(parsePassword("12345678").ok).toBe(true);
    expect(parsePassword("1234567").ok).toBe(false);
    expect(parsePassword("x".repeat(300)).ok).toBe(false);
  });

  it("validates durations", () => {
    expect(parseDurationMinutes(25).ok).toBe(true);
    expect(parseDurationMinutes(181).ok).toBe(false);
    expect(parseDurationMinutes("abc").ok).toBe(false);
  });

  it("sanitizes free text", () => {
    expect(sanitizeText("hello\u0000world\u001f!")).toBe("helloworld!");
    expect(sanitizeText("x".repeat(500)).length).toBe(300);
    expect(sanitizeText(null)).toBe("");
  });

  it("parses settings with sane fallbacks", () => {
    const r = parseSettings({ language: "en", soundVolume: 5, defaultDurationMinutes: 999 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.language).toBe("en");
      expect(r.value.soundVolume).toBe(1); // clamped
      expect(r.value.defaultDurationMinutes).toBe(25); // invalid → fallback
    }
  });
});
