# HALOCK — اقفل المشتتات. افتح تركيزك.

> **Lock the distractions. Open your focus.**

HALOCK هو تطبيق ويب (PWA) متكامل لجلسات التركيز، إدارة المواقع المشتتة، المهام، والإحصائيات — مع طبقة تكامل صادقة لأجهزة الراوتر (Huawei DN8245V) لحجب المواقع على مستوى الشبكة.

> **قاعدة أساسية مطبّقة في كل سطر من المشروع:** لا أزرار وهمية، لا تكامل مُختلق، لا رسائل نجاح كاذبة. أي وظيفة غير مدعومة تُعرض بوضوح: «غير مدعوم حاليًا» أو «تعذر التحقق».

---

## 📦 ما الذي يحتويه المشروع

| المجلد | الوصف |
|---|---|
| `src/` | الواجهة الأمامية (React + TypeScript + Vite + Tailwind + Framer Motion + Lucide) |
| `shared/` | منطق مشترك بين الواجهة والخادم والاختبارات (Timer، Domains، Stats، Validation، Session Rules) |
| `worker/` | خلفية Cloudflare Workers + D1 (REST API، مصادقة، عزل بيانات، Rate Limiting) |
| `tests/` | 95 اختبارًا حقيقيًا (Vitest) |
| `public/` | PWA Manifest + Service Worker + الأيقونات |
| `docs/` | توثيق النشر، الراوتر، متغيرات البيئة، اختبارات يدوية، إضافة Router API |

## 🚀 التشغيل السريع

```bash
# 1) تثبيت الاعتماديات
npm install

# 2) التشغيل محليًا (الواجهة تعمل بدون خادم — وضع محلي كامل ببيانات localStorage)
npm run dev            # http://localhost:5173

# 3) الاختبارات
npm test               # 95 اختبارًا

# 4) البناء
npm run build          # dist/

# 5) خادم الـ Worker محليًا (اختياري — يحتاج wrangler)
npm run worker:dev     # http://localhost:8787  (يعمل /api + ملفات dist)
```

> **بدون نشر الخادم:** يعمل HALOCK بالكامل في «وضع محلي» — الجلسات، المهام، المواقع، الإحصائيات، ودليل الراوتر كلها تعمل فعليًا وتُحفظ في المتصفح، مع شارة واضحة `وضع محلي` في الواجهة. لا يُدّعي التطبيق أي مزامنة.

## ☁️ النشر على Cloudflare

راجع [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) خطوة بخطوة. الملخص:

```bash
npm install -g wrangler   # أو عبر devDependency
npx wrangler login
npx wrangler d1 create halock-db          # انسخ database_id إلى worker/wrangler.toml
npx wrangler d1 execute halock-db --file=worker/db/schema.sql
npm run deploy                            # بناء + رفع Worker + Assets
```

## 🧩 الميزات المنفذة فعليًا

- ✅ **Dashboard**: حالة تركيز حيّة، الوقت المتبقي، نسبة التقدم، عدد المواقع، حالة الراوتر، ملخص اليوم، الوصول السريع.
- ✅ **مؤشر جلسات حقيقي**: مدد 25/50/60/90/120 + مخصص (1–180)، محسوب من timestamps (يتحمل تحديث الصفحة/إغلاق المتصفح/انقطاع الإنترنت)، بدون Pause أو إنهاء مبكر، شاشة تأكيد قبل البدء، شاشة إتمام، منع التسجيل المزدوج.
- ✅ **إدارة المواقع**: إضافة/تعديل/حذف/تفعيل، تصنيفات، بحث، استيراد وتصدير JSON، منع التكرار، توحيد الدومينات، Blacklist/Whitelist مع تحذير.
- ✅ **المهام**: CRUD كامل، أولويات، مواعيد، ربط بالجلسات.
- ✅ **الإحصائيات**: إجماليات، متوسطات، أفضل جلسة، رسم 7 أيام (SVG خفيف)، سجل الجلسات، فلاتر (يوم/7/30).
- ✅ **تكامل الراوتر**: Manual Mode كامل (10 خطوات تفاعلية + اختبار حجب + سجل عمليات + دليل استرداد)، Automatic Mode كطبقة جاهزة بحالة **«غير مدعوم حاليًا — يحتاج إلى تحقق من Firmware»** مع متطلبات الإثبات الستة.
- ✅ **الحسابات**: تسجيل/دخول (PBKDF2)، تشفير كامل، عزل بيانات صارم، حذف الحساب.
- ✅ **PWA**: Manifest، Service Worker (shell offline، API لا يُخزَّن أبدًا)، تثبيت كتطبيق.
- ✅ **الإعدادات**: اللغة (عربي RTL/إنجليزي)، المظهر (داكن/فاتح حقيقي)، الصوت، المؤقت، الإشعارات، تصدير البيانات، منطقة الخطر.
- ✅ **الأمان**: لا كلمات مرور في Logs، لا بيانات راوتر حساسة، لا Secrets في الواجهة، تحقق من كل المدخلات، Rate Limiting، رؤوس أمان.

## ❌ ما لم يُنفَّذ (والأسباب الصادقة)

| الميزة | السبب |
|---|---|
| الحجب التلقائي للراوتر (Automatic Mode) كوظيفة عاملة | لا يتوفر API موثق للـ Website Filter في Huawei DN8245V. المشروع يرفض اختراع تكامل — الوضع معطّل صراحة مع متطلبات الإثبات. راجع `docs/ROUTER_API_EXTENSION.md` |
| منع فتح تبويب جديد داخل المتصفح | مستحيل من Web App عادية (قيود أمان المتصفحات) — مذكور بصراحة في الواجهة |
| ضمان الحجب 100% من داخل الصفحة | الحجب الفعلي يتم على الراوتر/النظام؛ موقع الويب يقدم الأدوات والتحقق المؤشر فقط |
| مزامنة سحابية في الوضع المحلي | لا خادم مُنشر — الوضع المحلي يعمل بلا حساب وبصراحة عن ذلك |

## 📚 التوثيق

| المستند | المحتوى |
|---|---|
| [docs/ENV_VARS.md](docs/ENV_VARS.md) | متغيرات البيئة والأسرار |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | النشر على Cloudflare خطوة بخطوة |
| [docs/ROUTER_SETUP.md](docs/ROUTER_SETUP.md) | إعداد Huawei DN8245V يدويًا + الاسترداد |
| [docs/ROUTER_API_EXTENSION.md](docs/ROUTER_API_EXTENSION.md) | كيفية إضافة Router API تلقائيًا لاحقًا |
| [docs/ROUTER_FIRMWARE_FINDINGS.md](docs/ROUTER_FIRMWARE_FINDINGS.md) | نتائج فحص Firmware DN8245V وحدود التحكم الآمن بجهاز واحد |
| [tools/huawei-local-bridge/README.md](tools/huawei-local-bridge/README.md) | إضافة متصفح محلية لاكتشاف أجهزة الراوتر (قراءة فقط) |
| [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) | سيناريوهات الاختبار اليدوي (10 حالات فشل + الراوتر) |
| [docs/TESTS.md](docs/TESTS.md) | قائمة الاختبارات ونتائجها |

## 🧪 الاختبارات

```bash
npm test
```

**95 اختبارًا — كلها ناجحة** يغطون: حسابات المؤقت، استمرارية الجلسات، منع التسجيل المزدوج، تحقق الدومينات، منع التكرار، CRUD المهام، حسابات الإحصائيات، التشفير والمصادقة، عزل بيانات المستخدمين، سلوك مزود الراوتر، معالجة الفشل والاسترداد. التفاصيل في [`docs/TESTS.md`](docs/TESTS.md).

## 🏗️ البنية التقنية

```
React 18 + TypeScript + Vite 6 + Tailwind CSS 3 + Framer Motion + Lucide
        ↕  DataSource abstraction (Remote ⇄ Local)
Cloudflare Workers + D1 (+ KV اختياري للـ Rate Limiting) + Static Assets
```

- **Timer Engine**: `shared/timer.ts` — كل القيم محسوبة من timestamps.
- **Router Integration Layer**: `src/lib/router-provider.ts` — `RouterProvider` / `ManualRouterProvider` / `AutomaticRouterProvider` / `RouterCapabilities` / `RouterDiagnostics`.
- **قاعدة البيانات**: `users`, `auth_sessions`, `focus_sessions`, `tasks`, `blocked_domains`, `user_settings`, `router_settings`, `router_logs`.

## 📄 الرخصة

مشروع شخصي — استخدمه كما يناسبك.
