/**
 * HALOCK — Domain validation & normalization.
 *
 * Rules (from product spec):
 *  - Accept a bare domain or a full URL.
 *  - Normalize before saving (lowercase, strip protocol/path/port, drop "www.").
 *  - Reject invalid input, prevent duplicates (case-insensitive).
 */

import type { BlockedDomain, DomainCategory } from "./types";

export interface DomainParseResult {
  ok: boolean;
  domain?: string;
  error?: "empty" | "invalid" | "too-long" | "ip-not-allowed" | "reserved";
  message?: string;
}

const DOMAIN_RE =
  /^(?:[a-z0-9\u0600-\u06FF](?:[a-z0-9\u0600-\u06FF-]{0,61}[a-z0-9\u0600-\u06FF])?\.)+[a-z\u0600-\u06FF]{2,63}$/i;

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function punycodeHost(host: string): string {
  // URL constructor already converts IDN hosts to punycode (xn--...).
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.toLowerCase();
  }
}

/**
 * Parse user input into a normalized registrable host.
 * Examples:
 *   "https://www.YouTube.com/watch?v=x" -> "youtube.com"
 *   "sub.example.co.uk"                 -> "sub.example.co.uk"
 *   "youtube.com/"                      -> "youtube.com"
 */
export function parseDomainInput(raw: string): DomainParseResult {
  const input = (raw ?? "").trim();
  if (!input) {
    return { ok: false, error: "empty", message: "أدخل اسم نطاق صالح مثل youtube.com" };
  }
  if (input.length > 253) {
    return { ok: false, error: "too-long", message: "النطاق طويل جدًا" };
  }

  let host = input;
  // If it looks like a URL, extract the hostname.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) || input.includes("/")) {
    try {
      const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
        ? input
        : `http://${input}`;
      const url = new URL(withProtocol);
      host = url.hostname;
    } catch {
      return { ok: false, error: "invalid", message: "صيغة غير صالحة — استخدم نطاقًا مثل example.com" };
    }
  }

  host = host.trim().toLowerCase();
  // Strip a trailing dot and any port leftovers.
  host = host.replace(/\.$/, "");
  if (host.includes(":")) host = host.split(":")[0];
  // Strip credentials if someone pasted user:pass@host.
  if (host.includes("@")) host = host.split("@").pop() ?? host;
  // Drop leading "www." for a cleaner rule set.
  if (host.startsWith("www.")) host = host.slice(4);

  if (!host) {
    return { ok: false, error: "empty", message: "أدخل اسم نطاق صالح مثل youtube.com" };
  }
  if (IPV4_RE.test(host)) {
    return {
      ok: false,
      error: "ip-not-allowed",
      message: "عناوين IP غير مدعومة — استخدم اسم نطاق",
    };
  }

  const normalized = punycodeHost(host);

  if (!DOMAIN_RE.test(normalized) && !normalized.startsWith("xn--") && !normalized.split(".").some((l) => l.startsWith("xn--"))) {
    // Allow fully punycode hosts even if our unicode regex misses them.
    const punyOnly = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    if (!punyOnly.test(normalized)) {
      return {
        ok: false,
        error: "invalid",
        message: "صيغة نطاق غير صالحة — مثال صحيح: example.com",
      };
    }
  }

  const labels = normalized.split(".");
  if (labels.length < 2 || labels.some((l) => l.length === 0 || l.length > 63)) {
    return {
      ok: false,
      error: "invalid",
      message: "صيغة نطاق غير صالحة — مثال صحيح: example.com",
    };
  }

  return { ok: true, domain: normalized };
}

/** Case-insensitive duplicate detection against an existing list. */
export function findDuplicate(
  domain: string,
  existing: Pick<BlockedDomain, "domain">[],
  excludeId?: string,
): BlockedDomain | undefined {
  const target = domain.toLowerCase();
  return (existing as BlockedDomain[]).find(
    (d) => d.domain.toLowerCase() === target && d.id !== excludeId,
  );
}

export const DOMAIN_CATEGORIES: DomainCategory[] = ["social", "video", "gaming", "other"];

/** Default starter list — editable and removable by the user (never forced). */
export const DEFAULT_DOMAINS: { domain: string; category: DomainCategory }[] = [
  { domain: "youtube.com", category: "video" },
  { domain: "facebook.com", category: "social" },
  { domain: "instagram.com", category: "social" },
  { domain: "tiktok.com", category: "social" },
  { domain: "x.com", category: "social" },
  { domain: "twitter.com", category: "social" },
  { domain: "netflix.com", category: "video" },
  { domain: "twitch.tv", category: "gaming" },
];

/**
 * Router rules only need hostnames — nothing else survives normalization.
 * This is exactly what we hand to the router's URL Address Table.
 */
export function toRouterUrlEntries(domains: string[]): string[] {
  return [...new Set(domains.map((d) => parseDomainInput(d).domain ?? d.toLowerCase()))];
}

/** Parse an exported JSON list (import). Returns valid entries + errors. */
export function parseImportedDomains(
  json: unknown,
): { ok: boolean; entries: { domain: string; category: DomainCategory; enabled: boolean }[]; errors: string[] } {
  const errors: string[] = [];
  const entries: { domain: string; category: DomainCategory; enabled: boolean }[] = [];
  let list: unknown = json;

  if (typeof json === "string") {
    try {
      list = JSON.parse(json);
    } catch {
      return { ok: false, entries, errors: ["ملف JSON غير صالح"] };
    }
  }
  if (!Array.isArray(list)) {
    return { ok: false, entries, errors: ["يجب أن يكون الملف قائمة (Array)"] };
  }

  const seen = new Set<string>();
  list.forEach((item, index) => {
    const record = item as { domain?: unknown; category?: unknown; enabled?: unknown };
    const rawDomain = typeof record?.domain === "string" ? record.domain : "";
    const parsed = parseDomainInput(rawDomain);
    if (!parsed.ok || !parsed.domain) {
      errors.push(`عنصر ${index + 1}: ${parsed.message ?? "نطاق غير صالح"}`);
      return;
    }
    if (seen.has(parsed.domain)) {
      errors.push(`عنصر ${index + 1}: نطاق مكرر (${parsed.domain})`);
      return;
    }
    seen.add(parsed.domain);
    const category = (DOMAIN_CATEGORIES as string[]).includes(String(record.category))
      ? (record.category as DomainCategory)
      : "other";
    entries.push({
      domain: parsed.domain,
      category,
      enabled: record.enabled !== false,
    });
  });

  return { ok: entries.length > 0, entries, errors };
}
