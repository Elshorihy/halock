/**
 * Tests — Domain validation & duplicate prevention (spec §16).
 */
import { describe, expect, it } from "vitest";
import {
  findDuplicate,
  parseDomainInput,
  parseImportedDomains,
  toRouterUrlEntries,
} from "../shared/domains";

describe("domain validation & normalization", () => {
  it("accepts bare domains and normalizes them", () => {
    expect(parseDomainInput("youtube.com")).toEqual({ ok: true, domain: "youtube.com" });
    expect(parseDomainInput("YouTube.com")).toEqual({ ok: true, domain: "youtube.com" });
    expect(parseDomainInput("www.youtube.com")).toEqual({ ok: true, domain: "youtube.com" });
  });

  it("accepts full URLs and strips everything but the host", () => {
    expect(parseDomainInput("https://www.youtube.com/watch?v=abc").domain).toBe("youtube.com");
    expect(parseDomainInput("http://sub.example.co.uk/path/x").domain).toBe("sub.example.co.uk");
    expect(parseDomainInput("example.com/some/path").domain).toBe("example.com");
  });

  it("strips ports and trailing dots", () => {
    expect(parseDomainInput("example.com:8080").domain).toBe("example.com");
    expect(parseDomainInput("example.com.").domain).toBe("example.com");
  });

  it("rejects empty and invalid input", () => {
    expect(parseDomainInput("").ok).toBe(false);
    expect(parseDomainInput("   ").ok).toBe(false);
    expect(parseDomainInput("not a domain").ok).toBe(false);
    expect(parseDomainInput("http://").ok).toBe(false);
    expect(parseDomainInput("nodots").ok).toBe(false);
    expect(parseDomainInput("a".repeat(300)).ok).toBe(false);
  });

  it("rejects IP addresses", () => {
    const r = parseDomainInput("192.168.1.1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ip-not-allowed");
  });

  it("accepts multi-label and punycode domains", () => {
    expect(parseDomainInput("a.b.c.example.com").ok).toBe(true);
    const idn = parseDomainInput("مثال.مصر");
    expect(idn.ok).toBe(true);
  });

  it("detects duplicates case-insensitively with an exclude option", () => {
    const existing = [
      { id: "1", domain: "youtube.com" },
      { id: "2", domain: "facebook.com" },
    ];
    expect(findDuplicate("youtube.com", existing)?.id).toBe("1");
    expect(findDuplicate("YOUTUBE.COM", existing)?.id).toBe("1");
    expect(findDuplicate("youtube.com", existing, "1")).toBeUndefined();
    expect(findDuplicate("tiktok.com", existing)).toBeUndefined();
  });

  it("produces unique router URL entries", () => {
    const entries = toRouterUrlEntries(["youtube.com", "www.youtube.com", "YouTube.com", "x.com"]);
    expect(entries).toEqual(["youtube.com", "x.com"]);
  });
});

describe("JSON import", () => {
  it("imports a valid list and skips duplicates and invalid rows", () => {
    const json = JSON.stringify([
      { domain: "youtube.com", category: "video", enabled: true },
      { domain: "www.youtube.com", category: "video" }, // duplicate after normalization
      { domain: "not a domain", category: "other" }, // invalid
      { domain: "example.org", category: "unknown" }, // valid, category falls back
    ]);
    const result = parseImportedDomains(json);
    expect(result.ok).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({ domain: "youtube.com", category: "video", enabled: true });
    expect(result.entries[1]).toMatchObject({ domain: "example.org", category: "other", enabled: true });
    expect(result.errors).toHaveLength(2);
  });

  it("rejects non-list payloads and broken JSON", () => {
    expect(parseImportedDomains('{"a":1}').ok).toBe(false);
    expect(parseImportedDomains("{broken").ok).toBe(false);
  });
});
