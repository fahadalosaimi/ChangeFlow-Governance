# Phase 2 / Batch A / A1 — تصميم الهوية وترحيل البيانات

الحالة: A1 فقط، على فرع `feature/phase2-batch-a-tenant-security`.
خط الأساس: `10faab20b1c61b5476165bbc1f5d28a2a85e2652`.

## حدود التنفيذ

يشمل A1 Models وMigrations وفحوص حفظ البيانات واختبارات Database وHTTP
لحدود الصلاحيات الموجودة. لا ينفذ Tenant Context أوLogin الجديد أوInvitations
أوBootstrap أوتغييرات واجهة المستخدم. البنود التالية عقود تنفيذ للمجموعات اللاحقة.

لا تطبق هذه Migrations على قاعدة فعلية ضمن هذه المهمة. الـSchema النهائية غير
متوافقة مع التطبيق القديم وحده؛ لا يُنشر الفرع ولا يُفعّل `create_all()` كبديل
للترحيل. اكتمال Multi-Tenant Isolation يتطلب Batch B لعزل Risk Rules، وBatch C
لحوكمة الموافقات، إضافة إلى إتمام بقية Batch A.

## Authentication وTenant Context — عقد A2

- الحساب Tenant-local: يبقى `users.id` ثابتًا، وتحدد `organization_id` عضويته.
- Login يتطلب `tenant_slug` وEmail وPassword. الـSlug يساعد في اختيار الحساب
  فقط؛ لا يمنح وصولًا بعد المصادقة ولا توجد واجهة لتبديل مؤسسة الحساب.
- فشل المؤسسة أوالحساب أوPassword أوحالة الوصول ينتج رسالة `401` عامة واحدة.
  معالجة فرق زمن المصادقة واختبار عدم تعداد الحسابات جزء من A2.
- JWT الجديدة تتضمن `sub`, `tid`, `ver=2`, `exp`. ترفض النسخة الجديدة Tokens
  القديمة دون `ver=2` وتطلب Login مرة أخرى؛ لا تغير Password Hashes.
- تبقى مدة Access Token من الإعداد المعتمد (حاليًا 120 دقيقة افتراضيًا)،
  دون تمديد ضمني عند الانتقال. لا يدعي A1 تنفيذ Session Revocation.
- تشتق الصلاحيات في كل طلب من Database: الحساب فعال وRole وDepartment ضمن
  المؤسسة، و`tid` يطابق العضوية. Role Claim وحدها ليست مرجع Authorization.
- يرفض Backend تغيير Tenant عبر Body أوQuery أوHeader. تكون Service Context
  إلزامية في A2/A4 مع ضبط Lists وCounts وNested Resources والحقول الحساسة.
- لا يُرقّى أي دور Legacy غير معروف ولا تضاف صلاحية Super Admin.

## Invitations وBootstrap — عقد A3

- لا ينشأ Tenant أوأول Administrator من Public API. Bootstrap إجراء تشغيلي
  مصرح على CLI منفصلة، ويحتاج Manifest مراجعة وAuthorization Reference
  غير سرية وهدفًا صريحًا. لا يعمل باختيار أول مؤسسة.
- تقيد CLI بهوية تشغيل مخولة وصلاحيات Database لازمة فقط، دون Passwords في
  argv أوLogs، ودون إعادة ضبط Password أوRole لحساب موجود. مصدر الأسرار
  Runtime Secret Store أوFD/إدخال محمي، وليس ملفات Demo أوCredentials ثابتة.
- `bootstrap_authorization_id` مرجع للتدقيق، وليس دليل تفويض بذاته؛ على A3
  التحقق من تفويض المشغل. Constraints وحدها لا تؤمن CLI أوتمنح عضوية.
- ينشأ الرمز العشوائي داخل الذاكرة (32 byte على الأقل)، ويخزن SHA-256 Hash
  فقط. لا تحفظ روابط خام في Database أوAudit أوLogs أوResponses الإدارية.
- الدعوة مرتبطة بمؤسسة وبريد وRole وDepartment محددة. لا يقبل العميل تغييرها
  عند القبول. `directory_activation` تحتاج Target User موجودة داخل المؤسسة
  وتحافظ على معرفه؛ ولا تُستخدم لإعادة ضبط حساب Login موجود.
- المدة المستهدفة 24 ساعة للدعوة العادية وساعة لدعوة الإدارة/Bootstrap.
  وجود `expires_at` لا يكفي؛ A3 تتحقق من الوقت وسلطة Inviter عند القبول.
- إنشاء Invitation وAudit عملية ذرية. إرسال البريد بعد Commit؛ فشله لا
  يفعّل User، وتسجل حالة التسليم. عند الفشل أوالانقطاع يمكن للمسؤول إعادة
  الإرسال: إلغاء الرمز السابق وإصدار رمز جديد ثم محاولة التسليم مجددًا.
  لا يوجد في A1 Mailer أوOutbox أوضمان Retry تلقائي.
- الرمز محدود الاستخدام. A3 تنفذ Lock/Conditional Update وتستهلك الدعوة
  مع تفعيل المستخدم وAudit داخل Transaction واحدة. فحص PostgreSQL في A1
  يثبت بدائية Compare-and-set فقط؛ لا يثبت اكتمال Endpoint قبول الدعوة.
- Partial Unique Index يفرض دعوة `pending` واحدة للبريد داخل المؤسسة. الدعوة
  المنتهية زمنيًا تبقى محتفظة بالفهرس حتى تنقلها A3 إلى `expired` أوتلغيها
  ضمن Transaction قبل إعادة الإصدار؛ لا يُستخدم `now()` في Index Predicate.
- واجهة قبول الدعوة لا تحمل Analytics/External Requests تسرب الرمز، وتزيله
  من URL سريعًا وتستخدم Referrer Policy ملائمة. هذا ضمن A5.

## Schema وCase-Insensitive Email

- `organizations.slug`: معرف فريد lowercase. Backfill ثابت `org-{id}`؛ لا
  يتغير Organization ID أوالاسم أوالملكية. تعديل Slugs قبل التفعيل يحتاج
  Mapping تشغيلية مراجعة، دون تغيير العضوية.
- `roles.organization_id`: ملكية الدور. تبقى Global Roles القديمة بسجلاتها
  ومعرفاتها ومحتواها، وتضاف نسخة لكل مؤسسة مع `legacy_source_role_id`.
  لا يمكن ربط User بمصدر Legacy بعد تفعيل Composite FK.
- `users`: يبقى ID وEmail الأصلي وPassword Hash والحالة والأقسام ثابتة؛ يتغير
  Role ID فقط وفق Mapping الأصل/المؤسسة، مع `membership_source=legacy`.
- لا نختلق Email Verification أوMembership Confirmation للسجلات الحالية.
  المستخدم الجديد افتراضيًا `invitation` ولا يمكن أن يكون فعالًا دون
  Password Hash ووقتي تأكيد. إضافة هذه القيم لا تنفذ تدفق تفعيل A3.
- Uniqueness المعتمد في PostgreSQL هو `(organization_id, lower(btrim(email)))`.
  تستخدم Preflight والفهارس التعبير نفسه؛ لا نعيد كتابة البريد التاريخي.
  هذه Database Collation Semantics، وليست Unicode casefold/NFKC أوتطبيع
  Gmail Aliases. `btrim` يزيل ASCII Space فقط؛ على A2/A3 توحيد سياسة الإدخال
  وعدم تغيير هذا العقد إلى Normalization أخرى دون فحص تعارضات جديد.
- اختبارات Unicode وConcurrent Inserts تستخدم PostgreSQL فعلية مؤقتة.
  تعبير SQLite للتطوير `lower(trim(email))` ليس إثباتًا لتكافؤ Unicode.
- Composite FKs تفرض Tenant صحيحًا للـUser Role/Department، وService
  Department، وSystem Department/Service/Owner، ومراجع Invitation/Access Event.
  علاقات التشغيل الأخرى تفحصها Preflight؛ عزل APIs اللاحق لا يغني عنه A1.

## Migrations

Initial Migration `54c5a5c8470d` محفوظة دون تعديل.

1. `a1_01_identity_expand`: قفل جداول الأساس وفحص البيانات قبل DDL، ثم إضافة
   حقول nullable وComposite Target Keys وجداول Invitations وAccess Events.
2. `a1_02_identity_backfill`: قفل الجداول التاريخية، وإعادة Preflight، ثم
   التقاط Fingerprints لكل السجلات القديمة، ونسخ Roles وربط Users بمؤسساتهم
   الحالية وتعيين Slugs ومصدر العضوية. تتحقق Preservation Checks داخل
   Transaction نفسها؛ أي اختلاف غير مسموح يوقفها.
3. `a1_03_identity_enforce`: إعادة التحقق ثم تفعيل NOT NULL وChecks وComposite
   FKs والفهرس الجديد قبل إزالة Global Email Unique Constraint.

Migrations الجديدة PostgreSQL-only وترفض Offline SQL؛ بيانات Backfill تحتاج
اتصالًا صريحًا وفحوصًا على الحالة الفعلية. لا تعدل Migration الأصلية ولا
تحاول تحويل SQLite ضمنيًا. قاعدة SQLite قديمة تحتاج خطة نقل معتمدة منفصلة.

Preflight تقرأ ولا تصلح: Email Collisions، References ناقصة، وعلاقات Tenant
غير متسقة في Foundation وChanges وDependencies وApprovals وNotifications
وAudit وغيرها. الأخطاء تعرض Category وCount فقط، دون Emails أوHashes.

Preservation Checks تقارن جميع أعمدة الجداول التاريخية الـ18 باستثناء Role ID
للمستخدم الذي يتحقق Mapping الخاص به صراحة. تسمح بإضافة نسخ Roles فقط؛ لا
تسمح بحذف أوتغيير السجلات القديمة ولا تعيد حساب Assessments.

التطبيقات القديمة غير صالحة أثناء الفاصل بين Expand وEnforce. اعتماد هذه
الخطوات لاحقًا يحتاج نافذة صيانة ومنع الكتابة ونسخة Application متوافقة؛ لا
نفترض Rolling Compatibility. فحوص البيانات والحفظ تتم داخل Transaction،
ويجب عدم تشغيل Backfill في وجود كتّاب يتجاوزون الأقفال.

## التفعيل والتراجع

التغيير غير المتوافق: Workspace Login وJWT Version وRole IDs الجديدة وتكرار
البريد عبر Tenants وMembership Checks. A1 لا يفعل أيًا من عقود API الجديدة.

لا ينشر A1 منفردًا، ولا يرجع إلى Application القديمة على Schema النهائية.
بعد فشل Migration تكون الأولوية لـTransaction Rollback. بعد نجاح Cutover
تستخدم Forward Repair مراجعة؛ كل A1 Downgrade مرفوض قبل أي حذف أوDDL.
الرجوع إلى Global Email Uniqueness قد يصبح مستحيلًا دون فقد حسابات، ولذلك
لا يوجد Downgrade يحذف بيانات لفرضه. Restore لقاعدة فعلية يحتاج خطة منفصلة
تحمي الكتابات اللاحقة وموافقة تشغيلية جديدة.

## الاختبارات الآمنة

الأمر من مجلد Backend:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
CHANGEFLOW_A1_POSTGRES_TESTS=1 PYTHONPATH=. \
venv/bin/python -B -m pytest -q -p no:cacheprovider
```

Fixture تنشئ Container جديدة `postgres:16-alpine` على Docker المحلي المحدد
صراحة، ببيانات مؤقتة في tmpfs ومنفذ Loopback عشوائي وPassword مولدة للاختبار.
لا تقبل DATABASE_URL خارجية ولا تحمل Project Directory أو.env في Container.
كل اختبار يستخدم Schema عشوائية خاصة؛ التنظيف يخص موارد الاختبار المنشأة
في الجلسة فقط. اختبارات HTTP تمر عبر ASGI وJWT وDependencies الفعلية مع
تبديل Database Dependency إلى PostgreSQL الاختبارية فقط.

بدون Opt-in تسجل مجموعة PostgreSQL/HTTP كـSkipped؛ لا تعتبر ناجحة. اختبارات
Unauthorized Registration الجديدة وJWT v2 وInvitations Endpoints وCAB
وWorkflow Concurrency تبقى للمجموعات المصرح بها لاحقًا.

## A1 Final Corrections — حماية الاختبارات

- تنظيف ملف Password مستقل بـ`finally` عن إيقاف Docker؛ تعالج إزالة الحاوية
  مسبقًا، ويتحقق Cleanup من Label ملكية خاصة بالتشغيل قبل إيقاف أي حاوية.
- `migrate()` و`downgrade()` ترفضان Engines غير المسجلة قبل أي SQL عليها.
  تقارن الملكية بهوية Database وUser وPostgreSQL Cluster المأخوذة من الحاوية
  المنشأة، وSchema المملوكة وSearch Path، وترفض Schema Translation.
  لا يُقبل URL خارجي أو`DATABASE_URL` لتحديد قاعدة Migration اختبارية.
- تختبر مطابقة CHECK Constraints وServer Defaults صراحة باستخدام تعريفات
  Models يفسرها PostgreSQL في Temporary Tables معزولة. توجد اختبارات سالبة
  لقيود محذوفة/متغيرة وDefaults مفقودة/متغيرة/زائدة. يُستثنى فقط SERIAL
  الافتراضي لمفتاح Integer الأساسي الذي يولده PostgreSQL تلقائيًا.
- هذه الحماية تخص أدوات الاختبار؛ لا تضيف Login أوTenant Context أوأي API
  من A2، ولا تجعل A1 قابلة للنشر منفردة.
