# Phase 2 / Batch A3 — Secure Invitations وMembership Activation وBootstrap

الحالة: **A3 Development Checkpoint معتمد للحفظ على Feature Branch فقط**،
دون اعتماد للإنتاج أوتشغيل Bootstrap. خط أساس التنفيذ هو A2
`1f7a105d93395871f0f219e7d6a835468f6fa632`، على الفرع
`feature/phase2-batch-a-tenant-security` في `bigest11/ChangeFlow-Governance`.
تحقق الفحص الأولي من شجرة نظيفة ووجود A1/A2 قبل أي تعديل.
المراجع: [A1](phase2_a1.md)، [A2](phase2_a2.md).

## النطاق والملفات

لا تعديل Models أوSchema أوMigrations أوFrontend. تستخدم A3 حقول وقيود
`organization_invitations` و`tenant_access_events` المعتمدة في A1، بما فيها
الفهارس الجزئية والمراجع المركبة وقيود تفعيل العضوية والاستهلاك.

الملفات الجديدة:

- `app/schemas/invitation.py`: عقود الطلب والرد والتحقق الآمن من المدخلات.
- `app/routes/invitations.py`: Routes العامة والمحمية مع تنقيح أخطاء Validation.
- `app/services/invitation_service.py`: المعاملات والتحقق والانتقالات والتدقيق.
- `app/services/invitation_mailer.py`: Protocol للتسليم وAdapter افتراضية معطّلة.
- `app/services/bootstrap_authorization.py`: الموافقة الموقعة وسياسة تشغيل OS.
- `app/services/windows_trust_policy.py`: تثبيت مسار Windows وفحص ACL والقراءة بالمقابض.
- `bootstrap_tenant.py`: CLI إصدار دعوة أول Administrator؛ لا تنفذ Recovery.
- `tests/test_a3_invitations.py`: وظائف الدعوات والعضوية والعزل والتسليم.
- `tests/test_a3_atomicity.py`: سباقات PostgreSQL وحالات فشل المعاملات.
- `tests/test_a3_bootstrap.py`: توقيع الموافقة وربطها بالمشغّل والهدف وCLI.
- `tests/test_a3_security_edges.py`: عدم كشف الأسرار وحدود التفويض والفشل.
- هذا التقرير.

الملفات المعدلة:

- `app/main.py`: تسجيل Router الدعوات فقط.
- `app/services/auth_service.py` و`app/routes/auth.py`: نقل مجموعة الأدوار
  المُدارة الحالية إلى موضع مشترك دون تغيير معناها أوخوارزمية A2.
- `tests/test_a2_authentication.py`: إضافة مسار قبول الدعوة وحده إلى قائمة
  المسارات العامة في اختبار الاعتماديات؛ تبقى إدارة الدعوات محمية بـTenant Context.

لا A4 أوA5 أوBatch B/C/D. لم يشمل التنفيذ الأصلي Commit أوPush؛ أذن المستخدم
لاحقًا بحفظ Development Checkpoint فقط كما هو موضح في آخر هذا التقرير.
لا PR أوMerge أوDeployment ضمن هذا التفويض.

## Endpoints

| Method | Path | السلطة والنتيجة |
|---|---|---|
| POST | `/auth/invitations` | System Administrator داخل مؤسسته؛ `201` |
| GET | `/auth/invitations?limit=50&offset=0` | قائمة مؤسسة المسؤول فقط؛ حد أقصى 100 |
| POST | `/auth/invitations/{id}/revoke` | إلغاء دعوة المؤسسة؛ `200` |
| POST | `/auth/invitations/{id}/resend` | إبطال القديمة وإصدار سجل ورمز جديدين؛ `201` |
| POST | `/auth/invitations/accept` | Public مع إثبات الرمز؛ `200` وتفعيل العضوية دون Access Token |

إنشاء دعوة عادية يقبل `email`, `role_id`, `department_id` الاختيارية.
`purpose` إما `membership` أو`directory_activation`؛ الثانية تتطلب
`target_user_id`. لا يقبل هذا المسار `bootstrap` أو`organization_id` أوحقولًا إضافية.

الأدوار القابلة للإسناد هي الأدوار الأربعة المُدارة المعتمدة سابقًا: Requester،
Change Manager، CMDB Manager، System Administrator. يتحقق Backend أن Role
وDepartment تنتميان للمؤسسة. لا تُستخدم Global Roles أويُرقّى Legacy Role
غير معروف؛ لا تُضاف Permission Matrix جديدة.

القبول يقبل `token` و`password`، و`full_name` مطلوبة لإنشاء حساب جديد.
أسماء وحقول Profile الخاصة بـDirectory Identity محفوظة؛ `full_name` الواردة
لا تعيد كتابتها. لا يقبل المستلم تغيير Email أوRole أوDepartment أوOrganization.

الردود الإدارية تعرض IDs وEmail والإسناد والحالة والتوقيت وحالة التسليم فقط.
لا تعرض الرمز أوHash الرمز أوPassword Hash أوبيانات Manifest التشغيلية.
يعرض GET الحالة الزمنية `expired` للسجل المنتهي حتى لو بقي DB status
`pending`؛ تقوم عمليات الإصدار وإعادة الإرسال بتحرير الحجز الجزئي داخل المعاملة.

`401/403` من عقد A2، و`404` لمورد ليس داخل مؤسسة المسؤول، و`409` لتعارض
عضوية أودعوة. فشل صلاحية الرمز أوحالته أوسلطة مصدره يعيد رسالة عامة واحدة:
`Invitation is invalid or unavailable.` مع `400`. أخطاء بنية الطلب تعيد
`Invalid invitation request.` مع `400`، دون إعادة Credential Input.

## الرموز والمعاملات

- توليد `secrets.token_urlsafe(32)`، أي 32 بايت CSPRNG ورمز URL-safe بطول 43.
- تخزين SHA-256 فقط. لا تخزين للرمز الخام في DB أوAudit أوملف أواستجابة إدارية.
- البيانات السرية في طلب القبول وMessage من نوع `SecretStr`؛ لا يظهر الرمز
  في repr الخاصة برسالة التسليم. لا يُسجل نص استثناء Mailer لأنه قد يحمل الرمز.
- مدة العضوية العادية 24 ساعة؛ دعوة Administrator وBootstrap لا تتجاوز ساعة.
  لا يستطيع العميل تحديد TTL. Bootstrap مقيّدة أيضًا بانتهاء الموافقة الموقعة.
- القبول يعيد قراءة الدعوة والإسناد وسلطة Inviter من Database. يجب أن يبقى
  المصدر Administrator فعالًا بعضوية A2 صحيحة في المؤسسة نفسها عند القبول.
- لا تُنشأ دعوة جديدة لحساب Login موجود. Directory Activation تتطلب حسابًا
  مطابقًا داخل المؤسسة و`password_hash IS NULL` وطوابع تأكيد فارغة؛ تعاد هذه
  الفحوص عند القبول، حتى لا تتحول الدعوة إلى Password Reset.
- يبقى `users.id` وEmail وProfile للـDirectory Identity ثابتًا. يتغير الإسناد
  وPassword Hash وحالة العضوية فقط وفق الدعوة المصرح بها.
- حيازة السر الصادر لقناة البريد المستهدف هي إثبات القبول. عندها فقط تُضبط
  `membership_confirmed_at` و`email_verified_at`؛ إصدار الدعوة أوفشل إرسالها
  لا يفعّل مستخدمًا. لا ادعاء بإثبات تسليم بريد حقيقي دون Provider.

كل عمليات A3 المعدّلة تقفل صف Organization بـ`FOR NO KEY UPDATE` ثم تقفل
السجلات ذات الصلة، وتعيد التحقق بعد الانتظار. القفل الأول يسلسل انتقالات
المؤسسة ويسمح بأقفال FK key-share، لتجنب تعطيل مراجع التدقيق أثناء التسليم.
هذا اختيار متحفظ للتزامن؛ قد يحدّ معدل عمليات الدعوات في المؤسسة الواحدة.
بعد تصحيح F1 تستخدم قراءة سلطة المسؤول `FOR NO KEY UPDATE`، وقراءة Role
وDepartment تستخدم `FOR SHARE`؛ تمنع هذه الأقفال تعديل التفويض أثناء العملية
وتسمح بفحوص FK `FOR KEY SHARE` من مسار إدارة المستخدمين في A2. يبقى قفل
المستخدم المستهدف وقفل الدعوة والتحديث المشروط للاستهلاك؛ لم تُحذف حماية Replay.

يستخدم القبول أيضًا Conditional Update لصف الدعوة بشرط `pending` وبقاء
`expires_at > clock_timestamp()`. يعاد فحص الوقت بعد bcrypt، وتُنشأ العضوية
وتُستهلك الدعوة ويُحفظ Audit ضمن Transaction واحدة. أي فشل يردّها بالكامل.
يمنع هذا Replay والقبول المتزامن، ويضبط سباقات resend/revoke/accept.

إعادة الإرسال لا تعيد استخدام الرمز: تُلغى الدعوة القديمة أوتُنقل إلى expired،
ثم تُنشأ دعوة جديدة تشير إليها Audit metadata عبر ID فقط. لا تُحذف السجلات.

## Email Delivery

`InvitationMailer.send_invitation(InvitationMessage)` هي حدود التكامل.
تحتوي Message على البريد وWorkspace Slug والانتهاء والرمز الموجود في الذاكرة.
الـAdapter الافتراضية **غير مهيأة وتفشل صراحةً**؛ لا SMTP أوProvider مدفوع
أوإرسال حقيقي أوملفات تحتوي روابط. الاختبارات تستبدل Dependency بـFake Mailer
تحتفظ برسائل اصطناعية داخل الذاكرة فقط.

إنشاء الدعوة وAudit يسبقان إرسالها عبر Commit. بعد ذلك يُسجل `sent/failed`
ومحاولة التسليم، دون تفاصيل Provider أوالرمز. تبقى العضوية غير مفعّلة.
يمكن للمسؤول إعادة الإرسال، لكن يلزم رمز جديد؛ لا تُخزّن النسخة الخام لإعادة
المحاولة. بعد انقطاع العملية قد تبقى `delivery_status=pending` وتعني نتيجة
غير مؤكدة؛ تستخدم إعادة الإرسال للإبطال والتعافي.

إذا تم النقل ثم فشل حفظ نتيجة التسليم، تبقى الدعوة وAudit الإصدار المحفوظة
وتبقى النتيجة pending؛ لا ندعي أن إرسال البريد وDB عملية ذرية واحدة.
لا يوجد Outbox دائم أوRetry آلية أوضمان exactly-once. قد تصل رسالة قديمة بعد
إعادة الإرسال أوالإلغاء؛ سرها يظل غير قابل للاستهلاك بعد الإبطال. إكمال Callback
التسليم يحدّث حقول التسليم فقط ولا يعيد الحالة إلى pending.

ربط Provider حقيقية واختبارها وواجهة قبول الروابط ضمن العمل المصرح لاحقًا.
لا تدّعي A3 أن إرسال البريد الحقيقي يعمل الآن.

## Secure Tenant Bootstrap

CLI خارج Public API؛ لا يقبل النظام Bootstrap من `/auth/invitations` ولا
يوجد `/auth/bootstrap`. الهدف هو **أول Administrator لمؤسسة محددة مجهزة مسبقًا**.
يلزم وجود Organization وTenant-local System Administrator Role معتمدة؛
لا يختار البرنامج أول مؤسسة، ولا ينسخ Global Roles أويؤسس Foundation APIs.

الوسائط المقبولة فقط:

```text
python -B bootstrap_tenant.py --organization-id ORGANIZATION_ID --email TARGET_EMAIL --manifest SIGNED_MANIFEST_PATH
```

هذا قالب تشغيل وليس أمرًا نُفذ على قاعدة فعلية. لا Password أوToken أوPrivate
Key في argv. تعيد أخطاء argparse رسالة منقّحة حتى عند إرسال Secret بالخطأ.
تُفحص الموافقة قبل تحميل Database Session، ولا يبدأ عمل DB عند فشل التفويض.
المخرجات IDs وحالة الإصدار/التسليم فقط؛ Exit 0 يعني حفظ الإصدار ولا يعني نجاح
البريد إذا كانت حالة التسليم failed.

### Trust Root والمشغّل

سياسة تشغيلية خارج المستودع في مكان ثابت لا يختاره المستدعي:

- Linux/POSIX: `/etc/changeflow/bootstrap-policy.json`، بملكية root، دون كتابة
  للمجموعة/الآخرين للملف وأسلافه، ودون Symlinks. يفحص descriptor المفتوح نفسه.
- Windows: `C:\ProgramData\ChangeFlow\bootstrap-policy.json`. تُفتح سلسلة
  المسار كاملة من جذر C بمقابض Native تحتفظ بها العملية إلى انتهاء القراءة،
  مع `FILE_FLAG_OPEN_REPARSE_POINT` و`FILE_FLAG_BACKUP_SEMANTICS` واشتراك قراءة
  فقط دون Share Write/Delete. تُرفض Reparse Points والأجسام غير المتوقعة.
  يفحص `GetSecurityInfo` المالك وDACL من كل مقبض، وتتم `ReadFile` من مقبض
  الملف نفسه، دون إعادة فتح بالاسم. حد الحجم 16KiB.
  الجذور الموثوقة هي SYSTEM وAdministrators وWindows TrustedInstaller SID
  المعروفة؛ هذا الأخير مكون OS مخول بتغيير النظام، وليس مشغّلًا إضافيًا.
  ترفض Null/Missing DACL وحقوق تعديل/حذف/استبدال/تغيير ACL أوالمالك لجهة
  أخرى، بما فيها Delete Child وGeneric Write/All. تتجاهل Inherit-only ACE
  بالنسبة للكائن الحالي وتفشل مغلقة عند ACE غير مدعومة. هذا فحص متحفظ؛
  Deny ACE لا تعالج وجود Allow غير موثوقة.
  لا تُغيّر CLI صلاحيات OS لكي تمر. المسارات الأخرى وUNC/ADS مرفوضة.
  تبقى قراءة هوية OS عبر PowerShell النظام الثابت دون Profiles أومسارات
  Modules يختارها المستخدم؛ قراءة السياسة نفسها لم تعد تستخدم PowerShell.

الملف يحتوي `deployment_id`, `key_id`, `public_key` بترميز Base64 لمفتاح Ed25519 عام من 32 بايت،
و`operators` لقائمة الهويات المصرح لها. هوية العملية الفعلية هي `uid:NUMBER`
على POSIX أو`sid:SID` على Windows؛ لا تُؤخذ من Username أوEnvironment قابلة للتزوير.
لا توجد `--policy` أو`--public-key` أوEnvironment Override لقبول مفتاح يختاره المشغّل.

يجهز مسؤول البنية السياسة وصلاحيات القراءة التشغيلية وصلاحيات DB الأدنى
اللازمة بصورة منفصلة ومراجعة. يفترض حد الثقة أن OS administrators ومالكي
الكود وDatabase موثوقون؛ لا يدعي مقاومة مسؤول نظام يستطيع تعديل البرنامج نفسه.

### الموافقة الموقعة

تُوقّع جهة الموافقة خارج CLI باستخدام Ed25519 Private Key محفوظة في Secret
Store أوموقّع Offline؛ لا تحتاج CLI إلا المفتاح العام الموثوق. لم تُنشأ مفاتيح
أوسياسة تشغيل حقيقية ضمن المهمة. Private Keys في الاختبارات مولدة في الذاكرة فقط.

Manifest محدودة بـ16KiB وبنية `{payload, signature}`. التوقيع Base64 على UTF-8
للـpayload بعد `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)`.
يجب الاحتفاظ بالـManifest غير السرية ومرجع اعتمادها لدى جهة التشغيل للتدقيق.

حقول payload الموقعة:

```text
action = tenant_bootstrap
deployment_id
key_id, authorization_id, operator_id
organization_id, email, role_id, department_id (اختيارية)
issued_at, expires_at (مع Timezone)
```

تُرفض الأهداف أوالمشغّل أوالمفتاح غير المطابق والتوقيع غير الصحيح والموافقة
المنتهية أوذات مدة تتجاوز ساعة. Email في argv يجب أن تطابق البريد الموقّع
بعد إزالة ASCII Spaces فقط؛ لا تعيد CLI تفسير الموافقة لبريد آخر.
`deployment_id` إلزامية في السياسة المحمية وPayload الموقعة، ويجب تطابقهما.
صيغتها ASCII غير سرية: حرف/رقم ثم حتى 127 حرفًا من حروف وأرقام و`._:-`.
لا Database URL أوCredentials فيها، ولا CLI flag أوPublic Client input يختار
القيمة المتوقعة. تُرفض الموافقات والسياسات القديمة التي لا تحتويها.
يجب أن يخصص مسؤول النشر ID مختلفة لكل بيئة وأن يربط السياسة بإعداد اتصال
الخدمة الموثوق؛ تغيير ID والسياسة أواتصال DB بواسطة مالك تشغيل موثوق يبقى
خارج مقاومة التوقيع. هذه ليست بصمة تلقائية لقاعدة Database، ولا تمنع مشغّل
بنية مخول من تهيئة بيئتين خطأً بالـID نفسها. لا تعديل Schema أوMigration؛
Digest الموقعة تشمل ID، وتحفظ Audit الإصدار ID ضمن Metadata المسموحة.

`bootstrap_authorization_id` وحدها لا تمنح سلطة. تستخدم CLI Grant موثقة،
وتحفظ Audit بمرجع الموافقة وDigest لها وهوية المشغّل والمفتاح والإسناد فقط.
القبول يتحقق من أثر الإصدار المصرح في Audit، ومن بقاء شرط أول Administrator،
ومن الإسناد والانتهاء. لا تُرفع طوابع التفعيل إلا بعد إثبات الرمز.

إعادة استخدام مرجع الموافقة داخل المؤسسة مرفوضة. الموافقة الجديدة يمكن أن
تحل محل Bootstrap pending فاشلة التسليم مع إبطالها؛ لا يجوز إعادة إصدارها
بنفس المرجع. وجود Administrator حتى لو كان inactive، أوBootstrap مقبولة
سابقًا، يمنع هذه CLI: Recovery عملية مستقلة غير منفذة. لا Password Reset
ولا Role Reset لحساب موجود، ولا تحويل Directory Identity عبر Bootstrap.

إلغاء مفتاح تشغيلي لا يسحب تلقائيًا سرًا سبق إصداره؛ صلاحيته القصيرة محدودة
بانتهاء الموافقة. إدارة Key Rotation/Revocation والتشغيل الفعلي تتطلب إجراءات
تشغيلية مراجعة. لم تُهيأ Policy حقيقية ولم يُشغّل Bootstrap على Database فعلية.

## الاختبارات والنتائج

تستخدم اختبارات A3 PostgreSQL جديدة مؤقتة وSchema منفصلة لكل اختبار، عبر
Fixture A1 التي تتحقق من ملكية Engine وهوية Cluster وSearch Path قبل الترحيل.
لا تقبل URL خارجية ولا DATABASE_URL لتحديد قاعدة الترحيل الاختبارية.

اختبارات A3 تغطي إنشاء/عرض/إلغاء/إعادة إرسال، عزل المؤسسات، انتهاء/إلغاء/استهلاك
السر، إنشاء المستخدم وتفعيل Directory، إعادة التحقق من مصدر الدعوة والإسناد،
وحفظ Legacy Profiles وHashes. سباقات PostgreSQL تشمل القبول المزدوج، وresend
مع revoke ومع القبول، وCreate مكررة. حقن أخطاء Audit يثبت Rollback لإنشاء
الدعوة والعضوية وإعادة الإرسال. توجد اختبارات لعدم تسريب الأسرار في الردود
والـLogs وrepr وargv، وفشل Mailer وحالات انقطاع تسجيل نتيجة النقل.

اختبارات Bootstrap تتحقق من Ed25519 وربط الهوية والهدف والمدة ومنع Recovery
وتكرار المرجع وإعادة ضبط حسابات قائمة. الاختبار المصرح لـCLI يستبدل مصدر
السياسة التشغيلية بهوية ومفتاح اصطناعيين وSession اختبارية؛ لا يُهيئ ACL
حقيقية أومفتاحًا خاصًا تشغيليًا. فحص CLI غير المصرح لا يفتح Database.

نتائج الجولة الأصلية قبل تصحيحات المراجعة، بتاريخ 2026-10-30، على Windows وPostgreSQL 18.4 المعزولة:

| الجولة | النتيجة | المدة |
|---|---|---|
| دعوات وعضوية A3 | 31 passed | 65.60 ثانية |
| تزامن وAtomicity | 14 passed | 38.79 ثانية |
| Bootstrap وCLI والموافقة | 23 passed | 34.26 ثانية |
| حدود الأمان والتسريب والفشل | 19 passed | 43.59 ثانية |
| A1 + A2 + A3 + Regression كاملة | **399 passed, 1 skipped, 4 warnings** | **488.30 ثانية** |

توجد **87 حالة A3 جديدة** ضمن الجولة الكاملة؛ لا تجمع أعداد الجولات المتداخلة.
اختبارات A3 نفسها جميعها نجحت دون Skipped، واستخدمت PostgreSQL مؤقتة فقط
في حالات Database. تشمل مجموعة الانحدار أيضًا اختبارات SQLite داخل الذاكرة
الموجودة أصلًا؛ لم تُفتح قواعد SQLite الموجودة في المشروع.

سبب التجاوز الوحيد: `test_postgres_email_comparison_uses_database_collation`
في نسخة SQLite من A2، لأن المقصود سلوك PostgreSQL الفعلي. نظيره على PostgreSQL
نجح؛ لم تُتجاوز اختبارات PostgreSQL بسبب غياب Opt-in. التحذيرات الأربعة سابقة
في Foundation overview عند السطرين 153 و162، لكل من نسختي SQLite/PostgreSQL؛
لم يُعدّل هذان الاستعلامان ضمن A3.

اختبارات الفشل كُتبت قبل المسارات المستهدفة وأثبتت غيابها، ثم أُعيدت بعد التنفيذ.
كشف اختبار CLI أن argparse كانت تعيد وسيط Password غير معروف، وصُححت رسالة
الخطأ ثم نجح الاختبار. صُحح أيضًا تعارض اسم وسيط Token في Test Helper قبل
إعادة فحوص حدود الأمان. لا توجد إخفاقات متبقية في الجولة النهائية.

`git diff --check` وفحص المسافات للملفات الجديدة نجحا. لم يكشف فحص أنماط
الأسرار ومراجعة المحتوى مواد سرية ثابتة أوبيانات إنتاجية ضمن التغييرات.
فحوص التنظيف تتأكد من عدم بقاء Cluster أوملف Password اختباري من هذه المهمة.

التوصية: **A3 جاهزة للمراجعة التقنية والأمنية محليًا**، مع بقاء بوابات التفعيل
التشغيلية المذكورة أدناه. لم تُنشأ Policy أوCredentials أوProvider حقيقية،
ولا ادعاء بأن Bootstrap أوبريد الإنتاج اختُبرا فعليًا.

## القيود قبل النشر

- A3 ليست قابلة للنشر منفردة؛ تبقى A4/A5 وبقية Batches ضمن نطاقها المعتمد.
- لا يوجد Provider بريد فعلية أوواجهة قبول دعوة؛ Mailer الافتراضية failed.
- يلزم تهيئة Trust Policy وSigning Authority ومؤسسة وأدوار Tenant وصلاحيات DB
  تشغيلية، واختبار ACL والتسليم في بيئة التشغيل المعتمدة قبل التفعيل الفعلي.
- حد التزامن يخص عمليات A3؛ لا يحوّل جميع كتابات التطبيق إلى Serializable.
- سباق Last Administrator السابق على A3 ما زال في قائمة إصلاحات ما قبل النشر.
- تبقى مخاطر توقيت bcrypt وغياب Rate Limiting وSession Revocation المستقلة
  الموثقة في A2. يحتاج Endpoint القبول العام ضوابط تشغيلية قبل النشر.
- Audit ليست مخزنًا غير قابل للتعديل على مستوى Database؛ يلزم حوكمة تخزين
  وتشغيل مستقلة وفق خطة المنصة. لا يوجد ادعاء exactly-once للبريد.

حتى انتهاء التنفيذ والمراجعة الأصلية لم يُنشأ Commit أوPush أوPR، ولم يُعدل
master أوRender أوNetlify أوبيانات فعلية. تفويض الحفظ اللاحق موضح أدناه؛
لا يتضمن الانتقال إلى A4.

## A3 Security Corrections — 2026-10-30

بقي HEAD عند A2 `1f7a105d93395871f0f219e7d6a835468f6fa632`، وحُفظت جميع
تغييرات A3 السابقة وغير المتتبعة. التصحيحات تخص الخدمات والاختبارات وهذا
التقرير فقط؛ لا تعديل Models أوMigrations أوFrontend أوLast Administrator
Race أوRate Limiting.

### F1 — إثبات السبب والإصلاح

أنشأ اختبار PostgreSQL الحقيقي حاجزًا بعد اكتساب قفل الدور في A3، ثم شغّل
HTTP PATCH الدور من A2 بمسؤول ثانٍ، وراقب `pg_blocking_pids` من اتصال منفصل
قبل السماح لـA3 بطلب قفل Directory User. أنتج الكود الأصلي `40P01` في A2
في حالتي Create وAccept: **2 failed خلال 24.71 ثانية**. السبب دورة
`A3: Role FOR UPDATE -> User` مقابل `A2: User UPDATE -> Role FK KEY SHARE`.
الحساب الثاني يمنع حجب دورة الدور بسبب Audit FK لحساب المسؤول الأول.
محاولة الاختبار الأولى استخدمت المسؤول نفسه وتوقفت عند حاجز غير مناسب
قبل UPDATE؛ صُحح الحاجز قبل اعتماد دليل `40P01`، ولم تعتبر تلك النتيجة
إثباتًا للـDeadlock. فشل Sandbox في إنشاء ملف Password مؤقت كذلك لم يعتبر
اختبار أمان ناجحًا؛ أُعيد التشغيل المصرح خارج Sandbox على Cluster جديدة.

استُبدل قفل Role/Department بـSHARE وقفل حساب المسؤول بـNO KEY UPDATE؛
كلاهما يحتفظ بمنع تغييرات التفويض ويسمح بمراجع FK للتدقيق والمستخدمين.
لا تعديل مسار تحديث A2 ولا Retry تخفي السبب. الاختبار الأصلي بعد الإصلاح:
**2 passed خلال 20.10 ثانية**. التوسعة إلى المسؤول نفسه ومسؤول مختلف،
مع إثبات انتظار تعديل الدور وتعطيل مصدر الدعوة ثم رفض القبول بعده:
**6 passed خلال 23.52 ثانية**. تؤكد الحالة النهائية العضوية والدعوة وحفظ
جميع Legacy Users غير المستهدفين، دون Partial Writes أوHTTP 500 متوقع.

### F2 — الحماية المنفذة وحدود الإثبات

أزيل Check-by-path ثم Read-by-path من Windows لصالح المقابض المثبتة وفحص
GetSecurityInfo/ReadFile المذكور أعلاه. اختبارات `test_a3_windows_policy.py`
تستخدم WinAPI فعلية، وSecurity Descriptors اصطناعية داخل الذاكرة، وملفات
وJunction داخل مجلدات اختبار مملوكة فقط؛ لا مفاتيح أوPolicy تشغيل حقيقية.
نجحت **16 حالة Native**: رفض المالك وحقوق التعديل غير الموثوقة وNull DACL،
قبول ACL قراءة سليمة، تجاهل Inherit-only، رفض Junction، ومنع الكتابة والحذف
والاستبدال أثناء احتجاز المقبض، والقراءة من الملف الأصلي نفسه.

**F2 غير مغلقة بإثبات End-to-end إيجابي على جهاز التطوير.** الجلسة غير
مرفوعة الصلاحيات، وبعض ACL أسلاف المسار تسمح بتعديل غير موثوق؛ التصميم
يرفضها مغلقًا ولا يخفف التحقق. اختبار السلسلة الإيجابي متجاوز دون Opt-in
`CHANGEFLOW_A3_WINDOWS_TRUST_TESTS=1` على Runner Windows مخصص ذي أسلاف
موثوقة وToken مرتفعة. الاختبار يغير فقط Owner/DACL لكائنات tmp_path
الاصطناعية، ولا يصلح أسلاف OS تلقائيًا. وجود هذا التجاوز ليس دليل نجاح.

خطة الإغلاق: تجهيز Runner Windows معتمدة بسلسلة مسار اختبار موثوقة بصورة
مستقلة، وتفعيل الاختبار الإيجابي وإثبات قراءة السياسة الاصطناعية، ثم مراجعة
ACL وسلوك مشاركة المقابض على التخطيط التشغيلي المقصود. إذا كان ضبط أسلاف
النظام يتطلب تغيير ACL واسعًا، يلزم تصميم تشغيلي وموافقة مستقلة؛ لا يوصي
هذا التقرير بتغيير أذونات جذر C أوProgramData تلقائيًا. دعم تخطيط Windows
قياسي يسمح بكتابة مشتركة إلى الأسلاف قد يحتاج تصميم فتح نسبي Native آخر
ومراجعة مستقلة بدل تخفيف شروط ACL. لا يدعي التصحيح إزالة كل TOCTOU أوحماية
من مسؤول OS مخول بتعديل العملية نفسها.

### F3 — Deployment Binding

أضيفت ID إلزامية إلى Trust Policy وPayload الموقعة وGrant وAudit الإصدار.
نجحت **8 حالات** لرفض بيئة مختلفة أوID مفقودة/فارغة أوعنوان Credentials
اصطناعي بدل ID، وتحميل القيمة الصحيحة من السياسة المحمية. قبل التنفيذ
كانت النتيجة **6 failed, 2 passed**، وبعده **8 passed خلال 0.55 ثانية**.
تبقى خوارزمية Ed25519 وحالة استهلاك مرجع الموافقة داخل Database كما هي.
لا UUID جديد في Database ولا Migration، ولا استخدام لأي Credentials فعلية.

### Bootstrap Concurrency وReplay وRollback

أضيفت `test_a3_bootstrap_concurrency.py`، وتفرض معاملات متداخلة تنتظر بالفعل
قفل المؤسسة عبر مراقبة PostgreSQL. تغطي إصدارين بالتصريح نفسه، وإعادة
الاستخدام بعد Revoke/Expiration/Replacement، وسباق Replacement مع قبول
القديم بكلا الترتيبين، وفشل Audit وDivision-by-zero فعلي داخل Transaction
لكل من الإصدار والقبول، ثم التعافي الصحيح. تتحقق من عدد Administrators
والعضويات والدعوات وAudit ومن عدم تغيير الحسابات في Tenants الأخرى؛ تختبر
البريد نفسه لحساب Login وDirectory في مؤسسة أخرى مع Workspace Login.
Bootstrap لا تملك Admin Resend/Revoke endpoint: Revoke/Expiry تُهيآن داخل
Schema الاختبار المملوكة، وReplacement تستخدم المسار المصرح الحقيقي.
فشل الإصدار قبل Commit لا يستهلك الموافقة؛ فشل النقل بعد Commit يستهلكها.

الجولة المركزة لـBootstrap القديمة والجديدة وربط البيئة:
**43 passed خلال 71.86 ثانية**. جميع Mailers اصطناعية داخل الذاكرة.

### Final Regression والتحقق من الملفات

الجولة الكاملة بعد التصحيحات على Windows وPostgreSQL **18.4** المعزولة:
**441 passed, 2 skipped, 4 warnings خلال 555.17 ثانية (9:15)**.
تشمل A1 وA2 وA3 وكل Regression؛ لا تُجمع مع الجولات المركزة المتداخلة.
أصبحت حالات A3 **130**: منها **129 passed و1 skipped** في الجولة الكاملة.
كل اختبارات Database الجديدة على PostgreSQL مملوكة ومؤقتة؛ بقيت اختبارات
SQLite القديمة داخل الذاكرة. لا اتصال بقاعدة موجودة أوProduction.

الاختباران المتجاوزان:

1. `test_postgres_email_comparison_uses_database_collation[sqlite]`: يتطلب
   Collation الفعلية على PostgreSQL؛ نظيره PostgreSQL نجح.
2. `test_native_positive_policy_chain_on_prepared_windows_runner`: يحتاج
   Opt-in وRunner Windows مخصصة ذات أسلاف ACL موثوقة وToken مرتفعة؛ غير
   مثبت على جهاز التطوير، ويبقى بوابة F2 مفتوحة.

التحذيرات الأربعة نفسها في `foundation.py:153,162` بسبب Subquery داخل IN،
لكل من SQLite/PostgreSQL؛ لا تحذيرات جديدة من التصحيحات، ولم يغيّر هذا الطلب
استعلامات Foundation. نجحت اختبارات JWT v2 وWorkspace Login والعضوية
وسياسة bcrypt وحفظ Users/Hashes القديمة ضمن Regression. تفعيل Directory
المستهدفة يظل التغيير المصرح المقصود؛ الحسابات القديمة غير المستهدفة محفوظة.

نجح `git diff --check` وفحص whitespace للملفات الجديدة وتحليل Syntax
لـ19 ملف Python معدلة/جديدة. لم يظهر Secret حقيقي أوبيانات إنتاجية أوامتداد
مؤقت ضمن ملفات Git؛ تطابق Credentials URL الوحيد Placeholder متعمد في
اختبار رفض ID غير سليمة. بقيت أربعة ملفات Modified وستة عشر Untracked
خاصة بـA3، وStaging فارغة. HEAD وmaster كما كانتا دون Commit/Push/PR.

الملفات التي تغيرت في هذه الجولة تحديدًا: `invitation_service.py`،
`bootstrap_authorization.py`، `windows_trust_policy.py` الجديدة،
`test_a3_bootstrap.py`، والتقرير الحالي، وأربعة ملفات اختبار جديدة:
`test_a3_security_corrections.py` و`test_a3_environment_binding.py`
و`test_a3_bootstrap_concurrency.py` و`test_a3_windows_policy.py`.
سائر تغييرات A3 السابقة محفوظة دون إعادة تنفيذ المرحلة.

### بوابة الاعتماد

لا تزال F2 تحتاج الإثبات الإيجابي التشغيلي الموصوف، ولذلك **لا يوصى باعتماد
A3 للـCommit حاليًا على أنها أغلقت جميع ملاحظات المراجعة**. Last Administrator
Race وRate Limiting متطلبات إلزامية قبل Production، ولم تُعالجا هنا.
لا نشر منفرد لـA3 ولا انتقال تلقائي إلى A4.

## A3 Development Checkpoint — حدود الحفظ المعتمدة

أذن المستخدم بحفظ تغييرات A3 الحالية على
`feature/phase2-batch-a-tenant-security` فقط، برسالة Commit:
`feat(tenant): implement A3 invitations and guarded bootstrap`.
يشمل الإذن Commit وPush عادية دون Force Push، ولا يشمل PR أوMerge أوتغيير
master أوDeployment أوMigrations أوتشغيل Bootstrap أوبريد حقيقي أوبدء A4.
النتائج السابقة أعلاه تخص التنفيذ والتحقق قبل هذا الـCheckpoint؛ بيانات
HEAD وWorking Tree المذكورة هناك هي خط الأساس التاريخي وليست ادعاءً بأن
الحفظ اللاحق لم يحدث.

| Finding | الحالة عند الحفظ |
|---|---|
| F1 — PostgreSQL Deadlock | **مغلقة بالاختبارات**: أُعيد إنتاج `40P01` ثم نجحت اختبارات التداخل ومنع تغييرات التفويض بعد التصحيح |
| F2 — Windows Trust Policy | **غير مغلقة نهائيًا**: الحماية منفذة، لكن Native Positive Integration لم يثبت نجاحها لعدم توفر Runner موثوقة ومهيأة |
| F3 — Environment Binding | **مغلقة بالاختبارات**: مطابقة Deployment ID من السياسة المحمية مع الموافقة الموقعة ورفض البيئة المختلفة |

**Bootstrap غير معتمدة للاستخدام الحقيقي. حفظ A3 كـDevelopment Checkpoint
لا يعني Production Readiness ولا قبولًا أمنيًا نهائيًا ولا يجيز تفعيلها.**
الاختبار الإيجابي المتجاوز ليس ناجحًا، ولا توجد بيانات تثبت تشغيل السلسلة
الكاملة على بيئة Windows التشغيلية المقصودة.

### Windows Runner وACL المطلوبة لإغلاق F2

- Runner Windows داخل VM مؤقتة معزولة، بلا قواعد إنتاج أوأسرار أومجلدات
  مضيف مشتركة. تجهز الصورة جهة بناء موثوقة مسبقًا؛ لا تعدّل الاختبارات ACL
  الجهاز الحالي أومجلد المستخدم أوالمشروع أوWindows أوOneDrive.
- يجب أن تحقق السلسلة `C:\` ثم `C:\ProgramData` ثم `ChangeFlow` ثم ملف
  السياسة قواعد Owner/DACL الحالية: مالك موثوق من SYSTEM أوAdministrators
  أوTrustedInstaller، دون Reparse Points أوAllow لحقوق تعديل غير موثوقة
  أوDelete Child أوتغيير Owner/DACL. لا Null/Missing DACL أوACE غير مدعومة.
- تمنح جهة التجهيز حساب Reader عاديًا Read/Traverse وREAD_CONTROL وقراءة
  Attributes للمجلدات وGENERIC_READ للملف فقط، دون Write/Delete/WRITE_DAC/
  WRITE_OWNER. القراءة الآمنة لا تتطلب Administrator؛ تهيئة Fixture ذات
  Owner موثوق هي ما يستلزم مرحلة تجهيز مخولة. الاختبار الإيجابي الحالي
  يفرض Token مرتفعة لتهيئة Fixture، فلا يثبت وحده القراءة بحساب Reader.
- يشغل الاختبار الإيجابي الحالي مع
  `CHANGEFLOW_A3_WINDOWS_TRUST_TESTS=1` وtmp_path خاصة تحت أسلاف موثوقة؛
  ثم تُثبت قراءة سياسة اصطناعية مسبقة التجهيز بحساب Reader العادي، دون CLI
  Bootstrap أوDatabase. لا تخفيف Assertions ولا تغيير قائمة الثقة لتمريره.
- تعزل الاختبارات السلبية تغييرًا واحدًا كل مرة تحت أسلاف سليمة: مالك أوACL
  غير آمنة، Reparse Point، أومحاولة استبدال متزامنة. يجب ألا تنجح لمجرد رفض
  جذر C قبل الوصول إلى العنصر المقصود. يثبت Harness أن استدعاءات فحص الأمن
  والقراءة الأصلية تستعمل المقبض نفسه دون محاكاة نتائج WinAPI.
- تنظف الكائنات الاصطناعية وتُتلف VM بعد حفظ نتائج الاختبارات. لا مفاتيح
  أوسياسة تشغيل فعلية. إذا كان التخطيط المطلوب يحتفظ بصلاحيات كتابة مشتركة
  إلى الأسلاف، فتلزم مراجعة تصميم منفصلة؛ السياسة الحالية متحفظة أكثر من
  الحد الأدنى في بعض الحالات، ولا يجوز تجاوزها أوتغيير ACL النظام تلقائيًا.

إعادة التحقق المحلية الأخيرة، تحت Token غير Administrator ودون تعديل الكود:
**16 passed, 1 skipped خلال 0.67 ثانية** لاختبارات F2. تعثر إنشاء Junction
داخل Sandbox، ثم نجحت الاختبارات نفسها خارج قيوده بحساب عادي مع شرط يرفض
Token Administrator. نُظفت الملفات التجريبية. لم يتحقق النجاح الإيجابي
الكامل، ولذلك لا تغلق هذه النتيجة F2. تبقى نتيجة Regression الكاملة السابقة
**441 passed, 2 skipped, 4 warnings**، ولم تُعد تشغيلها لأجل تعديل التوثيق.

### متطلبات إلزامية قبل Production

- إغلاق F2 بالأدلة على Runner والتخطيط التشغيلي المعتمدين.
- إصلاح Last Administrator Race السابقة؛ ما زال العد والتغيير غير ذريين.
- إضافة Rate Limiting وضبط الموارد لمساري Login وقبول الدعوة العام.
- ربط مزود بريد حقيقي واختباره، وتسوية فشل التسليم والتأخير؛ Fake Mailer
  ليست إثبات تسليم حقيقي، ولا يوجد ضمان exactly-once أوRetry آلية دائمة.
- استكمال بقية العمل المعتمد لاحقًا؛ لا تنفذ عملية الحفظ هذه أي مرحلة أخرى.
