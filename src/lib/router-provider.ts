/**
 * HALOCK — Router Integration Layer.
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │  RouterProvider (interface)                                       │
 * │   ├── ManualRouterProvider    — fully functional, no API needed   │
 * │   └── AutomaticRouterProvider — scaffold only, honestly disabled  │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * HARD RULES (product spec §7):
 *  - No fake API. No invented parameters. No reverse engineering.
 *  - No brute force, no credential extraction, no TR-069 tampering.
 *  - Never claim a link works without a real, reproducible test.
 *  - Router credentials are NEVER sent to or stored by HALOCK.
 */

import type {
  RouterCapabilities,
  RouterConfiguration,
  RouterConnectionStatus,
  RouterDiagnostics,
  RouterLog,
  RouterProofRequirement,
} from "@shared/types";
import type { DataSource } from "./datasource";

export interface ApplyBlockingInput {
  domains: string[];
  mode: "blacklist" | "whitelist";
  targetDevice: string | null;
}

export interface RouterProvider {
  readonly id: "manual" | "automatic";
  readonly displayName: string;
  getStatus(): Promise<RouterConnectionStatus>;
  getCapabilities(): Promise<RouterCapabilities>;
  /** Apply blocking rules. Manual mode returns "manual-delegated" — it CANNOT push rules. */
  applyBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics>;
  /** Restore previous rules. Automatic mode is unsupported; manual returns guidance. */
  restoreBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics>;
  /** Best-effort verification. Honest about uncertainty. */
  verifyBlocking(domain: string): Promise<RouterDiagnostics>;
}

export const PROOF_REQUIREMENTS: RouterProofRequirement[] = [
  {
    id: "official-api",
    title: "وجود واجهة رسمية أو موثقة للتحكم",
    titleEn: "An official or documented control interface exists",
    satisfied: false,
  },
  {
    id: "auth-method",
    title: "معرفة طريقة المصادقة المدعومة",
    titleEn: "A supported authentication method is known",
    satisfied: false,
  },
  {
    id: "readable-settings",
    title: "معرفة إعدادات Website Filter التي يمكن قراءتها",
    titleEn: "Readable Website Filter settings are known",
    satisfied: false,
  },
  {
    id: "writable-settings",
    title: "معرفة الإعدادات التي يمكن تعديلها",
    titleEn: "Writable settings are known",
    satisfied: false,
  },
  {
    id: "per-device",
    title: "إثبات إمكانية تطبيق التغييرات على جهاز محدد",
    titleEn: "Changes can be applied to a specific device (proven)",
    satisfied: false,
  },
  {
    id: "restore-test",
    title: "اختبار إعادة التغييرات بعد انتهاء الجلسة",
    titleEn: "Restoring changes after a session is tested",
    satisfied: false,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Manual mode                                                         */
/* ------------------------------------------------------------------ */

export class ManualRouterProvider implements RouterProvider {
  readonly id = "manual" as const;
  readonly displayName = "Manual Router Mode (Huawei DN8245V)";
  private ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  async getStatus(): Promise<RouterConnectionStatus> {
    const config = await this.ds.getRouterConfig();
    const steps = Object.values(config.manualSteps ?? {});
    const allDone = steps.length >= 10 && steps.every(Boolean);
    return allDone ? "manual-configured" : "manual-incomplete";
  }

  async getCapabilities(): Promise<RouterCapabilities> {
    return {
      canApplyBlocking: false, // HALOCK cannot push rules — the user applies them.
      canRestoreBlocking: false,
      canVerifyBlocking: true, // best-effort reachability check only
      evidence:
        "Huawei DN8245V firmware exposes no documented API for the Website Filter. Manual mode guides the user; it never modifies the router.",
      proofRequirements: PROOF_REQUIREMENTS.map((p) => ({ ...p })),
    };
  }

  async applyBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics> {
    await this.ds.addRouterLog({
      action: "apply-blocking",
      result: "manual-delegated",
      message: `تحويل الإعداد اليدوي للمستخدم — ${input.domains.length} موقع (${input.mode})`,
      device: input.targetDevice,
    });
    return {
      ok: true,
      operation: "apply",
      result: "manual-delegated",
      message:
        "لم يتم تغيير أي إعدادات تلقائيًا. طبّق القواعد يدويًا من صفحة الراوتر وفق قائمة الخطوات.",
      messageEn: "Nothing was changed automatically. Apply the rules manually via the router page using the checklist.",
      createdAt: nowIso(),
    };
  }

  async restoreBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics> {
    await this.ds.addRouterLog({
      action: "restore-blocking",
      result: "manual-delegated",
      message: "طلب استعادة الإعدادات يدويًا — راجع دليل الاستعادة",
      device: input.targetDevice,
    });
    return {
      ok: true,
      operation: "restore",
      result: "manual-delegated",
      message:
        "لا يمكن الاستعادة تلقائيًا. احذف قواعد HALOCK من URL Address Table يدويًا وأعد الإعدادات كما كانت.",
      messageEn: "Automatic restore is not possible. Delete HALOCK rules from the URL Address Table manually and restore previous settings.",
      createdAt: nowIso(),
    };
  }

  /**
   * Best-effort reachability check from the user's browser.
   * Limitations are stated honestly:
   *  - CORS/opaque responses mean we cannot be certain → "unverified".
   *  - A network error suggests blocking OR an offline device → reported accordingly.
   */
  async verifyBlocking(domain: string): Promise<RouterDiagnostics> {
    const normalizedDomain = domain.trim().toLowerCase();
    const validDomain =
      normalizedDomain.length <= 253 &&
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizedDomain);

    if (!validDomain) {
      return {
        ok: false,
        operation: "verify",
        result: "error",
        message: "اكتب اسم نطاق صحيحًا مثل youtube.com.",
        messageEn: "Enter a valid domain name, for example youtube.com.",
        createdAt: nowIso(),
      };
    }

    const testUrl = `https://${normalizedDomain}/favicon.ico`;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return {
        ok: false,
        operation: "verify",
        result: "unverified",
        message: "لا يوجد اتصال بالإنترنت — لا يمكن إجراء الاختبار.",
        messageEn: "No internet connection — the test cannot run.",
        createdAt: nowIso(),
      };
    }

    let result: RouterDiagnostics["result"] = "unverified";
    let message = "تعذر التحقق من حالة الحجب.";
    let messageEn = "Could not verify the blocking state.";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      await fetch(testUrl, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      // A resolved no-cors request suggests reachability, but is not proof.
      result = "likely-reachable";
      message = "استجاب طلب الاختبار؛ يبدو أن الموقع متاح، لكن الاختبار ليس إثباتًا نهائيًا.";
      messageEn = "The probe completed; the site appears reachable, but this is not definitive proof.";
    } catch {
      // A failed request is ambiguous: router block, DNS, TLS, timeout, or network failure.
      // Never label it blocked without a router-side read-back or target-device test.
      result = "unverified";
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        message = "انقطع اتصال الإنترنت أثناء الاختبار — الحالة غير مؤكدة.";
        messageEn = "The internet connection dropped during the test — status is unverified.";
      } else {
        message = "فشل الاتصال، لكن لا يمكن الجزم أن الراوتر هو الذي حجب الموقع.";
        messageEn = "The connection failed, but this does not prove the router blocked the site.";
      }
    } finally {
      clearTimeout(timer);
    }

    await this.ds.addRouterLog({
      action: "verify-blocking",
      result,
      message: `اختبار ${normalizedDomain}: ${message}`,
      device: null,
    });

    return {
      ok: result === "likely-reachable",
      operation: "verify",
      result,
      message,
      messageEn,
      createdAt: nowIso(),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Automatic mode — scaffold only, honestly unsupported                */
/* ------------------------------------------------------------------ */

export class AutomaticRouterProvider implements RouterProvider {
  readonly id = "automatic" as const;
  readonly displayName = "Automatic Router Mode (Huawei DN8245V)";
  private ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  async getStatus(): Promise<RouterConnectionStatus> {
    return "unsupported";
  }

  async getCapabilities(): Promise<RouterCapabilities> {
    return {
      canApplyBlocking: false,
      canRestoreBlocking: false,
      canVerifyBlocking: false,
      evidence:
        "غير مدعوم حاليًا — يحتاج إلى تحقق من Firmware الراوتر. لا يتوفر API موثق للتحكم في Website Filter في Huawei DN8245V، ولن يدّعي HALOCK ربطًا لا يمكن إثباته.",
      proofRequirements: PROOF_REQUIREMENTS.map((p) => ({ ...p })),
    };
  }

  async applyBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics> {
    await this.ds.addRouterLog({
      action: "apply-blocking",
      result: "not-supported",
      message: "محاولة استخدام الوضع التلقائي — غير مدعوم حاليًا",
      device: input.targetDevice,
    });
    return {
      ok: false,
      operation: "apply",
      result: "not-supported",
      message: "غير مدعوم حاليًا — يحتاج إلى تحقق من Firmware الراوتر.",
      messageEn: "Currently unsupported — requires router firmware verification.",
      createdAt: nowIso(),
    };
  }

  async restoreBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics> {
    await this.ds.addRouterLog({
      action: "restore-blocking",
      result: "not-supported",
      message: "استعادة تلقائية غير مدعومة حاليًا",
      device: input.targetDevice,
    });
    return {
      ok: false,
      operation: "restore",
      result: "not-supported",
      message: "غير مدعوم حاليًا — يحتاج إلى تحقق من Firmware الراوتر.",
      messageEn: "Currently unsupported — requires router firmware verification.",
      createdAt: nowIso(),
    };
  }

  async verifyBlocking(): Promise<RouterDiagnostics> {
    return {
      ok: false,
      operation: "verify",
      result: "unverified",
      message: "تعذر التحقق من حالة الحجب — الوضع التلقائي غير مدعوم.",
      messageEn: "Could not verify blocking state — automatic mode is unsupported.",
      createdAt: nowIso(),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Factory + helpers                                                   */
/* ------------------------------------------------------------------ */

export function createRouterProvider(
  mode: "manual" | "automatic",
  ds: DataSource,
): RouterProvider {
  return mode === "automatic" ? new AutomaticRouterProvider(ds) : new ManualRouterProvider(ds);
}

export interface RouterSetupStep {
  id: string;
  key: keyof RouterConfiguration["manualSteps"];
  text: string;
}

/** The 10-step manual setup wizard (spec §7). */
export const MANUAL_STEPS: { id: string; ar: string; en: string }[] = [
  { id: "s1", ar: "افتح صفحة إعدادات الراوتر (عادة 192.168.1.1) وسجّل الدخول بنفسك.", en: "Open the router settings page (usually 192.168.1.1) and log in yourself." },
  { id: "s2", ar: "انتقل إلى Parental Control أو Website Filter.", en: "Go to Parental Control or Website Filter." },
  { id: "s3", ar: "اختر Apply on specified devices.", en: "Choose Apply on specified devices." },
  { id: "s4", ar: "حدد الجهاز المطلوب من Device Table.", en: "Select the target device from the Device Table." },
  { id: "s5", ar: "فعّل Website Filter (Enable Website Filter).", en: "Enable Website Filter." },
  { id: "s6", ar: "اختر Blacklist.", en: "Choose Blacklist." },
  { id: "s7", ar: "أضف المواقع المطلوبة إلى URL Address Table من قائمة HALOCK.", en: "Add the required sites to the URL Address Table from your HALOCK list." },
  { id: "s8", ar: "احفظ التغييرات.", en: "Save the changes." },
  { id: "s9", ar: "جرّب فتح موقع محجوب من الجهاز المحدد للتأكد.", en: "Try opening a blocked site from the target device to verify." },
  { id: "s10", ar: "احفظ صورة أو ملاحظة للإعدادات السابقة قبل أي تغيير.", en: "Keep a screenshot or note of your previous settings before any change." },
];

export type { RouterLog, RouterConfiguration, RouterCapabilities, RouterDiagnostics, RouterConnectionStatus };
