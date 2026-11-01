# Phase 2 / Batch A4 — Authorization, Permissions & Tenant Isolation

الحالة: تنفيذ محلي للمراجعة الأمنية فقط؛ لا Commit أوPush أوPR أوMerge أوRebase
أوDeployment. المشروع `bigest11/ChangeFlow-Governance`، والفرع
`feature/phase2-batch-a-tenant-security`، وخط الأساس النظيف المتحقق منه قبل
التعديل هو A3 Checkpoint `63f01db7b9dfc7818a575b95be1f3c9440ea4732`.
المراجع: [A1](phase2_a1.md)، [A2](phase2_a2.md)، [A3](phase2_a3.md).

## النطاق وحدود البيانات

A4 تضبط التفويض وعزل موارد الـAPI المسجلة حاليًا. لا تعديل Models أوMigrations
أوFrontend. لا A5 أوBatch B/C/D أوGemini أوInteractive Dependency Graph أوArchitectAI.
لم يُفتح اتصال بقاعدة حقيقية، ولم تُشغّل Seed أوBootstrap تشغيلية أوبريد حقيقي.
الأدوار حُصرت من Routes وSeed وA1/A2/A3، واختُبرت نسخها داخل PostgreSQL
اختبارية مُرحلة؛ هذا ليس ادعاء بجرد محتويات قاعدة تشغيلية لم نفتحها.

لا توجد Models/Endpoints للمشروعات في التطبيق المسجل. لا توجد Export API
أوReport CRUD مستقلة؛ التغطية تشمل Impact Profile وتقارير Assessment المتداخلة
وDashboards والقوائم والعدادات الفعلية. `report_generator.py` دالة غير مسجلة
كـEndpoint، وجدول `change_requests` القديم لا تعرضه Routes الحالية. لم تُخترع
واجهات لهذه الأجزاء. كذلك لا توجد Delete/Update APIs للـCatalogs عندما لا
تظهر في جرد المسارات أدناه؛ لم تُضف صلاحيات أوCRUD جديدة لها.

## Architecture

- `services/permissions.py`: Matrix صريحة وثابتة من Role Names الموجودة؛
  لا Inheritance أومعادلة تلقائية بين أسماء الأدوار ولا Wildcards.
- `TenantContext.permissions`: frozenset تُحسب من Role التابعة للمؤسسة في
  Database عند الطلب. تبقى فحوص JWT v2 والنشاط والعضوية وRole/Department
  الخاصة بـA2؛ لا Claims أوBody أوHeaders تمنح صلاحية.
- `services/authorization.py`: `require_permissions` للتحقق من جميع المتطلبات؛
  Permission مجهولة أوفارغة في تعريف Route خطأ برمجي يمنع تهيئتها.
- `services/tenant_resources.py`: شروط SQL مشتركة قبل التحميل وCount وPagination
  وMutation. تتلقى Organization من المستخدم الموثق الذي أنتجته Dependency،
  لا من Client. `ensure_permission` تحمي Query Helpers الخاصة بالتغييرات.
- كل Endpoint مؤسسية مسجلة لها Permission صريحة. بقيت `require_roles` كدالة
  توافق داخل auth_service، لكن Routes الحالية تستخدم النظام المركزي.
- الأدوار غير المعروفة لا تملك Permissions، حتى لو كانت عضويتها صالحة. لا
  تتغير Password Hash أوبياناتها تلقائيًا؛ يلزم إسناد دور معتمد بواسطة سلطة
  الإدارة الحالية إن أريد منحها وصولًا. Login ليس Grant لتجاوز Matrix.

## Permission Matrix

القراءات المشتركة للأسماء المعروفة: `identity.read`, `foundation.read`,
`notifications.own`, `risk_rules.read`. الأخيرة تخص السلوك العالمي القديم
المؤجل إلى Batch B ولا تعني عزل قواعد المخاطر.

| الدور الموجود | المنح الإضافية | حدود الملكية |
|---|---|---|
| Requester | changes.read/create/revise | المؤسسة وطلبات المستخدم نفسه فقط |
| Change Manager | changes.read/approve/implement | موارد المؤسسة الصحيحة؛ CAB Workflow مؤجلة |
| CMDB Manager | foundation.write، changes.read، risk_rules.write | Catalog وChanges المؤسسة؛ Risk Rules العالمية استثناء Batch B |
| System Administrator | users.read/update، audit.read، invitations.manage | المؤسسة نفسها؛ لا CMDB Write أوChange Read/Approve ضمنية |
| Admin (Legacy) | لا إضافات | القراءات المشتركة فقط؛ ليست System Administrator |
| System Owner (Legacy) | لا إضافات | القراءات المشتركة فقط؛ لا Grant مراجعة أوتنفيذ مخترع |
| Approver (Legacy) | لا إضافات | القراءات المشتركة فقط؛ تعريف سلطة الموافقة التفصيلية يحتاج سياسة Batch C |
| Viewer (Legacy) | لا إضافات | القراءات المشتركة فقط؛ لا Change Read غير موجودة في السياسة السابقة |
| أي اسم آخر | لا Permissions | Deny by Default |

هذه الأسماء Legacy موجودة في `seed_foundation.py`، بينما أسماء الأدوار المُدارة
الأربعة موجودة في Routes وA2/A3. Descriptions لا تمنح صلاحيات؛ مثلًا وصف Admin
القديم لا يرفعه إلى System Administrator، واسم Approver لا يفتح له مسار Manager.
لا يوجد Role.is_active في Schema الحالية؛ اختبارات فقد سلطة الدور تستخدم تغييره
أوإعادة تسميته، وفحوص النشاط تخص User.is_active كما تعتمد A2.

## Tenant Isolation

- Organization وRole وDepartment وUsers مقيدة بالمؤسسة الحالية. قراءة Users
  كـCatalog لا تمنح بيانات دخول ولا Hashes ولا صلاحية تغيير عضوية.
- Systems تتحقق في SQL من Department وService وOwner ومن Department الخاصة
  بالـService. تتحقق Create من كل FK قبل الكتابة.
- Dependencies تتحقق من **المصدر والهدف** ومرجعيات النظامين، في القائمة العامة
  والمتداخلة وImpact Profile وCount وقراءات موارد Assessment. Incidents تتبع
  System مؤسسية صالحة.
- Changes تتطلب Requester داخل المؤسسة أوNULL التاريخية المعتمدة، وأن تكون
  جميع Affected Systems وActors في History/Audit/Approvals وCoordinator محلية.
  يطبق الشرط نفسه على Details وLists/Search/Pagination/Counts وDashboards
  والـAssessment Aggregations ومسارات Revision/Approval/Implementation.
- Notifications مقيدة بالمؤسسة والمستلم، وتتحقق من Actor ومن Change المرتبطة؛
  وتطبق صلاحية المستخدم الحالية لقراءة Change، بما فيها ملكية Requester.
  يستخدم Unread Count وRead One وRead All الشرط نفسه؛ تفاصيل R1 أدناه.
- User Administration Audit تتحقق من المؤسسة لكل من Actor وTarget، بما في
  ذلك Search وCounts، وتقيّد Lookup الأسماء بالمؤسسة أيضًا.
- العلاقات غير المتسقة تُحجب من الاستعلامات وتعيد Details لها 404، ولا تُحذف
  أوتعاد كتابتها. لا يُقبل Foreign Resource مختلف عن ID غائبة برسالة تكشف
  وجوده. فحوص SQL هنا دفاع إضافي للـFK البسيطة التي لا تفرض كل علاقات Tenant.
  لا حاجة إلى Migration لتنفيذ حدود الـAPI؛ تقوية تلك القيود بنيويًا لاحقًا
  تحتاج خطة بيانات وموافقة مستقلة، وليست ضمن هذا التنفيذ.
- تبقى طوابع ومحتوى History وJSON Snapshots التاريخية محفوظة. لا نحاول استنتاج
  Tenant من نص حر أونعيد توليد Assessment قديمة؛ تثبت الاختبارات المراجع
  البنيوية والموارد المشتقة، لا تصنيف كل نص كتبه المستخدم تاريخيًا.

## Mass Assignment والتوافق

Mutation Inputs في Foundation وManaged Changes وImplementation وAdmin User
Update ترفض Extra Fields. لا يقبل Client تعيين Requester أوحالة Approved
أوCoordinator أوOrganization أوRole كحقول غير معتمدة. تبقى `organization_id`
الاختيارية القديمة في Department/System Create للتوافق: يجب مطابقتها للمؤسسة
الحالية، ويُعيّن Backend المؤسسة من الهوية الموثقة. Query/Header لا يوسّعان Scope.

الحفاظ على Existing Business Grants مقصود؛ لم يحصل System Administrator على
كل الأعمال لمجرد اسمه، ولم تُمنح Legacy Roles عمليات حساسة. لا توجد سياسة
جديدة لـCAB أوموافقة System Owner/Approver؛ ذلك قرار مستقل مؤجل.

تحديث اختبار A2 الوحيد يبدّل توقع Permissions الفارغة المؤقت الخاص بـA2 إلى
مجموعة Requester الصريحة ذات السبع Grants. ما زالت Claims المزورة بـ`*`
أوSystem Administrator مرفوضة؛ لا يُعدل الاختبار لمنح سلطة جديدة.

أقفال A3 لم تُعدل: Organization/Administrator NO KEY UPDATE وRole/Department
SHARE وأقفال الدعوة والمستخدم وCAS للاستهلاك. تبقى سياسة bcrypt وLogin وHashes
وJWT v2 وEnvironment Binding كما اعتمدت سابقًا.

## Security Findings والحدود المفتوحة

| التصنيف | المشكلة والدليل | الحالة |
|---|---|---|
| Medium، سابقة، عولجت في A4 | Dependencies كانت تقيد المصدر فقط، وChange/Audit/Notification كانت تتحقق من جزء من سلسلة الملكية. حقن علاقات أجنبية تسمح بها FK البسيطة في Schema الاختبار يثبت التسريب/الإرجاع غير الصحيح | شروط SQL المشتركة تحجب العلاقات غير المتسقة؛ لا ادعاء بأن مستخدم API كان يملك طريقًا معتمدًا لإنشاء كل هذه العلاقات |
| Medium، سابقة، عولجت في A4 | Roles غير المعروفة كانت تصل إلى قراءات تستخدم Authentication فقط، وExtra Fields كانت تُتجاهل بدل رفضها | Matrix صريحة وDeny by Default وعقود Mutation صارمة |
| Medium، سابقة، عولجت بتصحيح R1 | الإشعارات التاريخية كانت تكشف عنوان طلب شخص آخر بعد خفض Change Manager إلى Requester، وتصل إلى أدوار لا تملك changes.read | شرط قراءة المورد الحالي مشترك بين Changes وNotifications قبل البحث والعد والتحديث؛ لا حذف للسجلات |
| High، سابقة، **مؤجلة Batch B** | `RiskRule` بلا organization_id و`get_rule_score` عالمي. اختبار HTTP يثبت أن CMDB Manager بالمؤسسة 1 يغير Score ويشاهده مستخدم المؤسسة 2 | لم يُعدل تصميم Risk Rules. تشمل الاستثناءات GET/POST/PATCH risk-rules وعدّاد risk_rules في Foundation Overview وحساب المخاطر |
| High، سابقة، **مؤجلة Batch C** | حقل approval_level من العميل ليس CAB Authorization. الاختبار يثبت اعتماد Change بتقييم Critical عبر Manager مع Label CAB Review دون سلطة CAB مستقلة | لا CAB Workflow أوSeparation of Duties أوConcurrency إصلاح جديدة؛ A4 تضبط Tenant Boundary فقط |
| Medium، سابقة، مفتوحة | F2 Windows Positive Integration غير مثبتة | يبقى [تقرير A3](phase2_a3.md) ومتطلبات Runner وACL؛ Bootstrap غير معتمدة للاستخدام الحقيقي |
| Medium، سابقة، مفتوحة | Last Administrator Race والـRate Limiting ومخاطر bcrypt المتبقية | متطلبات مستقلة قبل Production؛ لا تعديل سباق آخر مسؤول هنا |

نجاح A4 لا يعني اكتمال عزل المنصة أوProduction Readiness. ملاحظات B/C المذكورة
أُثبتت داخل الاختبار، وليست تحذيرات افتراضية. الاختباران التوصيفيان لهما
يؤكدان استمرار السلوك غير الآمن المؤجل؛ نجاحهما **ليس نجاحًا أمنيًا** لهذين الجزأين.

## R1 — تفويض محتوى الإشعارات التاريخية — 2026-11-01

السياسة المعتمدة: صلاحية قراءة المحتوى المشتق من مورد محمي تتبع صلاحية المستخدم
الحالية لقراءة المورد، ولا يكفي أنه استلم الإشعار قبل تغيير Role. السبب الجذري
أن tenant_notifications كانت تتحقق من المؤسسة والمستلم وعلاقات الطلب فقط، دون
changes.read أوقيد ملكية Requester الذي تطبقه Change API.

- النموذج الحالي يملك change_request_id كمرجع Resource الوحيد، وهو اختياري.
  لا نضيف Model أوMigration أوحقولًا أومراجع لأنواع موارد أخرى.
- جميع Producers المسجلة حاليًا تنشئ إشعارات محمية: CHANGE_SUBMITTED،
  CHANGE_RESUBMITTED، CHANGE_APPROVED، CHANGE_REJECTED،
  CHANGE_INFORMATION_REQUESTED، CHANGE_IMPLEMENTATION_STARTED،
  CHANGE_IMPLEMENTED، CHANGE_IMPLEMENTATION_FAILED، CHANGE_ROLLED_BACK، CHANGE_CLOSED.
  الرسائل قد تحمل عنوان الطلب واسم مقدمه وحالته وتعليقات الموافقة؛ ليست مجرد تنبيه عام.
- readable_change_condition هو شرط SQL المشترك مع scope_changes: Permission من
  DB Role الحالية، ثم Organization وسلامة العلاقات، ثم ملكية الطلب لـRequester.
  الدور الذي لا يملك changes.read لا يرى إشعارًا مرتبطًا بطلب، حتى لو كان مستلمه.
- أي إشعار بمرجع Change واضح يتبع ذلك المورد، بصرف النظر عن notification_type؛
  لا تستطيع تسمية GENERAL تجاوز FK أجنبية أوحظر المورد.
- الإشعار بلا مرجع لا يظهر إلا بنوع GENERAL الصريح، المحجوز لإشعار عام لا يحتوي
  بيانات مورد محمي. لا يوجد Producer عام حاليًا؛ هذا عقد تصنيف واضح للمنتجين
  الموثوقين، وليس حقلًا يقبله Endpoint عامة. لا تمنح أسماء مجهولة أونصوص تبدو عامة
  استثناء تلقائيًا. الأنواع المحمية والمجهولة والقديمة غير المصنفة بلا FK تُحجب
  Fail Closed، وتبقى صفوفها كاملة. إضافة نوع عام أوResource جديد تحتاج تصنيفًا
  ومراجعة تفويض مستقلة؛ لا يمكن إثبات حساسية نص حر من محتواه آليًا.
- القيد يسبق Search وCount وPagination وUnread Count، ويستخدم في PATCH read-all
  وPATCH /{notification_id}/read. لا يوجد GET Read One مستقل في Routes الحالية.
  الإشعار المحجوب والغائب يعيدان 404 نفسها عند Mark as Read، دون أي كتابة عليهما.
- لا حذف Notification أوAudit أوHistory ولا تعديل Title/Message التاريخيين.
  Read All يغير is_read/read_at للإشعارات المسموحة فقط؛ استعادة الدور تعيد ظهور
  المحتوى الأصلي. يُعاد تقييم DB Role مع JWT نفسه ومع Session موجودة.
- الاستعلام الفرعي يطبق التفويض داخل SQL، دون تحميل كل Change أوتنفيذ فحص لكل صف.
  اختبار HTTP يقارن عدد SELECTs لقائمة من إشعار واحد ثم 26 إشعارًا، ويشترط ثباته؛
  هذا يثبت عدم إدخال N+1 في المسار المختبر ولا يغني عن تقييم الحمل التشغيلي.

اختبارات R1 في test_a4_notifications.py تغطي الإشعار المولد عبر POST الفعلية،
دور المدير قبل/بعد الخفض واستعادته، الأدوار الثمانية، List/Search/Count/Pagination
وMark/Read All، عامة مسموحة وأجنبية ومحجوبة، وعلاقات قديمة بلا FK. تؤكد Snapshots
لكامل صفوف Notifications عدم الكتابة عند الرفض وبقاء إشعارات الآخرين والمؤسسة
الأخرى، وثبات User Data وHashes وسجلات Audit/History أثناء عمليات الإشعارات.

قُوّي Dashboard Isolation بدرجات 10/30 محلية و80/90/100 أجنبية، وأعداد طلبات
2 مقابل 3، مع تأكيد كل Risk/Status Count والمتوسط وحدود Requester. كما تميز
اختبارات العلاقات المعزولة تقييم السجل المحجوب عن التقييم المتبقي. هذه تقييمات
مخزنة اصطناعية داخل Schema اختبارية، فلا تعتمد على حساب Risk Rules العالمية؛
يبقى خلل Batch B موثقًا ومفتوحًا دون إصلاح هنا.

### سجل إثبات الاختبارات قبل التصحيح وبعده

- قبل تعديل كود التطبيق، على PostgreSQL المعزولة: **8 failed, 28 passed** خلال
  **98.35 ثانية**. الإخفاقات المقصودة: test_downgrade_hides_generated_content_from_every_notification_operation_without_erasure،
  وخمس حالات test_linked_notifications_follow_all_current_role_grants للأدوار
  1/20/21/22/23 التي لا تملك changes.read، وtest_missing_or_unclassified_resource_references_fail_closed_but_general_notices_survive،
  وtest_notification_scope_refreshes_with_role_changes_in_an_existing_session.
  أثبتت كشف العداد بعد خفض الدور وقراءة المحتوى دون Grant وظهور الأحداث بلا مرجع.
- بعد الإصلاح، الجولة المركزة الأولى: **1 failed, 65 passed** خلال **172.43 ثانية**.
  الإخفاق الوحيد في test_downgrade_hides_generated_content_from_every_notification_operation_without_erasure
  كان بسبب تداخل بيانات Fixture: اسم مقدم الطلب المحجوب ظهر أيضًا كـActor مشروع
  لإشعار طلب مسموح. غُيّر Actor لذلك الإشعار المسموح من المستخدم 2 إلى المستخدم 1؛
  بقيت Assertions الحجب دون تخفيف، وأضيف حفظ Hashes وبيانات جميع المستخدمين الآخرين.
  نجحت إعادة الاختبار كاملةً: **1 passed خلال 18.33 ثانية**.
- محاولة Sandbox الأولى لم تصل إلى التطبيق: **36 setup errors** بسبب رفض إنشاء
  password داخل Temp الخاصة بالـSandbox. أُعيد التشغيل باستخدام Native Fixture
  خارج قيد Sandbox، دون Administrator أوتغيير ACL أوالاقتراب من قاعدة قائمة.
  لم تُعدل Fixture أوتُضعف ضمانات ملكية Cluster/Schema لإنجاح الاختبارات.
- اختبارات R1 عددها **12 حالة**، وDashboard الجديدة حالة إضافية؛ مجموع A4 أصبح
  **66 حالة** بدلًا من 53. لا تُجمع نتائج الجولات المتداخلة.

### نتيجة Full Regression النهائية بعد R1 — 2026-11-01

الأمر من backend، باستخدام CHANGEFLOW_A1_POSTGRES_TESTS=1 وNative PostgreSQL
داخل C:\Program Files\PostgreSQL\18\bin:

```powershell
.\venv\Scripts\python.exe -B -m pytest -q -ra --tb=short -p no:cacheprovider
```

**507 passed, 2 skipped, 0 warnings خلال 807.78 ثانية (13:27)**، Exit Code 0.
هذه جولة كاملة بعد الإصلاح على كود التطبيق والاختبارات النهائيين، وليست جمعًا
لجولات مركزة. تشمل A1/A2/A3/A4 وكل Regression؛ حالات A4 الـ66 نجحت ضمنها.
حُفظت SHA-256 للملفات البرمجية والاختبارات عند بدء الجولة للتحقق من ثبات النسخة؛
التغييرات بعدها اقتصرت على توثيق النتائج. Fixture أنشأت Cluster PostgreSQL جديدة
وSchemas مملوكة ومعزولة ثم نظفتها؛ اختبارات SQLite القائمة بقيت معزولة كما هي.
لا اتصال بقاعدة تشغيلية ولا Bootstrap تشغيلية ولا بريد حقيقي.

التجاوزان الفعليان، دون تعطيل أواستحداث تجاوزات:

1. test_postgres_email_comparison_uses_database_collation[sqlite] في
   test_a2_authentication.py:333: Database collation behavior requires PostgreSQL.
   نظيره على PostgreSQL نجح.
2. test_native_positive_policy_chain_on_prepared_windows_runner في
   test_a3_windows_policy.py:99: يحتاج Runner Windows مجهزة بأسلاف موثوقة وACL
   وToken تشغيل مناسبة. بيئة التطوير لا توفرها؛ لم تُغير ACL نظامية ولم تُطلب
   صلاحيات Windows Administrator. يبقى F2 مفتوحًا وBootstrap غير معتمدة تشغيليًا.

نجحت اختبارات JWT v2 وWorkspace Login وMembership وLegacy Hash Preservation،
واختبارات A3 للأقفال وDeadlock وReplay وRollback وEnvironment Binding؛ لم تُغير
خدماتها. لا إخفاقات متبقية ولا Warnings أوتعطيل لتحذيرات SQLAlchemy.

R1 مغلقة بأدلة HTTP/PostgreSQL: المنع يسبق كل عمليات Notification الموجودة،
والسجلات المحجوبة محفوظة وتعود عند استعادة التفويض. تغيير هذه السياسة أوإضافة
نوع إشعار عام أومرجع Resource آخر يحتاج مراجعة واختبارات صريحة؛ لا يمكن تصنيف
محتوى Legacy مجهول بلا مرجع موثوق تلقائيًا، فيبقى محجوبًا دون تعديله.

فُحصت الملفات المعدلة والجديدة الـ22، ونجح git diff --check وفحص الصياغة
والـWhitespace بما فيها Untracked، ولم يُكتشف Secret فعلي أوEnvironment File
أوملف اختبار مؤقت ضمن التغييرات. تغييرات تصحيح R1 فقط: tenant_resources.py،
test_a4_isolation.py، test_a4_notifications.py الجديد، وهذا التقرير.
بقية تغييرات A4 السابقة محفوظة؛ لا Models أوMigrations أوFrontend أوإصلاح B/C.
الحالة: **13 Modified و9 Untracked، وStaging فارغة**، والفرع وHEAD كما في البداية؛
master بقيت 10faab20b1c61b5476165bbc1f5d28a2a85e2652.

**التوصية بعد R1: A4 جاهزة للحفظ كـDevelopment Checkpoint ضمن Feature Branch بعد
موافقة المستخدم، وليست Production Readiness.** تبقى High Global Risk Rules لـB
وHigh CAB Approval Enforcement لـC، وF2 Windows وLast Administrator Race
وRate Limiting ومخاطر bcrypt المتبقية وربط البريد الحقيقي مفتوحة. لم يُنفذ
Commit أوPush أوPR أوDeployment أوA5 أوBatch B/C/D.

## الاختبارات

تستخدم A4 Fixture A1 المعتمدة: Cluster PostgreSQL جديدة مؤقتة وSchema مملوكة
لكل اختبار، مع تحقق Ownership قبل Migrations وفحوص Schema. لا DATABASE_URL
خارجية ولا Seed على قاعدة حقيقية. Fixture `a4_workspace.py` تعيد استخدام
ضمانات A3، وتزامن Sequences بعد IDs الاصطناعية الصريحة داخل Schema المملوكة فقط.
تستخدم HTTP حقيقية عبر ASGI وJWT وDependencies والاستعلامات الفعلية، لا Mocks للعزل.

- `test_a4_authorization.py`: Matrix HTTP للأدوار الثمانية واسم غير معروف،
  Allowed/Denied Writes، Immutable Permissions، Claims، الدور أثناء الجلسة،
  وتعطيل المستخدم ورفض Mass Assignment وحفظ Hashes.
- `test_a4_isolation.py`: طرفا Dependencies، Nested Resource Quarantine،
  Search/Count/Dashboard Isolation، Audit/Notification وWrite Scope وForeign FKs.
- `test_a4_regressions.py`: جرد Permission لكل Route، Refresh داخل Session
  موجودة، Role Rename وعضوية ناقصة، Catalogs وLegacy Data، تنفيذ التغيير
  والمراجعة والقيود بين المؤسسات، وتوصيف مخاطر B/C المؤجلة.
- `test_a4_notifications.py`: تفويض المحتوى التاريخي الحالي وحفظ الصفوف واختبارات R1 أعلاه.

الجولات المركزة الأولى: **41 passed خلال 99.58 ثانية** لمجموعتي Authorization
وIsolation، و**12 passed** لاختبارات Regression الجديدة. ظهر فشلان في توقع
Permissions الفارغة القديم لـA2؛ حُدّث العقد كما هو موضح أعلاه.
قبل التصحيح أثبتت الاختبارات الفجوات؛ تضمنت الجولات الأولية أخطاء Sequences
اختبارية، ثم صُححت. سجلت الجولة السابقة **20 failed, 21 passed**؛ ليست كل
إخفاقاتها Findings مستقلة. ظهر خطأ Import فارغة عند نقل Dependencies وصُحح
قبل الجولة الناجحة. لا تعتبر أخطاء التجهيز إثباتًا أمنيًا.

### نتائج التحقق السابقة قبل تصحيح R1 — 2026-10-30

| الجولة | النتيجة | المدة |
|---|---|---|
| A1 + A2 + A3 + A4 + Regression كاملة | **494 passed, 2 skipped, 0 warnings** | **848.35 ثانية (14:08)** |
| A4 وحدها بعد تقوية تأكيدات Mutation/No Writes، دون تغيير كود التطبيق | **53 passed, 0 skipped, 0 warnings** | **132.31 ثانية (2:12)** |

المجموعتان متداخلتان، ولا تجمع أعدادهما. تشمل A4 Matrix من تسع هويات سياسة
(ثمانية أسماء موجودة واسم غير معروف) وعشرين عملية HTTP لكل هوية. تؤكد النسخة
النهائية كذلك كل مسارات Revision/Approval/Implementation الأجنبية، وتطابق
رسائل الموارد الأجنبية والغائبة، وبقاء عدادات جداول Catalog/Changes/History/
Assessment/Notifications وبيانات Users بعد رفض Extra Fields. فُحص عدم وجود
Delete API للـSystems عبر رفض Method المتطابق للموارد المحلية والأجنبية.

كل تكامل A4 على PostgreSQL **18.4** جديدة مؤقتة؛ اختبارات SQLite القديمة بقيت
داخل الذاكرة ضمن Regression. لا Database مستخدمة فعليًا ولا URLs خارجية.
نجحت اختبارات Legacy Hash Preservation وJWT v2 وWorkspace Login وMembership
وA3 Deadlock/Replay/Bootstrap Authorization وEnvironment Binding دون تغيير
خوارزمياتها. عمليات Bootstrap والبريد داخل الاختبارات فقط ببيانات وMailer
اصطناعية؛ لا Bootstrap تشغيلية أوبريد حقيقي.

التجاوزان الوحيدان في الجولة الكاملة:

1. `test_postgres_email_comparison_uses_database_collation[sqlite]`: PostgreSQL
   Collation لا يثبتها SQLite؛ نظيره على PostgreSQL نجح.
2. `test_native_positive_policy_chain_on_prepared_windows_runner`: Runner
   Windows الموثوقة غير متوفرة؛ F2 لا تزال مفتوحة، وليس التجاوز نجاحًا.

لم تظهر Warnings. تحذيرات SQLAlchemy الأربعة السابقة عن Subquery داخل IN
اختفت مع استبدال استعلامات Foundation Counts ضمن شروط SQL الجديدة باستخدام
SELECT صريحة، دون تعطيل التحذيرات. لا إخفاقات متبقية.

### Security/Git Review السابقة قبل R1

فُحصت التعديلات والملفات الجديدة، ونجح `git diff --check` وSyntax وWhitespace
والبحث عن أنماط Secrets. لم تُكتشف أسرار فعلية أوEnvironment Files أوبيانات
إنتاجية أوملفات مؤقتة ضمن التغييرات. لا Models أوMigrations أوFrontend ولا
تعديل خدمات A3 Invitations/Bootstrap/Windows أوأقفالها. التعديل الوحيد في
foundation_risk_engine يخص استعلامات موارد المؤسسة؛ `get_rule_score` العالمية
وسياسة Risk Rules لم تتغيرا، وكذلك منطق CAB ومشكلاتهما الموثقة أعلاه.

الفرع الحالي كما هو وHEAD بقيت `63f01db7b9dfc7818a575b95be1f3c9440ea4732`؛
master بقيت `10faab20b1c61b5476165bbc1f5d28a2a85e2652`. الحالة النهائية
**13 Modified و8 Untracked قبل R1، وStaging فارغة**. لا Commit أوPush أوPR أوتغيير
master أوDeployment أوتشغيل Migration على قاعدة حقيقية.

التوصية: **A4 جاهزة لمراجعة أمنية مستقلة قبل Commit ضمن نطاقها الموثق**.
لا يوجد تسريب Cross-Tenant معروف متبقٍ في الموارد البنيوية المغطاة باختبارات
A4، مع استثناءات B/C الصريحة. ليست اعتمادًا نهائيًا للمنصة أوProduction؛
تبقى Matrix للمراجعة ومخاطر B/C وF2 وLast Administrator وRate Limiting مفتوحة.

## Endpoint Inventory — الربط الفعلي بالصلاحيات

العمليات أدناه هي Routes المسجلة في التطبيق، وليست قائمة ميزات مستقبلية.

| Method | Endpoint | Permission | Boundary |
|---|---|---|---|
| POST | `/auth/register` | `Public — disabled 403` |  |
| POST | `/auth/login` | `Public — credentials` |  |
| GET | `/auth/me` | `identity.read` |  |
| GET | `/auth/admin/roles` | `users.read` |  |
| GET | `/auth/admin/users` | `users.read` |  |
| GET | `/auth/admin/users/paged` | `users.read` |  |
| PATCH | `/auth/admin/users/{user_id}` | `users.update` |  |
| GET | `/auth/admin/audit-logs` | `audit.read` |  |
| GET | `/auth/admin/audit-logs/paged` | `audit.read` |  |
| GET | `/change-management/dashboard/delivery-queues` | `changes.read` |  |
| GET | `/change-management/requests/{change_request_id}/implementation` | `changes.read` |  |
| POST | `/change-management/requests/{change_request_id}/implementation/start` | `changes.implement` |  |
| POST | `/change-management/requests/{change_request_id}/implementation/complete` | `changes.implement` |  |
| POST | `/change-management/requests/{change_request_id}/implementation/fail` | `changes.implement` |  |
| POST | `/change-management/requests/{change_request_id}/implementation/rollback` | `changes.implement` |  |
| POST | `/change-management/requests/{change_request_id}/implementation/post-implementation-review` | `changes.implement` |  |
| POST | `/change-management/requests` | `changes.create` |  |
| PUT | `/change-management/requests/{change_request_id}/revise` | `changes.revise` |  |
| GET | `/change-management/requests` | `changes.read` |  |
| GET | `/change-management/requests/paged` | `changes.read` |  |
| GET | `/change-management/requests/{change_request_id}` | `changes.read` |  |
| GET | `/change-management/requests/{change_request_id}/history` | `changes.read` |  |
| GET | `/change-management/requests/{change_request_id}/audit-logs` | `changes.read` |  |
| POST | `/change-management/requests/{change_request_id}/approvals` | `changes.approve` | Tenant boundary; CAB deferred |
| GET | `/change-management/requests/{change_request_id}/approvals` | `changes.read` |  |
| GET | `/change-management/dashboard/work-queues` | `changes.read` |  |
| GET | `/change-management/dashboard/overview` | `changes.read` |  |
| GET | `/foundation/overview` | `foundation.read` | Tenant counts; risk_rules global — B |
| GET | `/foundation/organizations` | `foundation.read` |  |
| GET | `/foundation/roles` | `foundation.read` |  |
| GET | `/foundation/departments` | `foundation.read` |  |
| GET | `/foundation/users` | `foundation.read` |  |
| GET | `/foundation/services` | `foundation.read` |  |
| GET | `/foundation/systems` | `foundation.read` |  |
| GET | `/foundation/systems/{system_id}` | `foundation.read` |  |
| GET | `/foundation/systems/{system_id}/dependencies` | `foundation.read` |  |
| GET | `/foundation/systems/{system_id}/incidents` | `foundation.read` |  |
| GET | `/foundation/systems/{system_id}/impact-profile` | `foundation.read` |  |
| GET | `/foundation/incidents` | `foundation.read` |  |
| POST | `/foundation/incidents` | `foundation.write` |  |
| GET | `/foundation/risk-rules` | `risk_rules.read` | Global legacy — Batch B |
| POST | `/foundation/risk-rules` | `risk_rules.write` | Global legacy — Batch B |
| PATCH | `/foundation/risk-rules/{rule_id}` | `risk_rules.write` | Global legacy — Batch B |
| POST | `/foundation/departments` | `foundation.write` |  |
| POST | `/foundation/systems` | `foundation.write` |  |
| GET | `/foundation/dependencies` | `foundation.read` |  |
| POST | `/foundation/dependencies` | `foundation.write` |  |
| POST | `/auth/invitations` | `invitations.manage` |  |
| GET | `/auth/invitations` | `invitations.manage` |  |
| POST | `/auth/invitations/accept` | `Public — invitation proof` |  |
| POST | `/auth/invitations/{invitation_id}/revoke` | `invitations.manage` |  |
| POST | `/auth/invitations/{invitation_id}/resend` | `invitations.manage` |  |
| GET | `/notifications/unread-count` | `notifications.own` |  |
| GET | `/notifications/paged` | `notifications.own` |  |
| PATCH | `/notifications/read-all` | `notifications.own` |  |
| PATCH | `/notifications/{notification_id}/read` | `notifications.own` |  |

Public metadata: `GET /` و`GET /health`. وثائق OpenAPI/Swagger القياسية لا تحمل سجلات مؤسسة؛ سياسات إتاحتها التشغيلية خارج A4.

## الملفات المعدلة والجديدة

| الحالة | الملف |
|---|---|
| معدل | `backend/app/routes/auth.py` |
| معدل | `backend/app/routes/change_execution.py` |
| معدل | `backend/app/routes/change_management.py` |
| معدل | `backend/app/routes/foundation.py` |
| معدل | `backend/app/routes/invitations.py` |
| معدل | `backend/app/routes/notifications.py` |
| معدل | `backend/app/schemas/auth.py` |
| معدل | `backend/app/schemas/change_execution.py` |
| معدل | `backend/app/schemas/change_management.py` |
| معدل | `backend/app/schemas/foundation.py` |
| معدل | `backend/app/services/foundation_risk_engine.py` |
| معدل | `backend/app/services/tenant_context.py` |
| معدل | `backend/tests/test_a2_authentication.py` |
| جديد | `backend/app/services/authorization.py` |
| جديد | `backend/app/services/permissions.py` |
| جديد | `backend/app/services/tenant_resources.py` |
| جديد | `backend/docs/phase2_a4.md` |
| جديد | `backend/tests/a4_workspace.py` |
| جديد | `backend/tests/test_a4_authorization.py` |
| جديد | `backend/tests/test_a4_isolation.py` |
| جديد | `backend/tests/test_a4_notifications.py` |
| جديد | `backend/tests/test_a4_regressions.py` |
