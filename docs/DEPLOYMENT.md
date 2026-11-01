# النشر على Cloudflare — HALOCK

المشروع مصمَّم للنشر كـ **Worker واحد** يخدم الواجهة (`dist/`) والـ API (`/api/*`) من نفس الأصل — بدون مشاكل CORS.

## المتطلبات

- حساب Cloudflare مجاني (Workers Free Plan يكفي للوظائف الأساسية).
- Node.js 20+.
- `wrangler` (مثبَّت في devDependencies).

## الخطوات

### 1) تسجيل الدخول

```bash
cd halock
npx wrangler login
```

### 2) إنشاء قاعدة D1

```bash
npx wrangler d1 create halock-db
```

سيُطبع معرّف قاعدة البيانات. انسخه إلى `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "halock-db"
database_id = "المعرّف_الذي_ظهر_لديك"
```

### 3) تطبيق مخطط قاعدة البيانات

```bash
# بيئة التطوير المحلية (wrangler dev):
npx wrangler d1 execute halock-db --local --file=worker/db/schema.sql

# بيئة الإنتاج:
npx wrangler d1 execute halock-db --file=worker/db/schema.sql
```

### 4) تعيين الأسرار (موصى به)

```bash
npx wrangler secret put SESSION_SECRET
```

### 5) (اختياري) إنشاء KV لتحديد المعدل المشترك

```bash
npx wrangler kv namespace create RATE_LIMIT
```

ثم فكّ التعليق على قسم `[[kv_namespaces]]` في `worker/wrangler.toml` وضع المعرّف.

### 6) البناء والنشر

```bash
npm run deploy
```

هذا يشغّل `npm run build` (tsc + vite) ثم `wrangler deploy` الذي يرفع:
- `worker/index.ts` كـ Worker
- `dist/` كـ Static Assets (SPA fallback مفعّل)

### 7) التحقق

```bash
curl https://YOUR-WORKER.workers.dev/api/health
# → {"ok":true,"service":"halock-api","time":...}
```

ثم افتح `https://YOUR-WORKER.workers.dev/` — يجب أن تعمل الواجهة، وعند تسجيل الدخول تتحول الشارة من `وضع محلي` إلى الوضع البعيد.

## بيئة التطوير المحلية مع الخادم

```bash
# طرفية 1: الـ Worker (يقدم /api + dist إن وُجد)
npm run worker:dev

# طرفية 2: Vite (يعيد توجيه /api إلى 8787)
npm run dev
```

## استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| `401 غير مصرّح` على كل الطلبات | انتهت صلاحية الجلسة — سجّل الدخول من جديد |
| الواجهة تعرض `وضع محلي` رغم النشر | تأكد أن `/api/health` يعمل على نفس الأصل |
| `database_id` غير موجود | تأكد من نسخ المعرّف الصحيح في `wrangler.toml` |
| الأصول (assets) 404 | تأكد أن `npm run build` أُنفّذ وأن `directory = "./dist"` |

## متطلبات المنصات

- يعمل على: Android (Chrome/Samsung Internet)، iOS Safari، أجهزة لوحية، حاسوب.
- PWA: التثبيت متاح عند دعم المتصفح (beforeinstallprompt).
- HTTPS مفعّل افتراضيًا على نطاقات `workers.dev` وعبر أي نطاق مخصص.
