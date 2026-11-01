# متغيرات البيئة — HALOCK

## الواجهة الأمامية (Vite)

لا توجد أسرار في الواجهة إطلاقًا. لا يُقرأ أي `import.meta.env.VITE_*` سري في المشروع — كل ما تحتاجه الواجهة هو مسار الـ API (`/api`) النسبي.

| المتغير | الوصف | الافتراضي |
|---|---|---|
| *(لا شيء مطلوب)* | الواجهة تعمل بدون أي متغيرات | — |

## خلفية Cloudflare Worker

| المتغير | النوع | الوصف | الافتراضي |
|---|---|---|---|
| `DB` | D1 Binding | قاعدة بيانات D1 (جدول `halock-db`) | مطلوب |
| `ASSETS` | Assets Binding | مجلد `dist` للواجهة (SPA fallback) | مطلوب للنشر الموحد |
| `RATE_LIMIT` | KV Binding *(اختياري)* | تخزين عدادات Rate Limiting مشترك بين العزلات | بدونه يعمل حدّ في الذاكرة لكل عزلة (موثّق بصراحة) |
| `ALLOWED_ORIGIN` | Variable | الأصل المسموح به للاستدعاءات (CORS) | `*` (غيّره للإنتاج) |
| `SESSION_TTL_DAYS` | Variable | مدة صلاحية الجلسة بالأيام | `30` |
| `SESSION_SECRET` | **Secret** | ملح إضافي (pepper) لتشفير التوكنات — موصى به | بدونه يُستخدم SHA-256 وحده |

## إعداد الأسرار (لا تُكتب في الكود أبدًا)

```bash
npx wrangler secret put SESSION_SECRET
# أدخل سلسلة طويلة عشوائية — لن تُعرض مرة أخرى
```

للتطوير المحلي: انسخ `worker/.dev.vars.example` إلى `worker/.dev.vars`:

```bash
cp worker/.dev.vars.example worker/.dev.vars
# ثم عدّل SESSION_SECRET=...
```

> ⚠️ `worker/.dev.vars` و`wrangler.toml` المحدَّث بـ `database_id` الخاص بك لا يُرفعان إلى المستودع (.gitignore يمنعهما).

## ملاحظات أمنية

1. **كلمات مرور المستخدمين**: PBKDF2-SHA256 (150k iteration + salt عشوائي) — لا تُخزَّن كنص صريح أبدًا.
2. **توكنات الجلسات**: يُخزَّن SHA-256 hash فقط (مع `SESSION_SECRET` إن وُجد).
3. **بيانات الراوتر**: لا يقبل الخادم أي بيانات اعتماد للراوتر إطلاقًا — لا اسم مستخدم ولا كلمة مرور.
4. **Rate Limiting**: على `/auth/register` و`/auth/login` (5 محاولات/5 دقائق لكل IP) و`/sessions` (10/دقيقة لكل مستخدم).
