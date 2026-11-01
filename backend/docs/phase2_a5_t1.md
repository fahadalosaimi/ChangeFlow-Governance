# A5-T1 — Security Preflight وIdentity Contract & Secure API Client

التاريخ: **2026-11-01 — Asia/Riyadh**.

**الحالة النهائية — Ready for Development Checkpoint، بانتظار اعتماد المالك الصريح للحفظ فقط.** اكتملت إعادة Backend الواسعة بعد التصحيح: **399 passed /0 failed /1 skipped /18 deselected في 635.56s، Exit0**؛ منها **235 PostgreSQL passed /0 skipped**. أصلحت قابلية نقل Runner بعد RED→GREEN دون تعديل التطبيق. Frontend **13 passed** وTypecheck/Build ناجحان، وLint **0 errors /6 warnings سابقة**؛ Gitleaks **24 ملفًا، 0 Findings**. **القسم 13 هو المرجع الحالي**؛ لا Stage/Commit/Push أوA5-T2، ولا إغلاق Legacy/F2/B/C أواعتماد Production.

**السجل الأولي قبل التفويض المشروط:** اعتمد المستخدم DEC-01/02/03/04/10 وحدود DEC-16، ثم أوقفت Preflight التنفيذ عند اكتشاف Credentials محتملة. أجيز لاحقًا التنفيذ الاصطناعي بعد العزل كما في 12؛ مراجعة Checkpoint الأحدث في 13 هي المرجع الحالي، مع بقاء مخاطر الحسابات القديمة دون إغلاق.

المراجع: [الخطة الرئيسية](development_master_plan.md)، و[A1](phase2_a1.md)، و[A2](phase2_a2.md)، و[A3](phase2_a3.md)، و[A4](phase2_a4.md). التفويض الأحدث «A5-T1 Final Checkpoint Review» يطلب إعادة المجموعة الواسعة والمراجعة والManifest دون Stage/Commit/Push. لا قاعدة قديمة أوCredentials فعلية أوA5-T2 أوGit/Deployment.

**ملاحظة زمنية:** الأقسام 1–8 Preflight، و9 العزل، و10 Scanner، و11 خطة المعالجة، و12 التنفيذ والاستكمال، و13 مراجعة Checkpoint الحالية. الأعداد وحالات الانتظار السابقة تاريخية في سياقها ولا تجمع؛ لا إعادة تصنيف بلا دليل جديد، ولا تتحول Credentials القديمة إلى آمنة بسبب تقدم الاختبارات.

## 1. خط الأساس

| العنصر | النتيجة |
|---|---|
| Repository | `bigest11/ChangeFlow-Governance` |
| Remote | `https://github.com/bigest11/ChangeFlow-Governance.git` للـfetch/push |
| Branch | `feature/phase2-batch-a-tenant-security` |
| HEAD | `5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5` |
| Working Tree قبل الفحص | لا تعديلات متتبعة؛ `backend/docs/development_master_plan.md` هي Untracked الوحيدة المتوقعة؛ Staging فارغة |
| المراجع | Feature وmaster وorigin counterparts وorigin/HEAD، إضافة إلى مراجع Codex المحلية الداخلية التي شملها `--all` |
| التاريخ المتاح | 9 Commits reachable محليًا، تشمل لقطات Codex داخلية؛ المستودع ليس Shallow. هذا ليس ادعاءً بجلب كل ما هو موجود على GitHub |

لم يُنفذ Fetch أوCheckout أوCommit أوPush أوPR أوHistory Rewrite، ولم تُغير master أوأي Ref يدويًا. مراجع Codex الداخلية هي لقطات App موجودة، وليست Commits أنشأتها هذه المهمة على Feature Branch.

## 2. أداة الفحص ونطاقها

لم تظهر Gitleaks أوTruffleHog أوdetect-secrets في PATH المفحوصة. لم تُثبت أدوات أوتُضف Dependencies أوCI Configuration. استُخدم فحص محلي في الذاكرة بPython Standard Library: Regex للأنماط المعروفة وAST لكلمات المرور الثابتة في استدعاءات Python. لا يستورد كود التطبيق أوSetup، ولا يتصل بDB أوبمزود خارجي.

**هذه أداة كشف محدودة وليست بديلًا مثبت التكافؤ لكل قواعد Gitleaks، ولا شهادة خلو من الأسرار.** النتيجة موجبة بما يكفي لإيقاف Gate؛ إغلاق المراجعة يحتاج فحصًا مستقلًا أشمل بأداة معتمدة إذا أذن المستخدم بتوفيرها.

| النطاق | ما فُحص فعليًا |
|---|---|
| Git tracked الحالية | 106 ملفات، بإجمالي 992,879 bytes |
| Untracked غير المتجاهلة قبل كتابة التقرير | ملف الخطة فقط، 92,221 bytes |
| التاريخ المحلي | 189 سجل Blob/Path من `git rev-list --objects --all` و`git cat-file`، بإجمالي 2,248,338 bytes؛ شمل نسخًا سابقة وملفات لم تعد في HEAD |
| Ignored/config/build المحلية | 15 ملفًا، بإجمالي 537,923 bytes؛ شملت `.env` ونسخة إعداد احتياطية وScripts و`frontend/dist` ونسخة Frontend احتياطية |
| الأرشيفات | 135 عضوًا، بإجمالي 938,517 bytes، داخل `backend_backup_before_update.zip` و`backend/changeflow_backend_review.zip`؛ قراءة داخل الذاكرة دون استخراج أوتنفيذ |

الأعداد تخص تمريرة الفحص قبل إضافة هذا التقرير وتحديث الخطة؛ نسخ التاريخ والأرشيفات تتداخل مع الملفات الحالية، فلا تجمعها بوصفها عدد ملفات فريدة أوSecrets فريدة.

فئات الكشف: Gemini/Google API key signatures، وGitHub/Slack access-token signatures، وAWS access key IDs، وJWT literal، وPrivate key headers، وCredential connection URLs، وSensitive assignments ومنها JWT/Gemini/SMTP/DB/API secrets، وHardcoded password arguments عبر AST.

الماسح يصدر Rule/Path/Line/Source وGit Blob ID عند الحاجة فقط؛ لا يصدر Match text أوجزءًا من Secret أوHash لقيمتها. Git Blob ID معرف لمحتوى ملف Git كامل، وليس Hash منشورًا لقيمة سرية.

### الحدود والاستثناءات

- لا Fresh Fetch؛ لا حكم على فروع/Tags/PR refs أوForks أوCommits بعيدة غير متاحة محليًا.
- `--all` شمل مراجع Codex الداخلية، لكنه لا يشمل بالضرورة dangling أوreflog-only objects أوGit LFS payloads خارج objects المحلية.
- لم تُفحص ملفات `.git` التشغيلية أوdependency directories `node_modules/venv/.venv` أوPython/test caches. Build output الموجودة فُحصت مستقلة عن node_modules.
- **لم تُفتح** `backend/change_impact.db` و`backend/change_impact.backup.db`، ولم تُقرأ Tables/Rows أوتُنفذ SQL. لا ادعاء بشأن محتواهما.
- الأرشيفات لها حدود 20 MB لكل عضو و100 MB لكل أرشيف، مع رفض الأعضاء المشفرة. لم يسجل التشغيل تخطيًا بسبب هذه الحدود؛ قواعد البيانات استُثنيت صراحة.
- Regex generic قد ترصد Types/Variable references وFixtures وPlaceholders؛ لا تعتبر كل إشارة ثغرة مستقلة. لم تُعتمد Allowlist عامة لمسار Tests، ولم تُخف تطابقات Provider-specific على أساس المسار.
- تصنيف URL بRegex أولية كان واسعًا في قبول Placeholder؛ أُعيدت مراجعة Password داخل DATABASE_URL محليًا، بما فيها Percent Decoding، **دون طباعة القيمة**، وصُنفت Credential محتملة. التصنيف النهائي أدناه يتقدم على الإشارة الأولية.
- لم يُختبر أي Key/Password مع خدمة خارجية، ولم تُقرأ Secrets من مزود أوتُرفع ملفات إلى Scanner خارجي.

## 3. النتائج التي أوقفت A5-T1

التصنيفات أدناه توضح قابلية الاستخدام/التعرض المحتملة، ولا تثبت اختراقًا أوأن هذه القيم صالحة حاليًا أوتخص Production.

| ID | النوع والمكان، دون قيم | التقييم والأثر |
|---|---|---|
| PRE-01 | 4 Password literals في `backend/setup_auth_users.py:193,204,215,226`، تستعمل كوسيط password لإنشاء/تحديث الحسابات | **High مشروطة بالاستخدام:** مصدر متتبع قابل لقراءة القيم منه، والأداة تكتب Password Hash وتعطي Active/Role/Organization؛ لا دليل أن الحسابات الفعلية تستخدمها الآن. ليست Fixtures معزولة يمكن إسقاطها آليًا |
| PRE-02 | كلمات المرور نفسها من حيث مواضع الأدوات تظهر في 3 نسخ تاريخية لـSetup؛ نسخة حالية بالأسطر أعلاه، وأخرى عند 200/211/222/233، وأقدم عند 170/181/192 | **Git History exposure candidate:** حذفها من HEAD وحده لا يكفي. المراجع الحالية المحلية لـFeature وmaster وorigin counterparts تحتوي نسخة بأربع Password literals. لا ادعاء بأنها نُشرت للعامة أوتحقق Remote جديد |
| PRE-03 | `JWT_SECRET_KEY` مهيأة في `backend/.env:1`، و`backend/phase2a_config_backup_20260730_104625/.env:1` | **Signing-secret candidates:** عالية إذا كانت نشطة ومتاحة لجهة غير مخولة. وجودها المحلي لا يثبت تسريبها إلى Git؛ مصدرها وبيئتها وصلاحيتها لم يتحقق منها تشغيليًا |
| PRE-04 | Password داخل `DATABASE_URL` في `backend/.env:5` | **Database credential candidate:** لا اتصال للتحقق، ولا تصنيف تلقائي بأنها Credential اختبار. يلزم تحديد البيئة والملكية والاستخدام قبل أي معالجة |
| PRE-05 | نسخ Setup ذات أربع Password literals داخل الأرشيفين المحليين، في `setup_auth_users.py` عند 200/211/222/233 | **Exposure copies:** يلزم تضمين Backups/Review packages في المعالجة. لا استخراج أومحو أوتعديل للأرشيفات جرى |

استُخدمت القراءة الساكنة وAST لتأكيد أن PRE-01 قيم Literal تدخل `upsert_user`، وليست مجرد أسماء حقول أوفحوص Validation. لم تُنشر أي من هذه القيم في المخرجات أوالتقرير.

لا توجد في نتائج Signature rules المستعملة مطابقة موجبة لصيغة Gemini/Google key أوGitHub/Slack token أوAWS access key ID أوJWT literal أوPrivate key header. **هذا حد للكشف المنفذ، وليس إثبات عدم وجودها**؛ الأسرار غير الموقعة بنمط معروف قد لا تُكتشف. Generic assignment matches في كود/Types وTests والتوثيق والـBundle لا تُحسب تلقائيًا Credentials حقيقية.

### مقارنة القيم المحلية بالتاريخ

أُجريت مقارنة حرفية داخل الذاكرة لقيم JWT المحلية في الملفين وPassword المفكوكة من DATABASE_URL مع Blobs التاريخ المحلي reachable: **لا تطابق حرفي للقيم الثلاث ضمن المحتوى التاريخي المفحوص**. لم تُطبع القيم أوHashes لها، ولم يحدث اتصال بالخدمات. لا يثبت ذلك غياب قيمة مشفرة/مجزأة أونسخة مختلفة، ولا يثبت غياب Exposure خارج Git المحلي. وجود الإعداد المحلي وحده لا يعني أنه تسرّب إلى Git، بينما Password literals في Setup متتبعة وموجودة تاريخيًا بصورة مستقلة.

## 4. أدوات Setup ومسارات الاستدعاء

| الأداة | ما ثبت ساكنًا | مسار الوصول |
|---|---|---|
| `backend/setup_auth_users.py` | `upsert_user` يعيد كتابة organization_id/role_id/is_active/password_hash عند 99/101/105/106؛ بحث Email عالمي، واختيار أول Organization، وPrint calls في 231/236/242/248/254 تشمل بيانات حساب/اعتماد | Script main guard عند 268؛ لا Guard خاص بالأداة يرفض Production. يمكن استدعاؤها يدويًا إذا توفرت إعدادات DB وصلاحياتها؛ لا يلزم المرور بـPermission Matrix أوSigned Bootstrap |
| `backend/seed_foundation.py` | ينشئ Foundation Demo وGlobal Roles/Risk Rules وفق افتراضات قديمة، وCommits متعددة قد تترك تهيئة جزئية؛ لم يُرصد فيه password Literal argument كالسابقة | Script main guard عند 628؛ لا Guard خاص يمنع Production. ليست بديلًا عن A1 Migrations أوA3 Bootstrap |

**FastAPI:** لا Import أوRoute أوLifespan call لهاتين الأداتين في مسار التطبيق المفحوص؛ لم يُعثر على مسار HTTP مباشر.

**CI/CD وBuild/Deployment:** لا GitHub Workflows أوإعدادات Deploy المتتبعة المعتادة في قمم مراجع الفروع المفحوصة، ولا References للأداتين في Scripts/Config المحلية المفحوصة. المراجع النصية الموجودة في التقرير التاريخي ليست Invocation. لا مسار تشغيل تلقائي خطر مثبت ضمن هذا النطاق.

**حدود الإثبات:** لم تُفحص إعدادات Hosting أوRunner أوShell profiles خارج Workspace أوصور منشورة أوCI خارجي؛ غياب Reference في المستودع لا يثبت استبعاد الأداة من Artifact أوProduction machine.

لم تُستورد أوتُنفذ الأداتان، ولم تُدعيا في Tests/Initialization. لا Automatic Setup أثناء الفحص، ولا Bootstrap أوبريد. اقتراح منع تضمينهما/استدعائهما في تشغيل فعلي يظل تغييرًا أمنيًا يحتاج اعتمادًا؛ لم يُنفذ ضمن هذا التوقف.

## 5. حالة Backend وFrontend بعد البوابة

- `/auth/me` **لم تتغير**؛ لا `permissions` أو`workspace_slug` مضافة في هذا التنفيذ. العقد المستهدف موثق في A5-T1 بالخطة، وليس Endpoint contract منفذة الآن.
- لا Schema/Model/Migration/JWT v2/Password Hash أوPermission Grant تغيرت.
- لم تنشأ API Client أوTypes أوRuntime Validators أوAuth API جديدة؛ تصميمها المقترح في الخطة لم يتحول إلى Feature جاهزة.
- لم تتغير Login UI أوSessionStorage أوAuth Context أوInvitation UI أوRouting أوDesign/i18n؛ A5-T2/T3/T4 لم تبدأ.

## 6. الفحوص المنفذة وغير المنفذة

| الفحص | النتيجة الفعلية |
|---|---|
| Git baseline/status/refs/shallow check | مطابق؛ لا تغييرات غير متوقعة عند الدخول؛ ليست Shallow clone |
| Secret content scan المحلي | اكتمل بالنطاق والأعداد أعلاه؛ **Gate blocked by findings**، وليس Passed |
| Scanner self-checks | **10 Synthetic checks نجحت**: 7 signature detectors + sensitive assignment + AST password literal + negative variable reference. ليست اختبارات التطبيق أوإثبات شمول الماسح |
| Setup reachability | فحص ساكن فقط؛ لم يثبت استدعاء تلقائي ضمن النطاق؛ Manual runtime risk قائمة |
| Typecheck/Build/Lint | **لم تنفذ في هذه المهمة** بعد إيقاف التنفيذ؛ Build الموجودة فُحص محتواها دون إعادة بنائها |
| Backend/PostgreSQL integration/regression | **لم تنفذ في هذه المهمة**؛ لا DB connection أوSchema اختبارية أوMigration |
| A5-T1 tests الجديدة | لم تكتب أولم تنفذ؛ لا ادعاء Passed أوPytest Skipped |
| Provider/Gemini/SMTP/DB key validation | لم تنفذ عمدًا؛ ممنوعة في Preflight |

لا تُنسب نتائج Stage 0 السابقة (40 Backend tests وBuild/Lint) إلى هذه الجلسة. لا معنى لعدد Regex matches كعدد Secrets فريدة، ولا تُحسب نسخ التاريخ/الأرشيفات Findings تشغيلية مستقلة دون مراجعة.

## 7. المعالجة المقترحة وحدود التفويض

1. اعتماد تصنيف PRE-01..05 وتحديد إن كانت قيم Setup استُخدمت خارج Fixtures؛ يلزم جرد تشغيلي مجمع ومصرح، دون استخراج Password Hashes أوتجربة Passwords أوفتح قواعد قائمة في هذه المهمة.
2. اعتماد Scope لتأمين/تعطيل أدوات Setup القديمة وفصل Fixtures عن Account provisioning. لا تكتف بتغيير كلمات مرور ثابتة إلى قيم ثابتة أخرى أوإخفاء المخرجات فقط؛ يلزم منع الكتابة غير المخولة واختيار Tenant صريح وحفظ البيانات.
3. تحديد مالك وبيئة JWT/DB candidates المحلية والنسخة الاحتياطية، وأماكن توزيعها المحتملة، دون نشرها. وجود Secret في `.env` محلي ليس بمفرده حادث تسريب إلى Git.
4. إذا تأكد استخدام Credentials المتتبعة في بيئة فعلية أوتعرض Secret فعالة، تُعتمد خطة إبطال/Rotation للحسابات/المفاتيح والجلسات المتأثرة؛ لا Rotation أوتغيير Production Secrets الآن.
5. معالجة نسخ الأرشيفات والمشاركة والوصول بسياسة معتمدة؛ لا حذف ملفات المستخدم أوBackups أوGit History تلقائيًا.
6. توفير Scanner مستقل معتمد، مثل نسخة Gitleaks مثبتة الإصدار والمصدر/Checksum، **بعد موافقة المستخدم قبل التثبيت**. تشغيل Offline مع redaction كاملة وتقارير Metadata فقط، على Current Tree والتاريخ المتاح والـBuild؛ لا raw diff أوmatch أوsecret hash في Chat/Logs.
7. لا إضافة Secret Scanning إلى CI الآن. الاقتراح اللاحق: تاريخ كامل متاح، نسخة أداة مثبتة، Custom rule لـpassword literals في أدوات التشغيل، Allowlist دقيقة للFixtures المثبتة فقط، Artifact report منقحة وقيود وصول وFailure على Findings غير المعالجة. يراجع المستخدم الأداة والإعدادات قبل إضافتها.
8. بعد معالجة/تصنيف النتائج وفحص مستقل وإذن استئناف صريح، أعد Git/Preflight ثم ابدأ اختبارات A5-T1 المطلوبة. لا يُفترض أن موافقة التنفيذ الأصلية تبيح تجاوز شرط توقفها.

## 8. حالة التسليم التاريخية قبل تفويض العزل

التغييرات المقصودة Documentation فقط: تحديث `backend/docs/development_master_plan.md`، وإنشاء هذا التقرير. ملف الخطة كان Untracked مسبقًا ويظل محفوظًا دون استبدال محتواه بالكامل؛ لا Application/DB/CI/Security Policy changes.

**A5-T1 غير جاهزة لمراجعة ما قبل Commit كميزة منفذة.** المتاح للمراجعة هو تقرير Preflight وقرار التعامل مع Findings. HEAD والفرع يبقيان خط الأساس، وStaging فارغة، ولا Commit/Push/PR/Deployment. الخطوة التالية معالجة البوابة الأمنية بموافقة محددة، **وليست A5-T2**.

## 9. Credential Safety Remediation — تفويض محلي محدود ونتيجته

التاريخ: **2026-11-01 — Asia/Riyadh**. أذن المستخدم بعزل `setup_auth_users.py` و`seed_foundation.py` واختبارات معزولة وتحديث الوثيقتين فقط. هذا ليس استئنافًا لـA5-T1 أوBatch D، ولا إذنًا لـRotation أوتثبيت Gitleaks أوGit/Deployment.

### 9.1 Audit وقرار العزل

أعيد التحقق من Remote/Branch/HEAD، وكانت التغييرات الوحيدة عند الدخول ملفي التوثيق Untracked المتوقعين. لم يُعثر على Import للأداتين في Python المتتبعة، أوInvocation في Scripts/Config المحلية المفحوصة؛ Reference تقرير A4 وصف تاريخي فقط. لا اعتماد تشغيلي حقيقي مثبت داخل النطاق يوجب الإبقاء على الوظائف الخطرة. إعدادات Hosting/CI خارج Workspace ليست ضمن الإثبات.

استُبدل محتوى كل أداة بDocstring وتوقف `SystemExit` غير مشروط ذي رسالة ثابتة غير سرية. لا Imports ولا Functions قديمة أوDB/Hashing dependencies أوEnvironment/CLI switches لإعادة التفعيل. يفشل الاستيراد والتنفيذ المباشر قبل تحميل تطبيق أوإعداداته أوفتح اتصال، والخروج المباشر Code 1 دون Traceback أوطباعة argv.

أزيلت الدوال القديمة، لا مسار `main` وحده؛ فلا يبقى Helper يتيح إنشاء/تحديث Users/Roles/Organizations/Password Hashes أوFoundation/Risk Rules بالاستيراد المباشر. هذا تعطيل متعمد للأداتين Legacy غير المعتمدتين، وليس تعديلًا لتدفقات التطبيق المشروعة. لم تُشغّل النسخ الأصلية، ولم تُعدل بيانات أوقيم اعتماد فعلية.

### 9.2 الملفات

| الحالة | الملف | المسؤولية |
|---|---|---|
| Modified | `backend/setup_auth_users.py` | إزالة Legacy account provisioning والقيم الثابتة؛ توقف غير مشروط قبل أي Dependency |
| Modified | `backend/seed_foundation.py` | إزالة Legacy Foundation/Role/RiskRule seeding؛ توقف غير مشروط |
| New | `backend/tests/test_legacy_setup_disabled.py` | اختبارات AST وCLI وImport وLifespan بحواجز Side Effects |
| Untracked محفوظة ومحدثة | `backend/docs/development_master_plan.md` | حالة التفويض والعزل والاختبارات والمخاطر والاستئناف |
| Untracked محفوظة ومحدثة | `backend/docs/phase2_a5_t1.md` | هذا السجل؛ أقسام Preflight السابقة أدلة تاريخية لا تُمحى |

لا ملفات Frontend أوAuth/Bootstrap/Windows Trust أوDB Models/Migrations تغيرت، ولا Dependencies أضيفت. لم تُنشأ نسخ احتياطية جديدة تحتوي قيم كلمات المرور المحذوفة.

### 9.3 الاختبارات والأدلة

تكتب الاختبارات وتُثبت RED أولًا دون تشغيل كود Setup الأصلي. يفحص Safety Gate عبر AST أن أول فعل تنفيذي هو Exit برسالة ثابتة؛ يرفض الاختبار نفسه تشغيل أية نسخة تسبق هذا الحاجز أوتفتقر إليه. فحص Password arguments يعد المواضع فقط ولا يحفظ القيم أويدمجها في Assertions.

بعد التعطيل فقط، تُستدعى الملفات المعطلة تحت Run/Import harness في Subprocess معزولة وبيئة جديدة لا ترث Credentials أوDATABASE_URL فعلية. حواجز Import تمنع Application/DB/Hashing dependencies، وAudit hook تمنع اتصال الشبكة/SQLite وفتح `.env`/DB files وكتابة ملفات/إنشاء عمليات. لا `SessionLocal` أو`hash_password` أوكتابة Role/Organization يمكن الوصول إليها من هذين الملفين بعد التوقف. اختبارات CLI مستقلة تؤكد Code 1 وغياب Traceback/argv echo، في development/test/production وحتى مع CI وFlag إعادة تفعيل اصطناعية؛ لا تعتمد الحماية على ENVIRONMENT.

Lifespan الفعلية اختُبرت مع استيراد Legacy محظور وDB connection traps، و`create_all` بديلة اختبارية عند تفعيل Startup DDL. هذا يحافظ على سلوك الإعداد الحالي ويمنع DB داخل الاختبار؛ **لا يدعي أن Production lifespan لا تنفذ DDL إن فعّل المشغّل إعدادها**. drive للكوروتين الحالية لا ينشئ Event Loop أوSockets إضافية. لم يُشغّل Bootstrap تشغيلية أوSetup قديمة أوتُقرأ User Rows فعلية.

| الجولة | النتيجة الفعلية |
|---|---|
| RED AST فقط قبل التعديل، `-k 'entrypoint or operational'` | **3 failed، 1 passed، 20 deselected، 0.42s**؛ فشل توقف مبكر للأداتين ووجود Password arguments في Setup. Seed لا تحتوي Password arguments؛ لا قيم طبعت |
| مجموعة العزل بعد استبدال المصدر | **24 passed، 0 failed، 0 skipped، 5.14s** |
| بعد توسيع حواجز الكتابة وإعادة التحقق | **24 passed، 0 failed، 0 skipped، 4.85s** |
| Backend suite كاملة مع PostgreSQL/F2 positive opt-out، خارج Sandbox بعد موافقة التنفيذ | **216 passed، 317 skipped، 0 failures، دون Pytest warnings، 33.77s، Exit 0**؛ تشمل حالات العزل الـ24 ولا تجمع أعدادها مع الجولات المركزة |

المحاولة الأولى للملف الجديد داخل Sandbox لم تكتمل عند إنشاء Event Loop في اختبار Lifespan؛ أوقفت ولم تُعتمد كجولة ناجحة. أُعيد تصميم Test Harness لاستدعاء Lifespan الحالية دون Event Loop، دون تعديل التطبيق. محاولة Full Suite داخل Sandbox أظهرت 7 Setup errors مبكرة ثم تعلقت في `test_workspace_login_and_v2_claims_preserve_hash_and_email[sqlite]`؛ Stack dump حدد `socket._fallback_socketpair`/`accept` أثناء إنشاء Windows asyncio loop. لم تكتمل تلك الجولة ولا تُحسب نتيجة أمنية. أوقفت، ثم أُعيد نفس Full Suite خارج قيد Sandbox بتفويض الأداة ونجحت بالنتيجة أعلاه؛ لم تُضعف Assertions أوتُعدل اختبارات A1–A4 أوسياساتها لتجاوز المشكلة.

تفصيل **317 skipped**: 315 حالة تتطلب PostgreSQL opt-in ولم تُشغّل؛ حالة Collation على SQLite لا تثبت PostgreSQL؛ وحالة Windows F2 Positive تتطلب Runner موثوقة ولم تُشغّل. نجاح Negative Windows tests لا يغلق F2. Regression التي عملت بDB استخدمت SQLite داخل الذاكرة الخاصة بالاختبارات القائمة؛ لا قاعدة مشروع أوProduction. لم تُشغّل PostgreSQL حتى المؤقتة في هذه المهمة؛ التغيير لا يعدل Query/Schema.

الأمر النهائي من `backend`، بواسطة Runtime الموجودة دون تثبيت:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:PYTHONPATH='.'
$env:CHANGEFLOW_A1_POSTGRES_TESTS='0'
$env:CHANGEFLOW_A3_WINDOWS_TRUST_TESTS='0'
.\venv\Scripts\python.exe -B -m pytest -q -ra --tb=short -p no:cacheprovider
```

### 9.4 حالة Credentials بعد العزل وحدود الإغلاق

- **PRE-01: عولج مسار الاستخدام التشغيلي في Working Tree فقط.** الملفان المعدلان لا يحتويان Password literals ولا منطق تهيئة. لا دليل جديد على استعمال القيم قديمًا، ولا Reset أوRotation أوتعديل Password Hash/Role/Organization وقع.
- **HEAD لم تتغير:** `5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5` ما زالت تحمل المصدر القديم حتى Commit مصرح لاحقًا؛ الفروع الأخرى والتاريخ لم تُعدل. لا يصح وصف كلمات المرور بأنها أزيلت من Git كله.
- **PRE-02 وPRE-05 مفتوحتان تاريخيًا:** Commits `10faab2` و`6e11805` و`07569e6`، وأرشيفا Backup/Review المحليان، ما زالت تحتوي نسخ Setup القديمة؛ لم تُفتح كبرامج أوتُحذف أويُعد تاريخها.
- **PRE-03 وPRE-04:** JWT وDB candidates المحلية لم تُغير؛ وجودها لا يثبت وحده Exposure أوProduction use. تحديد المالك/البيئة والاستخدام والتوزيع، وأي Rotation لازمة، يحتاج اعتمادًا منفصلًا.
- لا Gitleaks ثُبتت أوشُغّلت؛ الماسح المستقل وقرار التصرف في Historical findings لم يكتملَا. SEC-01/02 وF2 وبقية مخاطر المنصة كما في الخطة.

### 9.5 ما يلزم لإكمال Security Preflight

مراجعة هذا العزل واعتماده، ثم الموافقة المنفصلة على توفير Scanner مستقلة وتشغيلها Offline مع Metadata-only reports على Working Tree والتاريخ والمراجع والأرشيفات والـBuild. يصنف مالك التشغيل استعمال/تعرض Credentials التاريخية والمحلية؛ تُعتمد Revocation/Rotation فقط إن لزمت. النتائج التاريخية يمكن أن تبقى ظاهرة مع إثبات تقاعد الاعتماد وقبول التصنيف، ولا يلزم إخفاؤها أوإعادة كتابة التاريخ لادعاء Scan نظيفة.

**جاهزية التسليم:** عزل Legacy Setup جاهز للمراجعة المحلية ضمن نطاقه وأدلته المحدودة؛ A5-T1 نفسها **لم تبدأ ولا تزال غير مصرح باستئنافها**. لا Commit/Push/PR/Deployment أوRotation أوHistory Rewrite، وStaging تبقى فارغة. ينتظر العمل اعتماد المستخدم، دون انتقال تلقائي إلى أي مرحلة.

**التحقق الختامي:** نجحت Syntax/UTF-8/Whitespace checks للملفات الخمسة المقصودة، و`git diff --check` مع فحص مستقل للـUntracked. أكدت المقارنة داخل الذاكرة غياب قيم Setup الأربع المحذوفة من المصادر المتتبعة الحالية وملفات الاختبار/التوثيق الجديدة، دون طباعة قيم أوHashes لها. بقيت ملفات main/database/Foundation model/auth service وBootstrap/Windows trust مطابقة لبصماتها قبل الإصلاح؛ لا تغيير لتدفق التطبيق المشروع أوBootstrap. HEAD وmaster كما في خط الأساس وStaging فارغة.

## 10. Independent Gitleaks Security Scan — 2026-11-01

### 10.1 التفويض وسلامة الأداة

أذن المستخدم بتنزيل Gitleaks **v8.30.1 Windows x64** من GitHub Releases الرسمية وفحص محلي فقط، مع تحديث الوثيقتين. لم يأذن باستئناف A5-T1 أوRotation أوCommit/Push/PR/Deployment أوتشغيل Legacy Setup/Bootstrap.

- المصدر الرسمي: [Release v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)، و[قائمة أصول الإصدار](https://github.com/gitleaks/gitleaks/releases/expanded_assets/v8.30.1).
- الحزمة `gitleaks_8.30.1_windows_x64.zip` و`gitleaks_8.30.1_checksums.txt` نُزلتا من `github.com/gitleaks/gitleaks/releases/download/v8.30.1/`، مع قبول Redirects إلى GitHub release asset hosts الرسمية فقط.
- SHA-256 الحزمة طابقت Manifest المنشورة والقيمة المثبتة من صفحة الإصدار: `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`.
- SHA-256 ملف Checksums: `061476c21adaf5441516f96f185c1a4706a83cd6329b9b38762271b3d4a52fae`.
- لم يُستخرج `gitleaks.exe` أويُشغّل قبل المطابقة. أمر `version` أعاد `8.30.1`.
- مجلد الأداة المؤقت المنفصل: `C:\Users\W10\AppData\Local\Temp\changeflow-gitleaks-8.30.1-lnmykfm8`. لا تعديل PATH/Registry/Services أوتثبيت مكونات دائمة، ولا ملفات أداة داخل المشروع. Checksum integrity ليست توقيع ناشر مستقلًا.

### 10.2 سلامة Redaction والتقارير قبل المشروع

أنشئت Fixtures اصطناعية فقط في مجلد الأداة، واختُبرت القواعد الافتراضية وقاعدة Legacy محدودة وعضو ZIP اصطناعي. نجحت مرحلة Directory test بـ4 مواقع Fixture متوقعة، ثم اختبار stdin إضافي لقاعدة Legacy. صُنفت كلها **Synthetic/Test Value** خارج نطاق Findings المشروع؛ لم تُستخدم Credentials فعلية للاختبار.

التقرير Custom Template يختار فقط `RuleID/File/StartLine/Commit` ويحوّلها إلى JSON Lines؛ لا حقول Match/Secret/Fragment/Message/Author أونص مصدر في التقارير. استُخدمت `--redact=100`، دون Verbose/Debug/Diagnostics. جرى التقاط stdout/stderr للعمليات داخل الذاكرة وعدم عرضها أوحفظها، ثم التحقق من عدم وجود القيم الاصطناعية في المخرجات/التقرير ومن اقتصار Schema على Metadata. اختُبرت أيضًا CLI redaction دون نشر سجلها الخام.

القواعد: `[extend] useDefault=true` مع `changeflow-legacy-setup-password` فقط كإضافة: Password literal argument في `setup_auth_users.py`. في stdin تُستخدم الإضافة فقط للـBlobs/الأعضاء ذات هذا الاسم؛ بقية المدخلات تستخدم defaults. لا Custom Allowlist أوBaseline أوتعطيل قواعد لإخفاء التاريخ. لا `.gitleaksignore` أو`.gitleaks.toml` في جذر المستودع، والإعداد المراجع يمرر صراحة؛ `--ignore-gitleaks-allow` يمنع التعليقات المحلية من إسقاط النتائج. تبقى مرشحات defaults الأصلية كما هي، وتُعالج فجوات المسارات بمرور stdin المكمّل، لا بحذف القواعد.

### 10.3 النطاق المنفذ

أخذت بصمات ملفات Git الحالية المتتبعة وغير المتتبعة قبل الفحص، وأكدت مطابقتها قبل بدء تحديث التوثيق. لم تُنسخ `.env` أوKeys أومحتويات المشروع إلى مجلد الأداة؛ المدخلات المكمّلة عبر Pipes في الذاكرة فقط. لم تُجر اتصالات تحقق بمزودي المفاتيح أوDB، ولا Fetch أورفع ملفات. التنزيل العام الرسمي للأداة سبق الفحص؛ عمليات Scanner محلية ببيئة محدودة دون وراثة App Secrets، ولا Git external diff/textconv أوتشغيل Hooks/Setup.

| المرور | النطاق والنتيجة |
|---|---|
| Git Patch History | `gitleaks git` مع `--log-opts=--all --full-history --no-ext-diff --no-textconv`؛ **4 Findings** عند مواضع إدخال تاريخية، Exit 1 يعني Findings لا فشل الأداة؛ 1.37s |
| Directory | Workspace الحالية بما فيها Ignored/Untracked وBuild/Archives؛ **10 Findings**؛ Exit 1؛ 1.88s؛ لا Error/Partial/Skip warnings مرصودة |
| Historical Blob supplement | **188 Blob/Path** من كل Trees للـ9 Commits reachable، بما فيها الملفات/النسخ السابقة والمراجع الداخلية؛ عبر stdin دون كتابة المصدر إلى ملفات أدوات؛ **11 Findings** |
| Current-file supplement | **128 ملفًا**: 106 tracked و3 Untracked و19 ignored/local؛ stdin لتغطية مسارات قد تستبعدها defaults؛ **2 Findings** |
| Archive-member supplement | **135 عضوًا** في الأرشيفين المحليين، قراءة داخل الذاكرة دون استخراج/تنفيذ؛ **8 Findings** |
| إجمالي المرور المكمّل | **451 مدخلًا، 5,635,588 bytes، 134.08s، دون errors**؛ 21 موقع Finding. هذه نسخ/مواقع لا أعداد Secrets فريدة؛ لا تجمع أعداد المرور الأساسي والمكمّل |

فُحصت `frontend/dist` الموجودة؛ **لا Source Map ملفات موجودة في نطاق المصدر/Build خارج dependencies**. لا Build جديدة شُغلت. ملفات SQLite المحلية مرت ضمن مرور bytes فقط دون فتح اتصال SQLite أوSQL أوقراءة Tables عبر DB API؛ هذه ليست مراجعة معنوية لمحتوى قاعدة تشغيلية. قدم المرور المكمّل bytes للماسح؛ نجاحه لا يثبت أن كل صيغة Binary أوEncoding مفهومة لكل Rule.

المراجع عند تسجيل Scope: Feature `5ef6a68`، master `10faab2`، ومراجعهما المحلية لدى origin وorigin/HEAD، و3 مراجع `refs/codex/turn-diffs/*`؛ **8 Ref names و9 Commits reachable**، والمستودع ليس Shallow. لا Tags محلية متاحة. المصدر القديم لـSetup بقي في HEAD حتى مع عزل Working Tree؛ الفحص شمله.

**حدود معلنة:** لا Fresh Fetch أوحكم على Remote refs/PR refs/Forks غير المتاحة، ولا dangling/reflog-only objects أوLFS payloads غير المحلية. لا مراجعة Hosting/CI خارجي أوأجهزة أخرى. استبعد المرور المكمّل Git internals و`backend/venv` و`frontend/node_modules` وPython/Pytest caches؛ Source/Config/Build المحلية لم تُستبعد بسبب `.gitignore`. defaults الأصلية قد تتجاهل Binary/Asset/Dependency paths في Directory؛ stdin غطى ملفات المصدر الحالية المتاحة والـBlobs والأعضاء المحددة دون تغيير مرشحاتها. حدود المرور: Archive depth 5 وDecode depth 3 و20 MB للملف المكمّل و100 MB لكل أرشيف؛ لم تسجل حدود حجم/تشفير/قراءة أي تخطٍ إضافي في مجموعة الأعضاء الحالية.

### 10.4 Findings المصنفة — Metadata فقط

بعد إزالة تكرار المرورّات هناك **21 موقعًا**: **19 Historical Credential** و**1 Potential Active Secret** و**1 Local-Only Secret**. الـ19 كلمات مرور ثابتة مؤكدة من المصدر، لكن مواضعها تاريخية/أرشيفية؛ لا تثبت استخدامها فعليًا. لا Findings المشروع صُنفت Synthetic أوFalse Positive دون دليل؛ Fixtures الأداة الاصطناعية منفصلة.

| ID | Rule ID | File Path | Line | Commit عند الحاجة | Severity | Classification | Required Remediation |
|---|---|---|---|---|---|---|---|
| GL-H01 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 193 | 5ef6a68 / 10faab2 | High إذا كانت فعالة | Historical Credential | تحديد الاستخدام؛ Reset/Revocation مصرحان فقط إن كانت فعالة/متعرضة |
| GL-H02 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 204 | 5ef6a68 / 10faab2 | High إذا كانت فعالة | Historical Credential | نفس المعالجة؛ لا إعادة تفعيل Setup |
| GL-H03 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 215 | 5ef6a68 / 10faab2 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H04 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 226 | 5ef6a68 / 10faab2 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H05 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 200 | 6e11805 | High إذا كانت فعالة | Historical Credential | تصنيف تقاعد الاعتماد أومعالجته؛ لا حذف تاريخ تلقائي |
| GL-H06 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 211 | 6e11805 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H07 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 222 | 6e11805 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H08 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 233 | 6e11805 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H09 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 170 | 07569e6 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H10 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 181 | 07569e6 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-H11 | changeflow-legacy-setup-password | backend/setup_auth_users.py | 192 | 07569e6 | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A01 | changeflow-legacy-setup-password | backend_backup_before_update.zip!setup_auth_users.py | 200 | — | High إذا كانت فعالة | Historical Credential | مراجعة توزيع/وصول الأرشيف وتقاعد Credentials؛ لا تنفيذ العضو |
| GL-A02 | changeflow-legacy-setup-password | backend_backup_before_update.zip!setup_auth_users.py | 211 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A03 | changeflow-legacy-setup-password | backend_backup_before_update.zip!setup_auth_users.py | 222 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A04 | changeflow-legacy-setup-password | backend_backup_before_update.zip!setup_auth_users.py | 233 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A05 | changeflow-legacy-setup-password | backend/changeflow_backend_review.zip!setup_auth_users.py | 200 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A06 | changeflow-legacy-setup-password | backend/changeflow_backend_review.zip!setup_auth_users.py | 211 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A07 | changeflow-legacy-setup-password | backend/changeflow_backend_review.zip!setup_auth_users.py | 222 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-A08 | changeflow-legacy-setup-password | backend/changeflow_backend_review.zip!setup_auth_users.py | 233 | — | High إذا كانت فعالة | Historical Credential | نفس المعالجة |
| GL-L01 | generic-api-key | backend/.env | 1 | غير متتبع؛ لا Commit للموقع المحلي | High إن كان المفتاح نشطًا ومتعرضًا؛ غير مثبت | Potential Active Secret | ثبت أن الحقل JWT_SECRET_KEY؛ تحديد المالك/البيئة/الوصول؛ Rotation فقط إذا لزمت |
| GL-L02 | generic-api-key | backend/phase2a_config_backup_20260730_104625/.env | 1 | غير متتبع | Medium؛ High إذا كانت نسخة مفتاح نشط متعرضة | Local-Only Secret | مراجعة توزيع/وصول نسخة الإعداد وسياسة تقاعد المفتاح؛ لا Rotation تلقائية |

Blob الأولى في GL-H01..04 موجودة كذلك في A1/A2/A3 Checkpoints. Blob الثانية في GL-H05..08 موجودة أيضًا في `54cd3eb` و`0f3bfb7`. ملف `classified-metadata.json` المحلي يحفظ قوائم Commit IDs الكاملة لكل Blob دون القيم. تعريف إزالة التكرار هو Rule/Path/Line/Blob أوLocal source؛ ليس تجميعًا حسب قيمة Secret أوHash لها.

**Context item منفصل، لا يُحسب Finding Gitleaks:** Password داخل `backend/.env:5`/DATABASE_URL من PRE-04 باقية Local Environment Credential محتملة. Gitleaks defaults لم تُصدر لها Finding في هذا التشغيل؛ لا تُحوّل إلى False Positive بسبب ذلك، ولا تُعتبر آمنة أوغير مستخدمة. يلزم تصنيف بيئتها ومالكها وتعرضها دون اتصال للتحقق. كذلك عدم ظهور Provider-specific API keys أوPrivate Key findings لا يثبت خلو كل نطاق خارج الحدود المعلنة.

### 10.5 الأدلة والملفات المحفوظة

في مجلد الأداة المؤقت فقط: الحزمة وChecksums والأداة المحمولة، و`provenance.json` و`baseline.json` (بصمات ملفات المصدر لا محتوياتها)، وConfig/Template، وSynthetic fixtures، وMetadata reports بما فيها `classified-metadata.json` و`scope.json` و`supplement-scope.json` و`scan-status.json`. لا Raw Match report أوRaw stderr/stdout أوSecret hash أونسخ `.env`/Keys. قورنت الملفات الحالية ببصمات الدخول قبل تحديث Docs وكانت جميعها مطابقة؛ التعديل في هذه الجلسة يقتصر على الوثيقتين المعتمدتين.

لا إعادة اختبارات التطبيق مطلوبة لتغيير Documentation فقط: النتائج السابقة **24 passed** للعزل و**216 passed / 317 skipped** للـBackend suite تبقى نتائج جلسة العزل، لا تشغيلًا جديدًا هنا. اختبارات هذه الجلسة هي Checksum/version وSynthetic Redaction/Template وstdin checks، ثم Scan كاملة بحدودها؛ Return Code 1 في مروري Git/Directory يعني Findings، وليس نجاح Gate خالية من التسريبات.

### 10.6 قرار البوابة والخطوة التالية

**اكتمل توفير وتشغيل Scanner مستقلة، لكن Security Gate ليست مغلقة وA5-T1 لا تبدأ.** عزل Legacy Setup في Working Tree محفوظ ولم يُعد تشغيلها أوتغييرها. لا Secret Rotation أوPasswords/DB/Role changes أوHistory Rewrite أوCommit/Push/PR/Deployment أوBootstrap وقع.

يلزم اعتماد تصنيف GL-H/GL-A واستخدام/تقاعد القيم التاريخية، ومالك وبيئة وتوزيع GL-L وPRE-04. إذا ثبت اعتماد فعال متعرض تُعتمد Containment/Revocation/Rotation محددة: Password reset وحده لا يبطل JWT القائمة في التنفيذ الحالي؛ تدوير JWT signing key يؤثر في جلسات البيئة؛ وتدوير DB password يستلزم تحديث الخدمات وConnection Pools. لا تُنفذ أي منها دون موافقة. يمكن قبول Historical findings المتقاعدة بأدلة بدل إخفائها أوإعادة كتابة التاريخ، لكن يلزم قرار صريح واستئناف صريح لـA5-T1 بعد ذلك.

**التحقق الختامي لجلسة Scanner:** أكد فحص البصمات أن جميع ملفات المشروع السابقة بقيت مطابقة عند انتهاء Scan وقبل تحديث الوثيقتين؛ وبعد التوثيق لم تتغير إلا هاتان الوثيقتان ضمن هذه الجلسة. نجحت فحوص UTF-8/Whitespace و`git diff --check` وفحص Gitleaks موجّه للوثيقتين المحدثتين بلا Findings. قورنت القيم المحلية وكلمات المرور المحذوفة داخل الذاكرة مع Documents/Tool metadata artifacts، ولم تُعثر عليها فيها؛ لا قيم أوHashes لها طبعت. HEAD `5ef6a68` وmaster `10faab2` وStaging الفارغة كما هي؛ تعديلَا Setup واختبارهما الجديد محفوظة دون تبديل. لا Commit/Push/PR/Deployment أوبدء A5-T1.

## 11. Credential Remediation Execution Plan — قرار المراجعة الحالي

> **تحديث تفويض لاحق:** أذن المالك بتنفيذ A5-T1 داخل اختبارات اصطناعية فقط بعد Isolation Gate. خطة التنفيذ ونتائجها في القسم 12؛ القسم 11 يحتفظ بسجل قرار المعالجة السابق دون الادعاء بتقاعد Demo.

### 11.1 الحقائق المعتمدة وحدود التفويض

- أكد المالك أن Legacy Setup كانت لحسابات **Demo**، وأنه أنشأ حسابات تجريبية واختبر Login محليًا سابقًا. لا دليل يربط جميع الحسابات باستدعاء الأداتين أويثبت تقاعد كلمات المرور؛ حالة الاعتمادات القديمة **Unresolved**، وليست False Positive أوRetired.
- `backend/INSTALL_NOW.txt:53–56` تصف Demo setup؛ و`backend/VALIDATION_REPORT.txt:44–70` تدعي اختبارًا معزولًا سابقًا وتنفي الاتصال بقاعدة المستخدم في ذلك الاختبار. هذه أدلة قصد/تقرير تاريخي، وليست إثبات تقاعد أوتنفيذ في بيئة حقيقية. لا فحص Hashes أوتجربة كلمات مرور أوقراءة جداول فعلية.
- GL-H/GL-A تظل **19 Historical Credential locations** من Scan السابقة؛ التعرض في مصدر Git المحلي والأرشيفين مؤكد، أما استمرار صلاحية الاعتماد أوانتشاره خارجيًا فغير محسوم. لا إعادة Scan التاريخ أوالتصنيف بلا سبب جديد.
- GL-L01/02 وPRE-04 تُعامل حاليًا **Local Environment Secrets / Exposure Unresolved** وفق إفادة المالك: استُخدمت للتطوير المحلي، ولا Production use أوتعرض خارجي مثبت، ولا دليل نفي شامل. PRE-04 باقية رغم عدم كشفها بـGitleaks defaults؛ هذا ليس إثبات غياب Password.
- الأرشيفان **Local Backups**؛ لا دليل حالي على توزيعهما خارجيًا، وExternal Distribution غير مؤكدة. لم يُحذفا أويُنقلا أوتُستخرج محتوياتهما في هذه المهمة.
- التنفيذ الحالي تحقق وتحديث الوثيقتين فقط. لا تغييرات على التطبيق/الاختبارات أوSecurity Policy أو`.env` أوDatabase أوAccounts أوTokens. الإجراءات الآتية **خطة لم تنفذ** وتحتاج اعتماد نطاقها قبل التنفيذ.

### 11.2 Verification Results — المنفذ الآن

| التحقق | النتيجة الفعلية وحدود الإثبات |
|---|---|
| Git | Branch المعتمدة وHEAD `5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5` مطابقان؛ التغييرات السابقة محفوظة، ولا Staged changes |
| منع Legacy writes | الأداتان Docstring ثم `raise SystemExit` غير مشروط قبل أي Import؛ لا DB/Hash dependency أومسار إعادة تفعيل بمتغير أوFlag. لا اعتماد على ENVIRONMENT=test للحماية |
| اختبارات العزل | `tests/test_legacy_setup_disabled.py`: **24 passed، 0 failed، 0 skipped، 5.42s**؛ لا warnings في الناتج. اختبرت CLI/Import للنُسخ المعطلة بعد AST safety guard، لا تشغيل النسخ الأصلية |
| حدود الاختبارات | Mocks/Import guards/Audit hooks تمنع Dependencies/Connections/Side effects؛ تشمل development/test/production وCI مع Flag وهمية، وFastAPI lifespan مع Mock لـcreate_all وفخاخ الاتصال. تثبت عدم الوصول إلى عمليات Hash/Role/Organization/Seed، لا حالة بيانات قاعدة حقيقية |
| A1–A4 وBootstrap | مقارنة **66 ملفًا** من app/migrations وBootstrap واختبارات A1–A4 المتتبعة مع HEAD، مع تسوية line endings، بلا اختلاف. لا Regression كاملة جديدة؛ **216 passed / 317 skipped** في القسم 9 نتيجة تاريخية فقط، وF2 ليست مغلقة |
| Hardcoded values في كود العزل | AST للأداتين لا يحتوي Password literal arguments؛ مقارنة داخل الذاكرة أثبتت غياب قيم Setup القديمة من الأداتين والاختبار، دون عرض القيم أوHashes لها |
| فحص إضافي محدود | Gitleaks **8.30.1** المثبتة سابقًا: تحقق SHA-256 للحزمة ومطابقة exe داخلها، وتحقق Safety Template السابق؛ stdin defaults على الأداتين والاختبار: **0 Findings في 3 ملفات**. لا تنزيل/تثبيت أوScan History جديدة؛ ليست برهان خلو مطلق من كل Secret |
| سياسة الملفات المحلية | `.env` والنسخة الاحتياطية والأرشيفان غير متتبعة حاليًا وتشملها قواعد ignore. `.env` الحالية بها JWT وDatabase password، وتصف development وLoopback target؛ هذه Metadata فقط وليست إثبات عزل أونفي تعرض. لا نسخ للقيم أوتعديلها |

الأمر من `backend`؛ conftest يستبدل إعدادات العملية بـSQLite memory وJWT اصطناعية ويوقف startup table creation قبل استيراد التطبيق؛ تشغيل الاختبار لا يرث قاعدة تشغيلية:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:PYTHONPATH='.'
$env:CHANGEFLOW_A1_POSTGRES_TESTS='0'
$env:CHANGEFLOW_A3_WINDOWS_TRUST_TESTS='0'
.\venv\Scripts\python.exe -B -m pytest -q -ra --tb=short -p no:cacheprovider tests/test_legacy_setup_disabled.py
```

### 11.3 إجراء تقاعد Demo المقترح — غير منفذ

**الاختيار الموصى به عند اعتماد معالجة قاعدة قديمة: تعطيل دائم للحسابات التجريبية المثبتة، مع إبقاء السجلات والعلاقات.** ليس هناك إذن Reset أوتغيير Hashes حاليًا، ولا يُقترح إصلاح جماعي بالاسم أوالبريد.

| الخطوة المستقبلية | الإجراء المحدد | Quality Gate قبل الانتقال |
|---|---|---|
| DEMO-R1 — تحديد الهدف | يحدد المالك البيئة/قاعدة الهدف بمرجع غير سري ويعتمد Manifest من أزواج `(organization_id, user_id)`، ومصدر إثبات ملكية Demo، والحالة/الدور المتوقعين، ومعرّف الموافقة والمنفذ. تُستخرج IDs من جرد موثوق Tenant-scoped لاحقًا، لا تُستنتج من أسماء Demo أوEmail/.local أوRole وحدها | أي هوية أومؤسسة ملتبسة خارج المعالجة؛ لا بحث عالمي بالبريد، ولا قراءة Password Hash أوحقل Secret |
| DEMO-R2 — معاينة مصرح بها | قراءة Metadata محددة فقط داخل المؤسسة المعتمدة لكل ID: العضوية والدور والحالة؛ مقارنة العدد والقائمة بالـManifest. تأكيد Administrator مشروع خارج مجموعة التقاعد، وعدم تعطيل الذات أوآخر مسؤول | اعتماد نتيجة المعاينة وحدود القراءة/الكتابة قبل أي Mutation؛ لا Setup أوBootstrap كآلية تعافٍ |
| DEMO-R3 — احتواء التزامن | نافذة صيانة مصرح بها توقف كتابات الإدارة الأخرى وتُصرّف الطلبات الجارية. حسابات Administrator تخضع لـSEC-04: العد الحالي غير ذري | لا معالجة Admin إن تعذر ضمان تسلسل كل الكتابات، بما فيها Operators الآخرون، أوإغلاق السباق بإصلاح منفصل معتمد. التنفيذ المتسلسل وحده لا يغلق سباقًا مع عميل آخر |
| DEMO-R4 — تعطيل محدد | بعد تفويض صريح فقط، استخدام مسار الإدارة الحالي `PATCH /auth/admin/users/{user_id}` بجسم `{"is_active":"inactive"}` فقط ومن مسؤول المؤسسة ذي users.update؛ المسار يقيد الهدف بـorganization_id الموثوقة. لا تغيير Role/Organization/Hash ولا Bulk SQL | كل هدف يطابق Manifest؛ توقف عند أي اختلاف/فشل. لا حذف بيانات ولا Reactivation تلقائية للتراجع |
| DEMO-R5 — JWT وAudit | حالة inactive تمنع Login وإكمال المصادقة على الطلبات المحمية التي تستخدم TenantContext الحالي؛ JWT تبقى صحيحة توقيعيًا إلى انتهاء صلاحيتها، لكن DB activity check يرفضها. سجل UserAdministrationAudit الحالي يسجل ACCOUNT_DEACTIVATED وحالة/دور قبل وبعد في نفس Commit العملية | لا ادعاء إبطال طلب بدأ قبل التعطيل؛ Drain وقرار مدة الاحتواء موثقان. ربط Audit ID بمعرّف الموافقة/Manifest/الوقت UTC في سجل تشغيل غير سري؛ API لا تقبل reason field إضافية |
| DEMO-R6 — إثبات الإغلاق | مراجعة Metadata لاحقة تثبت IDs وحالة inactive، وسجل التدقيق، وثبات الروابط/الأدوار/المؤسسات وعدم استهداف غير Demo. سجل الحالة السابقة إن كان الحساب inactive أصلًا؛ No-op قد لا ينشئ Audit جديدًا | تقرير مالك معتمد للنتائج والاستثناءات. اختبار رفض JWT قديمة يُثبت مسبقًا بJWT **اصطناعية** وFixture مملوكة فقط؛ لا تجربة Password قديمة أوJWT حقيقية للتحقق |

المراجع التنفيذية الحالية للخطة: `app/routes/auth.py:update_managed_user`، و`app/services/tenant_context.py:get_tenant_context/context_for_user`، و`app/services/auth_service.py`، و`app/schemas/auth.py:AdminUserUpdate`. لم تُستدعَ هذه المسارات على قاعدة موجودة في المهمة.

**Password/JWT caveat:** تغيير Password Hash وحده لا يبطل JWT الحالية؛ لا Session registry/targeted revocation في العقد الحالي. تعطيل الحساب احتواء محدد له عبر إعادة فحص DB في كل طلب محمي، وليس تدوير المفتاح العام للبيئة. لا تعِد تفعيل هوية Demo المتقاعدة بالـHash القديم: قد تعود كلمة المرور أوJWT غير المنتهية صالحة للاستخدام. إذا لزم مستخدم مشروع، يُعتمد Provisioning لهوية مستقلة؛ وأي إبقاء للهوية نفسها يحتاج سياسة Reset وRevocation منفصلة وآمنة. لا يُفترض انتهاء جميع JWT بعد 120 دقيقة اعتمادًا على القيمة الافتراضية دون إثبات مدد الإصدار الفعلية. تبقى الهوية المتقاعدة inactive.

### 11.4 سياسة الأسرار — المقترح بلا Rotation الآن

JWT Secret وDatabase password الحالية والاحتياطية **تُترك دون تغيير**: لا دليل جديد على تعرض فعلي يبرر Rotation تلقائية، والمالك لم يأذن بها. عدم تغيرها لا يساوي شهادة سلامة أوتقاعد. لا تُنقل إلى Docs/Logs أوArguments ولا إلى Fixtures؛ `.gitignore` يمنع إضافات عرضية فقط، ولا يثبت غياب التاريخ أونسخ أخرى. لا رفع `.env` أوالأرشيفات إلى GitHub، ولا Git add شامل لاحقًا؛ يلزم مراجعة الملفات المحددة قبل أي Checkpoint مصرح به.

| دليل جديد يستدعي المعالجة | الإجراء عند تفويض منفصل وأثره | إثبات الإغلاق المطلوب دون Secret |
|---|---|---|
| JWT signing key منشورة أومسروقة أوأعيد استخدامها في بيئة متعرضة | حصر البيئات/Workers والخدمات، اعتماد احتواء وانقطاع الجلسات، توليد وتوزيع بديل عبر Secret channel معتمد وإزالة قبول القديم من جميع Verifiers. لا فترة قبول للمفتاح المتعرض دون قرار أمني صريح | سجل تغيير غير سري وتحقق اصطناعي أن كل Worker يرفض التوقيع القديم ويقبل الجديد؛ Rotation قد تبطل جميع JWT في البيئة، لا Demo فقط |
| Database credential متعرضة أووصول غير مصرح مثبت | مراجعة المالك/الدور والـGrants والمضيفين وLogs المصرح بها، احتواء الوصول وتدوير الاعتماد وتحديث Secret injection ثم استبدال/إعادة إنشاء Connection Pools | تحقق تشغيل مصرح وقطع الاعتماد القديم؛ تغيير Password وحده قد لا ينهي اتصالات DB القائمة، وإنهاؤها يحتاج قرارًا تشغيليًا مع مراعاة المعاملات |
| Demo password ما زالت مرتبطة بحساب فعال أوعاد استخدامها لحساب حقيقي | أولوية High للاحتواء الموجه، وعند توفر وصول خارجي/دليل إساءة يبدأ incident triage فورًا. تعطيل Demo كما أعلاه بعد الموافقة؛ الحقيقي يحتاج قرار المالك بشأن Reset والجلسات وحماية استمرارية العمل | قائمة IDs وحالة/Audit ونتائج مصرح بها دون Hash أوكلمة مرور؛ لا Reset جماعي ولا تغيير حساب حقيقي بالافتراض |
| نسخة إعداد/أرشيف خرجت للجهاز أوبدا Git/CI أثر جديد | حفظ Metadata الأدلة وتحديد المحتويات المحتمل تعرضها محليًا دون إعادة توزيعها؛ Rotation بحسب النوع الفعال المعرض | Evidence من الجهة المالكة عن الاحتواء والمعالجة؛ إزالة الملف من HEAD أوHistory Rewrite وحدها لا تلغي التعرض |

### 11.5 Closure Matrix

| Finding Group | Evidence / Confirmed Exposure | Active Credential Status | Residual Risk | Required Action | Closure Evidence | Gate Status |
|---|---|---|---|---|---|---|
| Legacy entrypoints الحالية | توقف غير مشروط، AST و24 اختبارًا، لا Password literals | لا مسار إنشاء/تعديل حسابات من النسختين الحاليتين | استعادة نسخة تاريخية أوأرشيفية ممكنة؛ التعديل محلي غير محفوظ في Git | إبقاء العزل ومراجعته قبل Checkpoint مصرح لاحقًا | اختباراته الحالية؛ بوابة CI مستقبلية على Checkout يحتوي الإصلاح | **Verified locally**؛ لا إثبات عزل Checkouts أخرى |
| GL-H01..H11 | كلمات مرور Demo ثابتة مؤكدة في التاريخ المحلي | **Unresolved**؛ لا إثبات تقاعد | قد ترتبط بحسابات فعالة/إعادة استخدام؛ حذفها من Working Tree لا يعالج الحسابات | DEMO-R1..R6 بتفويض، أوإثبات تقاعد محدد لنفس IDs | حالة حسابات/Audit معتمدان أوعدم وجودها في الهدف المعتمد؛ تغطية كل بيئة ذات صلة | **Open — data action/evidence required** |
| GL-A01..A08 | نسخ كلمات المرور في Local Backups؛ لا توزيع خارجي مثبت | Unresolved؛ External Distribution غير مؤكدة | بقاء نسخ Credential/code خارج Working Tree | إبقاؤها دون تنفيذ/رفع، وربط صلاحية الاعتمادات بخطة Demo؛ لا حذف تلقائي | دليل تقاعد نفس الاعتمادات وتحديد النسخ/الوصول الممكن؛ لا نطالب بإثبات سلبي مطلق بلا حدود | **Open historical risk** |
| GL-L01/02 وPRE-04 | Local Environment Secrets؛ لا تطابق لقيمها في التاريخ المفحوص وفق Scan السابقة | قد تكون مستخدمة محليًا؛ Exposure Unresolved | نسخ/Reuse خارجي غير مستبعد؛ DB password ليست Gitleaks Finding | إبقاؤها دون تغيير؛ عدم استخدامها لمسار التطوير المقترح؛ معالجة عند دليل تعرض جديد | نطاق استخدام/وصول موثق؛ Rotation فقط إذا لزمت واعتمدت | **Retained — no automatic rotation** |
| Secrets في كود العزل الجديد | مقارنة آمنة وفحص 3 ملفات بلا Findings | لا Secret فعلية مرصودة ضمن هذا النطاق | حدود قواعد Scanner؛ ليس اعتماد مستودع/تاريخ خالٍ | فحص التغييرات المستقبلية المحددة دون إعادة التصنيف القديمة | فحص موجّه ونتائج مراجعة الكود الحالية | **Verified in scope** |
| A5-T1 محلية معزولة | لم تُنشأ بيئة جديدة بعد، ولم يُعتمد استئناف | لا استخدام للحسابات الحالية مقترح | خطر وراثة .env/DB/Signing key أوBrowser session إن لم يثبت الفصل | شروط 11.6 وموافقة مالك صريحة | سجل Fixture ownership وإعدادات غير سرية واختبار الفصل | **Conditional Approval Required** |
| استخدام قاعدة قديمة/مؤسسات حقيقية | لا دليل تقاعد، ومخاطر SEC-01..10 باقية | غير آمن للاعتماد الحالي | وصول محتمل بDemo وRisk/CAB/Session/تشغيل غير مكتمل | احتواء/معالجة الحسابات وإغلاق Gates الإنتاج ذات الصلة | تقارير معالجة واختبارات تشغيل/عزل معتمدة | **Blocked Pending Credential Remediation and Production Gates** |

### 11.6 Safe Development Scope وProduction Blockers

**المسار العملي المقترح لاستئناف A5-T1 فقط: تطوير واختبارات ببيانات اصطناعية على موارد جديدة مؤقتة مملوكة للـFixtures. لم ينفذ ولم يُعتمد بعد.** يمكن للمالك قبول المخاطر التاريخية المتبقية ضمن هذا الحد وحده بدل انتظار إثبات تقاعد كل قاعدة قديمة أوتدوير أسرار بلا دليل. لا يغلق ذلك GL-H/GL-A أويجيز تشغيل التطبيق بإعداداته المحلية القائمة.

- [ ] اعتماد حدود التطوير المعزول واستئناف A5-T1 صراحة؛ لا T2/T3/T4 أوB/C/D تلقائيًا.
- [ ] إعداد عملية اختبار قبل Import، بمورد DB جديد مملوك لFixture مثبتة لا قاعدة قائمة ولا Snapshot حقيقية، وبمفتاح JWT اصطناعي مستقل للعملية فقط. لا وراثة `.env` أوJWT/DB الحالية، ولا Rotation لها. ENVIRONMENT=test أوLoopback وحدهما غير كافيين؛ يثبت تقرير ownership ومسار الإنشاء والـDSN غير السري حدود الهدف.
- [ ] إثبات عدم عبور الموارد: Engine/session dependencies مربوطة حصريًا بـFixture، وstartup writes مقفلة، ولا اتصالات تشغيلية/Email/AI خارجية. اختبارات الفصل تشمل منع fallback للإعداد المحلي ورفض JWT الاصطناعية الموقعة بمفتاح Fixture أخرى، وتحقق scope للمؤسسة. لا تجربة Tokens حقيقية.
- [ ] إن احتاج العمل Browser/API لاحقًا، يُعتمد Origin/Profile اختباري مستقل ويثبت وصوله للـFixture فقط؛ لا مسح/تعديل جلسات المستخدم الحالية. لا فتح خدمة للجمهور أوLan ولا بيانات مؤسسة حقيقية؛ تلك حدود نطاق مقترحة وليست تغيير Security Policy نُفذ الآن.
- [ ] تسجيل قبول المخاطر المحلية المتبقية: Credentials التاريخية غير محسومة، والأرشيفات باقية، وSecrets المحلية بتعرض غير محسوم، لكنها خارج موارد ومسار عملية التطوير المعتمدة. موافقة المالك لا تُسجل تقاعدًا تقنيًا غير مثبت.

**الاستخدام مع مؤسسات حقيقية ممنوع بهذا الاعتماد:** تقاعد/احتواء الحسابات القديمة غير مثبت، وHigh RiskRule isolation وCAB authorization ما زالا B/C، وF2 وLast Administrator Race وRate limiting وbcrypt timing وSession revocation وReal Email وBootstrap operational authorization وFull production review باقية كما في SEC-01..10 بالخطة. نجاح العزل أوA5 مستقبلًا لا يغلقها. لا استخدام لإعدادات DB الحالية للتطوير المعتاد قبل قرار احتواء الحسابات أوإثبات فصلها.

### 11.7 Next Steps وقرار التسليم

1. **مراجعة المالك الحالية:** اعتماد الخطة أوتعديلها. لا طلب أسرار أوإعادة Owner Attestation الأسئلة السابقة؛ المجهول المسجل يبقى Unresolved.
2. **إن اختير التطوير المعزول:** تفويض منفصل لتجهيز وإثبات حدود 11.6 ثم إذن استئناف A5-T1؛ لا تحتاج هذه الطريق Reset الحسابات القديمة أوRotation المفاتيح المحلية تلقائيًا. قرار الجاهزية لهذه الطريق **Conditional Approval Required**، وليس Approved to Resume الآن.
3. **إن اختير استخدام قاعدة قديمة:** يبقى Gate **Blocked Pending Credential Remediation** إلى اعتماد Manifest والمعاينة والاحتواء الموجه وإثبات DEMO-R1..R6 أوتقاعد موثق لنفس الحسابات/البيئات. لا يكفي وصفها Demo أونجاح Scanner أوغياب دليل إساءة.
4. **Checkpoint لاحق فقط بتفويض Git:** مراجعة الأداتين والاختبار والوثيقتين بالأسماء؛ عدم إضافة `.env` أوالأرشيفات أوتقارير حساسة. HEAD ما زالت تحتوي المصدر القديم؛ لا ادعاء أن العزل أصبح موجودًا على GitHub أوCI.

**التغييرات في هذه المهمة:** `backend/docs/development_master_plan.md` و`backend/docs/phase2_a5_t1.md` فقط؛ تغييرا الأداتين والاختبار الجديد محفوظة كما دخلت المهمة. لم تنفذ أي خطوة DEMO-R أوإنشاء DB معزولة أواختبار JWT إضافي أوسياسة Rotation؛ هذه خطوات مستقبلية واضحة وليست نتائج Passed. لا A5-T1 أوCommit/Push/PR/Deployment/Migration/History Rewrite أوتشغيل Setup/Bootstrap أواتصال DB تشغيلية. يتوقف العمل للمراجعة.

## 12. A5-T1 Conditional Execution — خطة العمل المعتمدة

المصدر: موافقة المالك المرفقة «A5-T1 Conditional Execution Approval». لا قراءة `.env`/النسخ الاحتياطية، ولا قاعدة قائمة أوSecrets فعلية أوBootstrap/Legacy Setup أوA5-T2 أوGit Checkpoint.

- [x] **Gate 1 قبل الوظائف:** `tests/a5_isolated_runner.py` ينشئ عملية وبيئة allowlist ومفتاح اصطناعي جديد؛ `tests/a5_isolation.py` يمنع Env file reads ويعطل dotenv discovery/load ويحصر DB drivers/targets؛ تعديل test conftest والـNative fixture لربط الملكية بالCluster المؤقتة. اختبار `test_a5_isolation_gate.py`: الإعداد الآمن ورفض Targets غير مملوكة قبل الاتصال، ثم PostgreSQL جديدة فقط. أي عائق يمنع تعديل التطبيق.
- [x] **Backend RED→GREEN:** اختبار HTTP/PostgreSQL في `tests/test_a5_identity.py` للحقول السابقة والـpermissions/workspace_slug وكل الأدوار وتغير العضوية/الدور وJWT v2/foreign claims؛ تعديل `app/schemas/auth.py` و`app/routes/auth.py` فقط، دون Matrix/Model/Migration/JWT changes.
- [x] **Frontend RED→GREEN:** اختبارات Node المحلية دون مكتبات جديدة؛ `src/types/api.ts` لعقود الهوية/Login، `src/services/api/client.ts` و`config.ts` و`session.ts` للOrigin/Errors/Abort/Timeout/Generation، و`src/features/auth/authApi.ts` للـForm payload والتحقق runtime. لا UI/AuthProvider/Storage/Login pages الآن؛ نقل الاستدعاءات المرتبطة بجلسة الواجهة إلى T2 كي لا يبقى Client جديد موصولًا بجلسة قديمة غير محكومة.
- [x] **Gate 3:** اختبارات العميل، Typecheck/Build/Lint دون تحميل ملفات البيئة؛ HTTP regressions A1/A2/A4 داخل نفس الحواجز وPostgreSQL جديدة؛ استمرار عزل Legacy. فحص Secret موجّه لكل ملف جديد/معدل دون قيم. لا نعلن Skipped=Passed أوE2E.
- [x] **Gate 4:** تحديث هذه الوثيقة والخطة بكل الأدلة والحدود وGit status والتوقف قبل Commit أوT2.

### 12.1 Isolation Gate النهائي — Passed ضمن نطاق العملية الاختبارية

اجتازت البوابة قبل تعديل الوظائف: **3 passed في 14.30s**؛ وأعيدت مع عقد الهوية في الاستكمال: **15 passed في 47.74s**. لا اعتماد على ENVIRONMENT=test أوLoopback وحدهما:

- Runner تنشئ Child process ببيئة صريحة؛ الموروث محصور في مسارات النظام والتشغيل، ولا DATABASE_URL/JWT/PG/provider secrets أوNODE_OPTIONS. مفتاح توقيع جديد من CSPRNG يولد في الذاكرة لكل تشغيل، ولا يطبع أويخزن أوينسخ من إعداد موجود.
- قبل استيراد التطبيق، تعطّل dotenv discovery/load وتوضع Python audit hook تمنع فتح `.env` و`.env.*`. الإعدادات الفعلية للتطبيق لم تعدّل؛ لا قراءة للبيئة الحالية أوالنسخ الاحتياطية أومقارنة قيمها.
- SQLite مسموحة داخل الذاكرة فقط للوحدة؛ psycopg2 ترفض قبل Driver call أي هدف غير مسجل، مع تحقق host/port/database/generated credential ومنع service/hostaddr/passfile overrides. SQLAlchemy تمنع Drivers أخرى. الاختبارات السلبية استخدمت عنوانًا توثيقيًا غير متصل وملفًا غير موجود، لا DB قديمة.
- PostgreSQL **18.4** من binaries المحلية؛ لا Docker أوتحميل Dependencies. الـNative fixture أنشأت Clusters جديدة تحت `changeflow-a5-run-*/changeflow-a2-pg-*` بمنافذ عشوائية، وثبتت data directory/port ثم Cluster system identifier وDB/schema/search_path/engine ownership. استُخدمت Migrations القائمة داخل Schemas الاختبار فقط؛ لا Migration لقاعدة موجودة.
- جرى فحص Metadata للخدمة القائمة قبل التشغيل دون الاتصال بها أوايقافها. تنظيف Fixture يستهدف data directory التي أنشأتها، وRunner تنظف مجلدها الجديد فقط. التشغيلان الواسع واللاحق انتهيا دون Cleanup errors؛ تأكد غياب مجلد التشغيل الواسع بعد انتهائه.
- المحاولة الأولى داخل Sandbox: **2 passed / 1 error** بسبب تعثر initdb بعد 60s، مع تعثر حذف مجلد Sandbox. لم يبدأ تعديل وظيفي عندها؛ نجحت إعادة البوابة بصلاحية مناسبة قبل الوظائف. أُزيل لاحقًا مجلد محاولة جديد داخل backend كان لا يحتوي إلا control.log بعد التحقق من المسار والمحتويات؛ لا حذف Recursive أوبيانات سابقة. لا نحسب المحاولة المتعثرة Passed.

هذه حواجز تشغيل اختبارات موثوق بها، وليست Sandbox لمواجهة كود اختبارات خبيث قادر على إزالة monkeypatches. لا تمنح تشغيل التطبيق بإعداداته القديمة أوProduction.

### 12.2 الملفات الفعلية وحدود التغيير

| المجموعة | الملفات | التغيير |
|---|---|---|
| Backend runtime — معدلة | `app/routes/auth.py`، `app/schemas/auth.py` | الحقلان الإضافيان فقط؛ permissions مرتبة من A4 permissions_for_user وworkspace_slug من Organization الحالية |
| Test infrastructure — معدلة | `tests/conftest.py`، `tests/a2_native_postgresql.py` | استخدام المفتاح الاصطناعي الخاص بالعملية، وربط Cluster الجديدة بحاجز ملكية A5 |
| Backend tests — جديدة | `tests/a5_isolated_runner.py`، `tests/a5_isolation.py`، `tests/test_a5_isolation_gate.py`، `tests/test_a5_identity.py` | عزل وMetadata-only failure output و12 حالة Identity و3 حالات Gate |
| Frontend contracts/services — جديدة | `src/types/api.ts`، `src/services/api/{client,config,errors,session}.ts`، `src/features/auth/authApi.ts` | Client مستقلة عن UI، وعقد Login وme والتحقق runtime |
| Frontend verification | `tests/api.test.ts`، `scripts/verify.mjs`، `tsconfig.test.json` جديدة؛ `package.json` معدلة | Node tests وTypecheck/Build/Lint ببيئة محدودة دون Dependencies إضافية؛ لا تغيير lockfile |
| Documentation | هاتان الوثيقتان | نتائج المراجعة والتنفيذ والتوقف |
| تغييرات محلية سابقة محفوظة | `setup_auth_users.py`، `seed_foundation.py`، `tests/test_legacy_setup_disabled.py` | ليست عمل A5 جديدًا؛ لم تتغير أوتُشغّل الأدوات في A5 أوالاستكمال |

**خارج النطاق:** لا ملف تطبيق خارج القائمة معدّل؛ لا App.tsx أوAuthProvider أوصفحات Login/Invitation أوStorage جديدة أوRouting/Design System. Models/Migrations وJWT v2 وPermission Matrix وTenantContext وAuth Service وBootstrap وWindows trust باقية دون تغيير. لا عملية تشغيلية على DB أوUser/Role/Organization/Hash/Token حقيقية.

### 12.3 عقد `/auth/me` وAPI Client النهائي

الحقلان الإضافيان إلزاميان في Response model: `permissions: list[str]` و`workspace_slug: str`. جميع الحقول القديمة وقيمها محفوظة. require_permissions الحالية ما زالت تفحص JWT v2 والعضوية والنشاط وRole/Department داخل المؤسسة من DB، ثم يبني الرد من نفس المستخدم؛ لا Grants من JWT/Body/Header. الاختبارات تشمل managed/legacy roles، وعدم منح System Administrator صلاحية CAB، وتغير الدور وSlug والنشاط مع JWT نفسها، ورفض Tenant claim أجنبية والدور المجهول. لا API breaking removal أوDatabase Migration.

Client الجديدة تقدم `createApiClient` مع Base URL مركزية وOrigin allowlist صريحة، و`createAuthApi` و`ApiSession` في الذاكرة فقط. `configuredApiEndpoint()` تقرأ VITE_API_BASE_URL وVITE_API_TRUSTED_ORIGINS كإعداد Build عام موثوق؛ الافتراضي Loopback محدد. HTTPS مطلوبة خارج Loopback، وتُرفض URL credentials وOrigin خارج القائمة والمسارات المطلقة/الهاربة، ولا يسمح للمتصل بتمرير Authorization بديلة. كل Request تضبط redirect=error وcredentials=omit وreferrerPolicy=no-referrer؛ لا Retry تلقائية لطلبات القراءة أوالكتابة.

Login ترسل Form URLSearchParams بحقول **tenant_slug/email/password** فقط، دون username أوBearer أوحقول صلاحيات، وتطابق FastAPI Form الحالية؛ لا Public Registration service. Token وCurrentUser يمران عبر Runtime validation مع قائمة Permissions معروفة ورفض Unknown/Duplicate grants وأنواع IDs غير الصحيحة؛ الحقول الإضافية غير المعتمدة تُهمل. التحقق بالواجهة ليس Authorization؛ Backend هي المرجع.

401 لطلب authenticated تمسح Boundary الجلسة الحالية وتستدعي Data cleanup subscribers وتلغي الطلبات الأخرى؛ 403/404/409 تبقى أخطاء منفصلة ولا تمسح الجلسة. فشل Login العامة لا يمحو جلسة أخرى. Generation وAbortController تمنعان Late success أو401 قديمة من إحياء بيانات/إبطال جلسة أحدث، حتى إذا تجاهل transport الإلغاء. Timeout تشمل قراءة JSON وتستقر Promise عند الإلغاء. Network/body transport failures تختلف عن malformed JSON/contract validation، ولا Server body أوRequest input أوCause حساسة تحفظ في ApiError أوLogs.

**حد الربط:** الـClient مختبرة وقابلة للاستخدام، لكنها لم تُوصل بجلسة App.tsx القديمة؛ لا ندعي إصلاح سلوك واجهة Login الحالية أوتخزينها أوE2E. ربط AuthProvider وSessionStorage وتنظيف Query/UI state وصفحات Workspace Login/Invitation هو A5-T2 بعد اعتماد منفصل. يُنشئ الربط القادم ApiSession واحدة، وClient من configuredApiEndpoint، ويسجل cleanup؛ لا تخزين Token في هذه الطبقة.

### 12.4 Verification Results — المستعادة والمنفذة الآن

| التشغيل | Passed | Failed | Skipped | الدليل وحدوده |
|---|---:|---:|---:|---|
| Gate الأصلية قبل الوظائف | 3 | 0 | 0 | 14.30s، PostgreSQL جديدة؛ النتيجة ليست تشغيل الاستكمال |
| Backend regression المستعادة بعد الانقطاع | 388 | 1 | 1 | 546.90s؛ A1/A2/A4 وCore schemas/state وA5، PostgreSQL فعلية مؤقتة وSQLite memory |
| إعادة A5 Identity + Isolation بعد تصحيح Test setup | **15** | **0** | **0** | **47.74s**؛ 12 Identity عبر HTTP/PostgreSQL + Gate (1 PostgreSQL و2 guards/settings). أي **13 حالة PostgreSQL ناجحة** في هذه الإعادة، لا SQLite بديلة عنها |
| Frontend النهائية بعد إصلاح Body error classification | **13** | **0** | **0** | Node native tests، 402.57ms؛ Fake fetch وResponses اصطناعية، لا شبكة/E2E |
| TypeScript | — | 0 | — | App وTests/API وVite config: Exit 0 |
| Production Build النهائية | — | 0 | — | Vite 8.1.4، 17 modules، 351ms؛ JS 286.52 kB / gzip 78.21؛ CSS 41.11 / 7.80؛ دون Build warnings |
| Lint النهائية | — | 0 | — | **6 warnings** موجودة سابقًا في App.tsx فقط؛ لا warnings جديدة |

**تفصيل الفشل المصحح:** الاختبار السابق `test_foreign_role_invalidates_membership_and_unknown_role_is_denied` حاول تغيير Role بين مؤسستين داخل Fixture؛ PostgreSQL رفضتها بـIntegrityError من FK. لم نغير القيد أوModels أوالسياسة لتمريره. استُبدل بـ`test_foreign_tenant_jwt_and_unknown_role_are_denied` الذي يفحص HTTP Tenant boundary بJWT اصطناعية، مع إبقاء FK سليمة. نجح ضمن إعادة الـ15. لا نخفي الفشل الأول، ولا نصف التشغيل الواسع نفسه بأنه Exit 0، ولا نجمع 388+15 لأن المجموعتين متداخلتان. لا فشل متبقٍ غير محسوم في نطاق A5 بعد التصحيح وإعادة التحقق؛ لم تُعد المجموعة الواسعة كاملة بعد تعديل الاختبار وحده.

**Skipped الوحيدة في المجموعة الواسعة:** `test_a2_authentication.py:333` نسخة SQLite لاختبار Collation يحتاج PostgreSQL. النسخة PostgreSQL نُفذت ضمن المجموعة ولم تتخطَّ؛ لا PostgreSQL tests متخطاة في المجموعة المختارة. لا F2 positive integration أواختبارات Bootstrap أوLegacy CLI جديدة أوBrowser E2E في هذه المهمة. نتائج **24 passed للعزل** و**216 passed / 317 skipped** السابقة في القسم 9 تاريخية، وليست نتائج هذا التشغيل ولا تُضاف له.

**Lint warnings المحددة:** App.tsx:1188 initializeSession؛ 1200 loadChangeRecordsPage؛ 1225 loadManagedUsersPage؛ 1246 loadUserAdministrationAuditPage؛ 1266 currentUser؛ 1278 loadNotificationsPage/currentUser. لم تُعدّل هذه الواجهة ضمن T1 لإخفاء warnings.

**RED evidence:** عقد permissions الجديد فشل قبل Extension؛ Frontend فشلت 10 حالات عند غياب Client، ثم نجحت. أضيفت لاحقًا حالات أظهرت Headers TypeError قد يحمل قيمة إدخال، وتصنيف Body network error كValidation؛ ثبت RED ثم صُححت داخل Client وأصبحت المجموعة النهائية 13 passed. احتوى Build التجريبي الأول على React development bundle بسبب NODE_ENV=test وتحذير envFile deprecated؛ صُحح Runner إلى NODE_ENV=production وenvDir=false وأُعيد Build بنجاح بالحجم النهائي أعلاه، دون تغيير UI أوزيادة chunk warning limit.

الأوامر المحدودة من backend:

```powershell
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py tests/test_a5_identity.py tests/test_a5_isolation_gate.py
```

قائمة ملفات التشغيل الواسع المستعاد: `test_a5_identity.py`، `test_a5_isolation_gate.py`، `test_a2_authentication.py`، `test_a2_security_corrections.py`، `test_a4_authorization.py`، `test_a4_isolation.py`، `test_a4_notifications.py`، `test_a4_regressions.py`، `test_a1_migrations.py`، `test_a1_schema_contracts.py`، `test_a1_http_boundaries.py`، `test_a1_fixture_safety.py`، `test_change_state_service.py`، `test_model_constraints.py`، `test_schema_hardening.py`؛ تحت نفس Runner. لم تُشغّل Bare pytest التي تضم Bootstrap/F2 خارج النطاق.

Frontend من frontend باستخدام Node المحلية:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/verify.mjs all
```

تعمل أيضًا npm test وnpm run verify عند توفر Node في PATH. Runner تحدد بيئة Child دون Secrets موروثة وتعطّل Vite env loading بـenvDir=false؛ Build إلى مجلد جديد مؤقت يُنظف بعد التحقق، فلا تستبدل frontend/dist الموجودة أوتقرأ ملفات البيئة. لا Dependencies جديدة أوnpm install.

### 12.5 Security Review وGit وقرار Checkpoint

- مراجعة Source وDiff المحددة دون عرض Diff كلمات المرور القديمة المحذوفة؛ لا إضعاف Tenant isolation أوزيادة Grants أوتغيير JWT v2. عزل الأداتين والاختبار السابق محفوظ؛ لا تشغيل Legacy/Bootstrap.
- فحص التسليم Gitleaks v8.30.1: **23 ملفًا معدلًا/جديدًا، 0 Findings** بقواعد defaults عبر stdin، بما فيها الوثيقتان. طابقت binary الحزمة ذات SHA-256 المثبتة، وتحققت مطابقة Metadata-only template وredact=100؛ لا `.env` أونسخ Secrets ضمن المدخلات أوRaw matches/Logs. لا إعادة تصنيف 21 موضعًا تاريخيًا بلا دليل جديد؛ هذه النتيجة ليست Scan جديدة للتاريخ أوشهادة خلو مطلقة.
- تقاعد Demo **Unresolved**؛ GL-H/GL-A والأرشيفات وLocal Environment Secrets باقية كما في القسم 11. لا Rotation أوReset أوتجربة Credentials أوتغيير Tokens حقيقية. نطاق قبول المخاطر هو الاختبارات الاصطناعية المعتمدة فقط.
- F2 وRisk rules isolation في B وCAB في C وLast Administrator Race وRate limits وSession revocation وReal Email وProduction review باقية؛ لا إغلاق لها بواسطة نتائج T1.
- Git: repository/branch/HEAD مطابقون، HEAD **5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5**؛ Staging فارغة. **7 Modified +16 Untracked files** كما في 12.2، منها 3 تغييرات سابقة للعزل محفوظة؛ لا ملف Runtime خارج النطاق أوملف Secrets أُضيف. لا Reset/Clean/Checkout/Stash أوCommit/Push/PR/Merge/Deployment.

**القرار:** A5-T1 جاهزة لمراجعة المالك لـ**Development Checkpoint محلي محدود** مع توثيق الـSkip والتحذيرات والحدود أعلاه؛ هذه توصية تقنية وليست إذن Commit أوProduction. الخطوة المقترحة بعد موافقة منفصلة: A5-T2 لAuthProvider وWorkspace Login وInvitation Acceptance والربط الفعلي بالClient، مع نفس شروط العزل. لا يبدأ T2 الآن، ويتوقف العمل بعد تقرير الإغلاق.

**تحقق الحفظ النهائي:** المقارنة ببصمات ما قبل A5 أثبتت حفظ ملفات العزل الثلاثة حرفيًا وعدم وجود تغييرات غير متوقعة؛ الـ13 ملفًا البرمجية/الاختبارية الجديدة مطابقة لقائمة النطاق، والتغييرات في المصادر السابقة محصورة بملفي Backend وملفي Test infrastructure وpackage.json والوثيقتين. فحوص Python AST وUTF-8 وWhitespace للملفات الجديدة، وgit diff --check، وحفظ DEC-01..16 وSEC-01..10 نجحت. Metadata ملفات البيئة لم تتغير، ولم تُقرأ قيمها. حُفظ ملخص التحقق الآمن في مجلد الأداة المؤقت تحت a5-resume-verification-metadata.json؛ لا Credentials/Source/Raw logs فيه.

## 13. A5-T1 Final Checkpoint Review — سجل الاعتماد النهائي

هذا القسم هو سجل المراجعة اللاحقة بطلب المالك إعادة المجموعة الواسعة بعد تصحيح Tenant FK، ومراجعة كل ملفات Checkpoint. الأقسام السابقة تاريخية ولا تستبدل نتيجة هذا التشغيل. الاعتماد مبدئي ومشروط بالمراجعة؛ **لا Stage/Commit/Push/PR/Merge/Deployment**.

### 13.1 Git وPortability Fix

المستودع والفرع مطابقان، وHEAD `5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5`؛ Staging فارغة. حُفظت جميع التعديلات السابقة. النطاق الحالي **24 ملفًا: 7 Modified +17 Untracked**، والقائمة الحصرية في 13.4.

اكتُشف مسار binary ثابت في Runner الخاصة بالاختبارات. عولج داخل نطاق Test infrastructure فقط، بعد RED **4 failed** ثم GREEN **4 passed في 0.08s**. `resolve_postgres_bin` تقبل `--postgres-bin` كمسار أدوات فقط أوتكتشف initdb/pg_ctl/postgres من PATH؛ يلزم اجتماعها في Directory واحدة، ويؤدي الغياب/عدم اكتمال المسار إلى RuntimeError قبل إنشاء Cluster أواتصال. لا تقبل Database URL أوCluster قائمة، ولا توجد قيمة افتراضية مرتبطة بجهاز المطور.

`build_child_environment` تفصل البيئة وتولد JWT اصطناعية جديدة؛ اختُبرت إزالة DATABASE_URL/JWT/PGPASSWORD/PGSERVICE/NODE_OPTIONS/provider markers الموروثة باستخدام قيم مصطنعة فقط. كل المسارات في الاختبارات مبنية من `__file__` أوtmp_path أوأدوات المشغّل الصريحة؛ لا User home أوProgram Files ثابتة في ملفات الاختبار الجديدة. راجعت Fixtures/Services/Runtime validation دون تغيير App أوJWT/Matrix/Models/Migrations.

Runner تسجل تقدمًا **بالأعداد فقط** في progress.json تحت مجلد التشغيل الجديد، وتلخص PostgreSQL مقابل unit/memory دون قيم أوTest locals. الملف يُحذف مع موارد التشغيل ولا يدخل Git. تجربة RED داخل Sandbox واجهت أيضًا رفض حذف مجلد Sandbox؛ إعادة الوحدة والاختبارات التشغيلية المصرح بها خارج Sandbox تستخدم نفس الحواجز ولا تعدّل ACL أوخدمة قائمة.

### 13.2 Full Backend Regression بعد تصحيح Tenant FK

**حالة تشغيل Backend النهائي:** **Exit0 — 399 passed /0 failed /1 skipped /18 deselected في 635.56s (10:35)**، بعد تصحيح Tenant FK وPortability Fix. لا جمع مع نتائج 12 التاريخية أوإعادة الـ15؛ هذه نتيجة تشغيل واحد جديدة.

| مجموعة التنفيذ الحالية | Passed | Failed | Skipped |
|---|---:|---:|---:|
| PostgreSQL fixture/parameter cases | **235** | **0** | **0** |
| Unit / SQLite memory / guards | **164** | **0** | **1** |
| إجمالي المجموعة المختارة | **399** | **0** | **1** |

التقسيم من Metadata hook حسب Fixtures/parameters، وليس عدد Clusters أوQueries. **400 حالة مختارة** من 418 collected، و18 deselected عمدًا كما أدناه. لم يظهر Regression متبقٍ في A5-T1 أومشكلة سابقة فاشلة ضمن هذه المجموعة. نتائج RED الأربع قبل إصلاح portability تطوير اختبارات مقصود، وليست Failed في هذا التشغيل النهائي.

**سبب Skip الوحيدة:** نسخة SQLite في `test_a2_authentication.py:333` لا تثبت Collation الخاصة بـPostgreSQL؛ نسخة PostgreSQL نُفذت بنجاح، ولم تُستخدم SQLite بديلًا عنها. لا Skip لأي PostgreSQL في المجموعة الحالية. استبعاد تشغيل Bootstrap/F2 خارج هذه المجموعة ليس Passed ولا يُستخدم لإغلاق مخاطرها.

المجموعة هي الملفات الـ15 المحددة في 12.4، مع `test_a5_runner_configuration.py` و`test_legacy_setup_disabled.py`. استُبعدت صراحة 18 حالة Legacy CLI/Import invocation بواسطة -k احترامًا لعدم تشغيل الأداتين؛ تُشغّل الحالات الست الأخرى لـAST/غياب Password literals/عدم تحميل الأداتين في Startup مع Mocks. هذا Deselect مخطط وليس نجاحًا أوSkip بسبب غياب PostgreSQL. لا Bootstrap أوF2 positive أوBrowser E2E ضمن هذا التشغيل؛ لا Bare suite خارج النطاق.

الأمر قابل للنقل؛ يختار المشغّل PG_BIN بعد مراجعة binaries المحلية، ولا يوضع المسار الخاص بالمضيف في الكود:

```powershell
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' tests/test_a5_runner_configuration.py tests/test_a5_isolation_gate.py tests/test_a5_identity.py tests/test_a2_authentication.py tests/test_a2_security_corrections.py tests/test_a4_authorization.py tests/test_a4_isolation.py tests/test_a4_notifications.py tests/test_a4_regressions.py tests/test_a1_migrations.py tests/test_a1_schema_contracts.py tests/test_a1_http_boundaries.py tests/test_a1_fixture_safety.py tests/test_change_state_service.py tests/test_model_constraints.py tests/test_schema_hardening.py tests/test_legacy_setup_disabled.py -k 'not script_and_import_fail_without_database_hashing_or_mutation and not direct_cli_exits_nonzero_without_traceback_or_argument_echo'
```

**دليل العزل:** PostgreSQL جديدة من أدوات 18.4 المحلية، ومنافذ عشوائية داخل Clusters مولدة تحت Run root جديدة، مع تحقق Data directory/port/cluster system identifier وSchema/Engine ownership قبل Queries الاختبارات. حواجز dotenv/read وDB drivers/targets نشطة قبل App imports؛ لا قراءة أسرار فعلية أومحاولة اتصال بقاعدة قديمة. SQLite memory للوحدة فقط؛ كل حالة PostgreSQL تستخدم Driver حقيقية وCluster جديدة. لا Docker أوتثبيت أواتصال خارجي. التنظيف يستهدف الموارد المنشأة لهذه العملية فقط.

**Cleanup evidence:** انتهت Finalizers وRunner دون Cleanup errors، ثم تحقق غياب Run root بعد التشغيل. لا خدمة أوقاعدة قائمة أُوقفت أوحُذفت؛ progress.json وCluster data/password/control files الخاصة بالتشغيل ليست ضمن المشروع أوManifest ولا تحتاج Git.

### 13.3 Frontend وSecurity Review

- Frontend أعيدت: **13 passed /0 failed /0 skipped في 681.50ms**؛ App/API-test/Vite-config Typecheck Exit0؛ Production Build Vite8.1.4 ناجح في **286ms** دون warnings. JS286.52kB/gzip78.21 وCSS41.11/gzip7.80؛ Output مؤقت وenvDir=false، لا تغيير dist الحالية أوتحميل .env.
- Lint: **0 errors /6 warnings سابقة** فقط في App.tsx، بالمواقع المذكورة في 12.4. لا UI redesign أوA5-T2؛ AuthProvider/Storage/Workspace pages لم تبدأ.
- `/auth/me` تحفظ الحقول السابقة وتشتق permissions من A4 وworkspace_slug من Organization الحالية؛ JWT v2 وPermission Matrix وTenantContext وModels/Migrations دون تغيير. لا Grant من Client، ولا تعديل Role/Hash/عضوية فعلية.
- Client تُقيد Token بالOrigin المعتمدة وترفض redirect وOverride للAuthorization؛ validation حساسة وتفريق 401/403/404/409 وnetwork/validation وTimeout/Abort/Generation. خدمات Login ترسل tenant_slug/email/password عبر Form فقط. لا Raw server detail أوCredentials في ApiError/Logs، ولا إعادة محاولة تلقائية للكتابات.
- تعطيل Setup توقف غير مشروط قبل Imports/DB dependency. البحث في التطبيق وملفات تشغيل Git لا يظهر استيرادًا أوتشغيلًا للأداتين؛ Startup tests تمنع حتى محاولة التحميل، مع DB/create_all mocked. لا إعادة تشغيل الأداتين ضمن هذه المراجعة.
- مقارنة داخل الذاكرة لقيم Password literals من **النسخ التاريخية الثلاث المعروفة** عبر AST، دون عرض/تخزين قيمها أوHashes لها، أثبتت غيابها من **كل ملفات Checkpoint الحالية الـ24**. لا قراءة Password Hashes أوبيانات جداول تشغيلية/قديمة أوملفات بيئة فعلية. Fixtures ذات قيم مصطنعة فقط، ولا Hardcoded credentials تشغيلية جديدة.
- **Secret Scan النهائي:** Gitleaks v8.30.1 الرسمية السابقة، بعد تحقق SHA-256 ومطابقة binary والحزمة وMetadata-only template واختبار Synthetic السابق: **24 ملفًا، 0 Findings**. القواعد defaults عبر stdin مع redact=100 وignore-gitleaks-allow؛ لا custom allowlist أو.env/Backup/Build inputs، ولا raw stdout/stderr/matches في Logs/التقرير. لا تنزيل أونقل Source/Secrets إلى الأدوات أوخدمة خارجية. هذه ليست إعادة Scan للتاريخ ولا إعلان تقاعد الاعتمادات التاريخية.

### 13.4 Checkpoint Manifest — قائمة الحفظ الحصرية المقترحة

المسارات التالية نسبية لجذر المستودع، وM تعني Modified وU تعني New/Untracked في Git. Documentation وTests محددتان في عمود الغرض. لا ملف خارج هذه القائمة مقترح للحفظ؛ لا Git add شامل.

| ID | Git | المسار | النوع والغرض |
|---|---|---|---|
| CP-01 | M | `backend/app/routes/auth.py` | Runtime؛ بناء identity response من DB |
| CP-02 | M | `backend/app/schemas/auth.py` | Runtime contract؛ permissions/workspace_slug |
| CP-03 | M | `backend/setup_auth_users.py` | Security؛ عزل Legacy محفوظ من المهمة السابقة |
| CP-04 | M | `backend/seed_foundation.py` | Security؛ عزل Legacy محفوظ من المهمة السابقة |
| CP-05 | M | `backend/tests/a2_native_postgresql.py` | Test fixture؛ تسجيل/إنهاء ملكية Cluster مع حواجز A5 |
| CP-06 | M | `backend/tests/conftest.py` | Test configuration؛ مفتاح اصطناعي خاص بالعملية |
| CP-07 | M | `frontend/package.json` | Test tooling؛ test/verify scripts فقط، بلا Dependencies |
| CP-08 | U | `backend/docs/development_master_plan.md` | Documentation؛ الخطة والقرارات والنتائج |
| CP-09 | U | `backend/docs/phase2_a5_t1.md` | Documentation؛ التقرير وManifest والقيود |
| CP-10 | U | `backend/tests/a5_isolated_runner.py` | Test runner؛ بيئة نظيفة وbinary selection قابلة للنقل وMetadata |
| CP-11 | U | `backend/tests/a5_isolation.py` | Test guard؛ منع env reads وDB targets غير المملوكة |
| CP-12 | U | `backend/tests/test_a5_identity.py` | Tests؛ HTTP/PostgreSQL identity/permissions/tenant boundary |
| CP-13 | U | `backend/tests/test_a5_isolation_gate.py` | Tests؛ عزل الإعداد والاتصالات والCluster الجديدة |
| CP-14 | U | `backend/tests/test_a5_runner_configuration.py` | Tests؛ portability وfail-closed وenv inheritance |
| CP-15 | U | `backend/tests/test_legacy_setup_disabled.py` | Tests؛ العزل السابق وStartup وAST وguarded entrypoints |
| CP-16 | U | `frontend/scripts/verify.mjs` | Test tooling؛ env محدود وTypecheck/Build/Lint مؤقتة |
| CP-17 | U | `frontend/src/types/api.ts` | Runtime types؛ identity/Login/token/permissions |
| CP-18 | U | `frontend/src/services/api/client.ts` | Runtime؛ trusted transport/errors/abort/generation |
| CP-19 | U | `frontend/src/services/api/config.ts` | Runtime؛ base URL وtrusted origin configuration |
| CP-20 | U | `frontend/src/services/api/errors.ts` | Runtime؛ أخطاء آمنة دون تفاصيل حساسة |
| CP-21 | U | `frontend/src/services/api/session.ts` | Runtime؛ boundary ذاكرة فقط، بلا AuthProvider أوStorage |
| CP-22 | U | `frontend/src/features/auth/authApi.ts` | Runtime؛ Login/me services وruntime validation |
| CP-23 | U | `frontend/tests/api.test.ts` | Tests؛ transport/Auth/session/error regression |
| CP-24 | U | `frontend/tsconfig.test.json` | Test configuration؛ فحص أنواع الاختبارات والعقود |

**Excluded Files:** `.env` و`.env.*` الفعلية، `backend/phase2a_config_backup_*/`، والأرشيفان `backend_backup_before_update.zip` و`backend/changeflow_backend_review.zip`، وقواعد DB/SQLite القائمة، وvenv/node_modules وfrontend/dist وSource Maps/Build artifacts، وCaches وtsbuildinfo، وGitleaks binary/configs/reports وكل أدوات Scanner المؤقتة، وRun roots وprogress.json وGenerated PostgreSQL data/control logs/password files. لا تحتاج أيٌّ منها إلى Git لتشغيل الاختبارات؛ يعاد توليد الموارد الاصطناعية محليًا. لا استثناء .gitignore يُعامل كإثبات تاريخي للأمان.

### 13.5 Remaining Production Blockers وقرار التسليم

Legacy Demo retirement **Unresolved** رغم عزل أدوات إنشائها؛ Local JWT/DB secrets بتعرض غير محسوم، ولا Rotation دون دليل/تفويض؛ 21 موضعًا تاريخيًا باقٍ حسب 10/11. F2 وB tenant risk rules وC CAB enforcement، وLast Admin Race وRate limits/bcrypt/session revocation/email وProduction review باقية كما في SEC-01..10. العميل الجديد لم يُربط بجلسة الواجهة القديمة؛ الربط والصفحات في T2 بإذن مستقل. لا Production/E2E claim.

**توصية Checkpoint النهائية: Ready for Development Checkpoint** ضمن نطاق التطوير الاصطناعي المعتمد، مع Skip و18 deselected والتحذيرات والمخاطر الموثقة. Manifest ذات 24 صفًا تطابق Git بدقة، وStaging فارغة وBranch/HEAD كما في 13.1. لا إذن Stage/Commit/Push أوProduction؛ يتوقف العمل وينتظر موافقة المالك الصريحة على حفظ Checkpoint في GitHub، دون بدء A5-T2.
