# دليل إضافة Router API تلقائيًا لاحقًا — HALOCK

> هذا المستند هو المخطط المرجعي لتفعيل **AutomaticRouterProvider** عندما (وإن) يتوفر API موثق ومُختبر للراوتر. أي تنفيذ مستقبلي يجب أن يستوفي **متطلبات الإثبات الستة** كاملة قبل أن يرفع حالة الوضع التلقائي من «غير مدعوم».

## البنية الحالية (جاهزة للتوسعة)

```
src/lib/router-provider.ts
├── RouterProvider (interface)
│   ├── getStatus(): Promise<RouterConnectionStatus>
│   ├── getCapabilities(): Promise<RouterCapabilities>
│   ├── applyBlocking(input): Promise<RouterDiagnostics>
│   ├── restoreBlocking(input): Promise<RouterDiagnostics>
│   └── verifyBlocking(domain): Promise<RouterDiagnostics>
├── ManualRouterProvider        — يعمل بالكامل اليوم
└── AutomaticRouterProvider     — scaffold: كل الدوال تُرجع not-supported بصراحة
```

الواجهة الأمامية تستهلك الواجهة فقط — استبدال المزود لا يمسّ بقية التطبيق.

## متطلبات الإثبات الستة (شرط تفعيل الأوتوماتيكية)

| # | المتطلب | كيف تُثبته | أين تحدّثه |
|---|---|---|---|
| 1 | وجود واجهة رسمية أو موثقة للتحكم | وثائق المصنّع / واجهة معلنة (مثل REST/TR-069 vendor extension موثق) | `PROOF_REQUIREMENTS[0].satisfied = true` + `RouterCapabilities.evidence` |
| 2 | معرفة طريقة المصادقة المدعومة | توثيق رسمي لطريقة الدخول (session cookie, token…) **بدون** هندسة عكسية أو كسر حماية | كود `AutomaticRouterProvider.authenticate()` |
| 3 | معرفة إعدادات Website Filter القابلة للقراءة | قراءة فعلية للقواعد الحالية عبر الواجهة | `readCurrentRules()` |
| 4 | معرفة الإعدادات القابلة للتعديل | توثيق الحقول المسموح بكتابتها **بالأسماء الحقيقية من التوثيق** (لا اختراع أسماء parameters) | `applyBlocking()` |
| 5 | إثبات التطبيق على جهاز محدد | اختبار حقيقي: قاعدة على `targetDevice` تُطبق وتظهر في جدول الأجهزة | `applyBlocking()` + سجل `router_logs` |
| 6 | اختبار الاستعادة بعد الجلسة | تغيير ← استعادة ← التحقق أن الحالة عادت كما كانت | `restoreBlocking()` |

## ممنوعات صارمة (لا تكسرها أبدًا)

- ❌ لا API وهمي أو mock في الإنتاج.
- ❌ لا اختراع أسماء parameters.
- ❌ لا افتراض أن TR-069 يسمح بتعديل Website Filter دون توثيق.
- ❌ لا Reverse Engineering لتجاوز حماية الراوتر.
- ❌ لا Brute Force لبيانات الاعتماد.
- ❌ لا استخراج كلمات مرور من ملفات إعدادات الراوتر.
- ❌ لا تعديل إعدادات TR-069 الخاصة بمزود الإنترنت.
- ❌ لا ادعاء نجاح ربط لم يُختبر فعليًا.
- ❌ لا إرسال أو تخزين بيانات اعتماد الراوتر في خوادم HALOCK (وإن لزم تخزين token مؤقت فعلى الجهاز فقط).

## خطة التنفيذ المقترحة (عند توفّر التوثيق)

### الخطوة 1 — توثيق الواجهة
أنشئ `docs/ROUTER_API_RESEARCH.md` يوثّق:
- نوع الواجهة (REST/SOAP/UPnP/TR-069 vendor extension…).
- نقاط النهاية (endpoints) الحقيقية **من التوثيق**.
- طريقة المصادقة ودورة حياة الجلسة.
- الحقول الفعلية لجدول Website Filter (Blacklist/Whitelist, URL Address Table, Device Table).

### الخطوة 2 — تنفيذ المزود
في `src/lib/router-provider.ts` (أو `src/lib/router-providers/auto-<vendor>.ts`):

```ts
export class Dn8245vAutoProvider implements RouterProvider {
  readonly id = "automatic";

  async applyBlocking(input: ApplyBlockingInput): Promise<RouterDiagnostics> {
    // 1) authenticate() — من توثيق المزود فقط
    // 2) readCurrentRules() — احفظ القواعد السابقة للاستعادة (غير قواعد HALOCK فقط)
    // 3) pushRules() — أضف قواعد HALOCK فقط، لا تستبدل الجدول كاملًا
    // 4) verifyRules() — اقرأ القواعد للتأكد أنها طُبّقت
    // 5) سجّل النتيجة في router_logs — نجاح حقيقي فقط = "applied"
    // أي غموض ← result: "unverified" ورسالة "تعذر التحقق من حالة الحجب"
  }

  async restoreBlocking(): Promise<RouterDiagnostics> {
    // احذف قواعد HALOCK فقط ← تحقق ← سجّل النتيجة
  }
}
```

### الخطوة 3 — الربط مع دورة الجلسة
`shared/session-logic.ts` يدعم هذا مسبقًا:
- `planBlocking({..., automaticBlockingAvailable: true})` → `blockingStatus: "applied"` **فقط** بعد نجاح التحقق الفعلي في `applyBlocking`.
- عند انتهاء الجلسة: `restoreBlocking()` تُستدعى وتُسجَّل نتيجتها.
- أي فشل ← `blockingStatus: "not-applied"` أو `"unverified"` — لا رسائل نجاح كاذبة أبدًا.

### الخطوة 4 — الاختبارات الإلزامية قبل التفعيل
أضف إلى `tests/router-provider.test.ts`:
- apply يضيف قواعد HALOCK فقط (لا يمسّ قواعد المستخدم).
- restore يزيل قواعد HALOCK فقط ويعيد الحالة.
- فشل الشبكة أثناء apply ← `not-applied` + سجل.
- ضغط متزامن (جلستان) ← رفض الثاني.
- التحقق من الجهاز المحدد (per-device) لا "all devices" بالخطأ.

### الخطوة 5 — تفعيل
1. ارفع `PROOF_REQUIREMENTS[*].satisfied = true` مع روابط التوثيق في `evidence`.
2. في `AutomaticRouterProvider.getCapabilities()` عدّل `canApplyBlocking/canRestoreBlocking/canVerifyBlocking` إلى `true` **فقط** إذا نجحت اختبارات الخطوة 4.
3. وثّق في README: «التكامل التلقائي مدعوم للإصدار X من Firmware مع رابط التوثيق».

## آلية التحقق الصادقة (verifyBlocking)

التحقق من داخل المتصفح محدود (CORS يجعل الردود opaque). الخيارات الموثوقة للإصدار التلقائي:
1. **القراءة من الراوتر**: الواجهة تُرجع القواعد الحالية → مقارنتها بالقواعد المطلوبة (أفضل إثبات).
2. **اختبار شبكي من الخادم** (لا ينطبق حاليًا على Workers بسبب عدم وجود شبكة محلية).
3. **اختبار من الجهاز المستهدف** يدويًا → تأكيد المستخدم خطوة أخيرة.

إذا تعذّر التحقق: «تعذر التحقق من حالة الحجب» — لا «تم الحجب بنجاح».
