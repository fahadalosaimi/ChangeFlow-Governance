# A5-T2 — Secure Workspace Authentication Implementation Plan

> **For Codex:** Implement the authorized A5-T2 tasks locally using the existing tools. Checkboxes record verified work; no Commit/Push orA5-T3 without separate approval.

**Goal:** ربط واجهة React بعقد Workspace Authentication وInvitations الفعلي دون بيانات قديمة أوTokens في localStorage/URL/Logs.

**Architecture:** Auth store خارج React تستخدم ApiSession/Client من T1 وuseSyncExternalStore داخل AuthProvider؛ جلسة في الذاكرة وsessionStorage للاستعادة فقط. Shell الحالية تربط طلباتها بجيل/مؤسسة/هوية الجلسة وتُعاد تهيئتها عند تغيرها. Minimal history routes للدخول وWorkspace وقبول الدعوة فقط؛ Router Data Mode والتصميم الكامل في T3.

**Tech Stack:** React/TypeScript الحالية، Node tests دون Dependencies جديدة، وPostgreSQL مملوكة للاختبارات مع حواجز T1. اختبار Browser محلي معزول إذا أمكن باستخدام Browser binaries الحالية، دون خدمات خارجية.

**Spec:** طلب المالك «A5-T2 — Secure Workspace Authentication, Sessions & Invitations»؛ baseline `de4d0e36f00cfcb7a8352baee6b94e3e0eff8bb3` على `feature/phase2-batch-a-tenant-security`. Working Tree كانت نظيفة. المراجع: development_master_plan.md وphase2_a5_t1.md وتقارير A1–A4 وعقود Backend الحالية.

## Global Constraints

- A5-T2 فقط؛ لا T3/T4 أوB/C/D أوGemini/Production/Models/Migrations/JWT v2/Permission Matrix changes.
- لا .env/Backup secret reads أوDB قديمة أوBootstrap/Legacy invocation أوSecret Rotation/Password Hash changes فعلية.
- لا Commit/Push/PR/Merge/Force Push أوتعديل master. Temporary resources مستقلة، ولا توقف موارد سابقة.
- لا Refresh Token flow أوBackend revocation claim؛ Logout محلي. لا Password/Invitation Token في Storage، ولا Access Token في localStorage/VITE_ أوLogs.

## Review Focus

1. Logout/Switch أثناء Login أوme أوBusiness request بطيئة: لا Session resurrection أوطلبات تتسرب إلى Tenant جديدة.
2. Network error أثناء Recovery تختلف عن401؛ hide protected data مع إبقاء إمكانية الاستعادة، دون Logout تلقائي خاطئ.
3. Storage unavailable أوفشل remove/write: Memory-only safe mode وتحذير واضح ومنع إعادة قراءة جلسة قديمة خلال نفس التشغيل.
4. Invitation Fragment تزال قبل Mount/طلبات؛ Refresh بعد الإزالة وExpiry/Revocation/Replay تعرض حالة عامة صادقة، دون Token أوAuto-login.
5. Legacy roles ذات read grants لا تُرسل طلبات Change/Admin غير مخولة؛ UI تشتق grants منme، وBackend تبقى المرجع.

## التنفيذ وQuality Gates

- [x] **Gate 1:** Isolation Gate قبل الوظائف ناجحة؛ baseline والنظافة محفوظتان.
- [x] **T2-1 RED→GREEN — Session lifecycle:** AuthStore وStorage/redirect/permissions/gateway؛ اختبارات Recovery/login/logout/expiry/network/403/storage/generation وTenant-bound requests.
- [x] **T2-2 RED→GREEN — Invitations:** authApi/types وinvitationFlow؛ Fragment/memory-only/one-in-flight واختبارات التسريب وRefresh وUnicode. لا اختلاق لتمييز Backend المتعمد حجبه.
- [x] **T2-3 — UI integration:** AuthProvider/useAuth/runtime/AuthRoot وصفحتا Login/Invitation، وربط App تدريجيًا مع Protected/Forbidden/loading/network states دون Business redesign.
- [x] **T2-4 — Integration/quality:** Backend/Browser/Frontend/typecheck/build/lint وGitleaks وdiff النهائي ناجحة؛ التفاصيل أدناه.
- [x] **T2-5 — Review report:** الخطة والتقرير وManifest وأدلة الفحص مكتملة؛ التوقف قبل Git.

**الحالة الحالية:** التنفيذ المحلي والتحقق مكتملان للمراجعة؛ A5-T2 جاهزة لمراجعة Development Checkpoint ضمن العزل المعتمد فقط. لا Commit/Push أوA5-T3. الأدلة والأعداد أدناه، ولا تعني Production Readiness.

## Architecture Decisions & API Compatibility

| القرار | التنفيذ وحدود العقد |
|---|---|
| مصدر الهوية | `/auth/me` بعد JWT v2 الفعلية، وقيم CurrentUser/Workspace/Permissions من Backend. JWT decoding يستخدم ver/exp للرفض المحلي/التوقيت فقط، ولا يمنح هوية أوPermissions |
| State | AuthStore مستقلة عن React + ApiSession/Client من T1، وAuthProvider/useSyncExternalStore؛ start تشارك Promise واحدة خلال StrictMode، دون Auth mock في التطبيق |
| Storage | JWT في الذاكرة وsessionStorage فقط للاستعادة؛ لا Profile أوPassword أوInvitation Token فيها. محاولة حذف مفتاح localStorage القديم دون قراءة/نسخ قيمته؛ لا fallback إليه |
| Routing | `/login` و`/workspace` المحمية و`/invitations/accept` فقط، مع `/` كمدخل و404 للغير. Workspace views الحالية تبقى داخل App، وReturn destination ثابت داخل التطبيق؛ لا React Router refactor قبل T3 |
| Scope/data | كل Request من App تمر عبر Client المعتمدة وWorkspace gateway ملتزمة بـbinding generation/org/user؛ React shell تعاد تهيئتها عند تبدله. Notifications/alerts المتأخرة تُرفض عند اختلاف binding |
| Reverification | Startup/Refresh وLogin ثمme، وعند403 أوVerify membership الصريحة. إعادة التحقق تمسح Workspace state، مع تنبيه المستخدم إلى فقد Unsaved work؛ لا Reset تلقائي للDrafts عند مجرد window focus |
| Local logout | تمسح الذاكرة/storage وتلغي العمل وتمنع Recovery القديمة في العملية. logout=1/memory=1 إشارات URL غير سرية لمنع استعادة سجل غير قابل للمسح بعدRefresh؛ لا JWT في URL ولا Backend revoke/Refresh Token مختلقة |
| Public provisioning | إزالة Signup و/auth/register وusername/grant_type من تدفق React. Backend register الحالية تبقى مرفوضة كما في A2؛ لا Endpoint جديدة أوتغيير Matrix |

| API الحالية | Request الفعلية | Response وValidation |
|---|---|---|
| POST /auth/login | URLSearchParams: tenant_slug/email/password؛ Browser Fetch تضبط Form Content-Type، ولا Bearer في هذا الطلب | token_type=bearer وAccess Token JWT structure؛ ثمme إلزامية قبل عرض بيانات محمية |
| GET /auth/me | Bearer من ApiSession داخل Origin المعتمدة فقط | جميع حقول T1، وIDs/permissions/workspace_slug validated؛ لا grants من Role label أواختلاق Tenant |
| POST /auth/invitations/accept | JSON token/password/full_name؛ authenticated=false، وContent-Type application/json | user_id/organization_id/status=activated فقط؛ لا Access Token أوAuto-login |

لا تغييرات Backend runtime أوModels/Migrations/JWT v2/Permission Matrix/Bootstrap/Legacy isolation. حُذف organization_id القديم من Create System payload في UI لأن Backend A4 تستمد المؤسسة وتمنع Mass Assignment؛ لا تغيير لمنطق إنشاء الأنظمة أوالسلطة.

## Session Lifecycle

1. قبل React mount تنشأ Runtime واحدة، وتلتقط/تزيل Invitation Fragment إن وجدت؛ لا اتصال ببريد/Analytics أوخدمة خارجية.
2. checking تخفي كل بيانات Workspace. Recover تقرأ sessionStorage بأمان وترفض JWT غير سليمة/منتهية قبل إرسالها؛ المرشحة لا تصبح هوية قبلme.
3. Login لا تحفظ Password، وتفرغ الحقل عند الإرسال؛ Stored token تكتب بعد التحقق منme فقط. الرسالة واحدة عند فشل Workspace أوEmail أوPassword، دون تفاصيل Server أوإثبات وجود حساب.
4. Authenticated تحمل User/Workspace/Permissions الموثقة، وbinding خاصًا بالجلسة والمؤسسة. لا تنقل طلبات أوبيانات React القديمة إلى جلسة جديدة؛ Client abort/generation وGateway pre/post checks تمنع ذلك.
5. Network/Timeout وServer availability تعطي unavailable مع بيانات مخفية وRetry صريحة، وتبقي Token مرشحة للاستعادة. 401 الحقيقية أوانتهاء JWT تمسح الجلسة؛ 403 لا تمنح وصولًا ولا تتحول تلقائيًا إلىLogout، وتُراجع الهوية أوتعرضForbidden.
6. Logout محلي؛ لا HTTP logout endpoint أومزاعم إبطال JWT المصدرة. SessionStorage errors لا توقف Login في الذاكرة؛ تحذير memory-only، وrefresh آمنة عبر memory/logout markers. عند حظر كل عمليات Storage قد يبقى سجل قديم غير قابل للحذف؛ المستخدم يُنبه لإغلاق التبويب، ولا يُعاد استعمال السجل داخل Runtime بعدLogout.

لم تُضف آلية Draft persistence؛ Logout/Switch/إعادة التحقق الصريحة تمسح حالة Shell، ولا تحفظ بيانات محمية في Browser Storage. الدور يتحدث منme عند التحقق، وBackend تفرض صلاحياته في كل Request؛ لا Realtime membership push claim.

## Invitation Flow & Email Dependency

- الرابط المعتمد المستقبلي: `/invitations/accept#token=<opaque-token>` داخل Origin التطبيق المعتمدة. Fragment تلتقط مرة للوثيقة قبل Mount وتزال بـreplaceState، وتُزال Query أيضًا دون قبول Token منها. لوفشل History تُفقد Token ويُعاد توجيه الوثيقة إلى Path نظيفة؛ لا إرسال غير آمن.
- Token private بالذاكرة فقط؛ لا React snapshot/Storage/query/history state/analytics/logs. Submit واحدة نشطة؛ النجاح أوالرفض النهائي يمسحانها. Network ambiguity تتيح Retry يدوية مع إعادة إدخال Password، دون retry تلقائية؛ بعد فقد تأكيد النجاح قد تقول المحاولة الثانية إن الدعوة غير متاحة.
- يتحقق العميل من full_name ومن 8 Unicode characters و72 UTF-8 bytes وفق A3؛ لا تعديل Password policy في Backend، ولا اعتماد على UTF-16 length وحدها.
- Expired/Revoked/Consumed يرفضها Backend A3 برسالة عامة متعمدة؛ UI تعرض مجموعة الاحتمالات ومسار Login/طلب دعوة جديدة دون كشف الحالة الفعلية أوInvented status API. Refresh بعد إزالة Fragment تعرض Missing link بوضوح.
- بعد النجاح Membership activated ثمLogin صريح. تُغلق الجلسة المحلية السابقة إن وجدت، ولا يستنتج Frontend الهوية الجديدة منActivation IDs أوToken؛ لاAuto-login.
- Adapter الحالية Unconfigured وتتعامل مع InvitationMessage/SecretStr وworkspace_slug دون Formatter لرابط أوبريد فعلي. لا تعارض مثبت مع صيغة قديمة؛ على D Email adapter أن تصيغ الرابط أعلاه وألا تحول Token إلىQuery. التسليم الحقيقي وResend operations التشغيلية مؤجلة، ولا خدمات فعلية استُدعيت.

## Permission Enforcement & Existing UI

App.tsx بقيت Shell/Business views الحالية؛ أزيلت كتل Auth وSignup القديمة ووُصلت الطلبات بـClient/gateway، دون إعادة كتابة المنصة. Role names للعرض وحقول تحرير الأدوار فقط؛ قرارات الوصول من permissions. Protected root/View guards وNavigation وقراءات Catalog/Changes وMutations تخضع للمنح المناسبة. Legacy read roles تحصل على Overview محدودة، دون طلب Change/Admin غير مخول أوDashboard وهمية بأرقام صفر.

تُرفض الاستجابات القديمة/نداءات caller قديمة حتى لو حاولت استعمال Client بعد Login لمؤسسة أخرى؛ إعادة إنشاء Shell بـbinding تمسح كل Data state، بما فيها بيانات كانت clearSession القديمة لا تمسحها. Frontend Guards ليست Authorization؛ لا تغيير A4 أوضمان CAB/Global RiskRule isolation. تظهر حدود B/C وAI integration pending بدل ادعاء تأمينها أوتشغيلGemini.

## Verification Results — actual runs

| الجولة | Passed | Failed | Skipped / Deselected | الدليل |
|---|---:|---:|---|---|
| Isolation Gate قبل الوظائف | 3 | 0 | 0 /0 | 12.49s؛ 1 PostgreSQL و2 guards/settings، env معزولة وCluster جديدة |
| Backend relevant regression النهائية | **303** | **0** | **1 /2** | **446.22s**؛ منها **196 PostgreSQL passed /0 skipped** و107 unit/memory passed +1 skipped |
| Browser integration النهائية | **1 pytest case** | **0** | **0 /0** | **25.55s**؛ **12 سيناريوًا** فعلية عبر Edge/Vite/HTTP FastAPI/PostgreSQL، ليست 12 pytest cases |
| Frontend Node tests النهائية | **33** | **0** | **0 /0** | **423.43ms**؛ منها13 T1 و14 Session/Scope و6 Invitation |
| TypeScript | Exit0 | 0 | — | App/TSX وAPI/test types وVite config |
| Production Build | Exit0 | 0 | — | Vite8.1.4،36modules،254ms؛ JS302.76kB/gzip83.57 وCSS41.72/gzip7.96 وHTML0.50/gzip0.30؛ بلا warnings |
| Lint | Exit0 | 0 | — | **0 warnings /0 errors**؛ عولجت Effects التي تغيرت مع جلسة Auth باستخدام useEffectEvent دون تعطيل قواعد lint |

**Backend scope:** test_a5_runner_configuration وtest_a5_isolation_gate وtest_a5_identity وtest_a2_authentication وtest_a2_security_corrections وtest_a3_invitations وtest_a4_authorization وtest_a4_isolation وtest_a4_notifications وtest_a4_regressions، عبر a5_isolated_runner مع --postgres-bin صريحة و`-k 'not bootstrap'`. لا Bare full-repository suite أوF2/Bootstrap تشغيلية. Skip الوحيدة نسخةSQLite لاختبارCollation، ونسختها PostgreSQL نجحت؛ Deselect حالتان تحملانbootstrap في IDs، لا نجاحًا مزعومًا. Login valid/invalid/tenant/disabled/v2/RoleChanges وA3 accept/expiry/revoke/replay/resend/directory activation مغطاة ضمن هذه المجموعة. نتائج T1 القديمة لا تُضاف لها.

**Browser scenarios:** Generic Login failure للمساحة والحساب الخاطئين بنفس الرسالة؛ Login يحضر بيانات Scope فعلية؛ Refresh recovery؛ فشلme بالشبكة ثمRetry مع بقاءToken؛ Role changes؛ Disabled membership/401؛ Tenant switch وLocal logout؛ Fragment removal/acceptance/explicit login وrefresh missing؛ Replay؛ Expired JWT؛ External next parameter لا يغيرOrigin؛ Storage unavailable/login memory-only/refresh لا يعيد جلسة. لا ادعاء Cloud/Production أوبريد حقيقي أوmanual screen-reader/full mobile visual QA.

**RED والتصحيحات:** 10 Session tests فشلت قبلStore ثم نجحت؛ أضيفت حالات لJWT structure تالفة ولـRetry بعدLogout ولفشل Header normalization، وشوهد RED ثم صُححت. Invitation tests الست فشلت قبلFlow ثم نجحت. أولBrowser run فشل عندworkspace-login قبل ربط App، ثم نجحت6سيناريوهات. تشغيل موسّع تعثر في Browser startup قبل أولسيناريو؛ قُوّي انتظارTarget ثم نجحت11وأخيرًا12سيناريوًا. ظهر أثناء التطوير خطأTypecheck فيnull guard وآخرلEffect event غير موصولة؛ أُصلحا قبل الجولة النهائية. لا Failed غير محسومة حاليًا.

**Test output safety:** اكتُشف أن فلتر Runner قد يلتقط نسخةMetadata داخل Traceback كسطرRaw؛ أضيف regression test فشل ثمنجح، وصار يقبل JSONMetadata مستقلة فقط ولا يطبع نسخةCompletedProcess/rawstderr. Browser fixture تُخرجpassed/failed/phase فقط. لا Password/Token أوHashes فعلية في التقارير.

**Isolation evidence:** Child environment allowlist، ومفتاح JWT جديد من CSPRNG في الذاكرة، ومنع dotenv/قراءة .env قبل App imports؛ DB driver/target guards وCluster/PID/port/system-identifier/Schema ownership كما في T1. جميع Schemas/Users/Password Hashes/Role controls داخل Fixtures مؤقتة فقط. Browser profile جديدة وAPI/Vite على منافذ Loopback مستقلة، وCORS اختبارية للـOrigin المحددة فقط. لم تُحذف أوتُوقف Profile أوService/Cluster سابقة؛ انتهت Finalizers دون خطأ وثبت غياب Run roots النهائية. لا تثبيت أوDependencies جديدة؛ مسارا --browser-bin/--node-bin صريحان، دون مسار مطور ثابت في الكود.

## Security Review & Remaining Risks

- لا حفظ لكلمات المرور في Browser storage/Logs، ولا JWT في localStorage أوVITE_. Access Token في sessionStorage هو اختيار التطوير المؤقت المعتمد، وتبقى مخاطرة XSS؛ لا ادعاء حمايته بتشفير عميل.
- أزيل Public Signup؛ لا Auto-login أوRefresh flow جديدة. Backend JWT/Permission Matrix/Models/Migrations وLegacy stubs وBootstrap محفوظة دون تغيير؛ لا بيانات تشغيلية أوSecrets محلية تغيرت.
- **Secret scan:** Gitleaks v8.30.1 الموجودة مسبقًا: تحقق SHA-256 للـZIP وChecksums وتطابق exe مع الأرشيف، وإعادة اختبار Detection/100% Redaction/Metadata-only template ببيانات اصطناعية نجحت. فُحصت جميع الملفات الـ28 المعدلة والجديدة بقواعد defaults وبدون allow-comments: **0 Findings**. المخرجات ملتقطة والتقارير rule_id/file/line/commit فقط خارج المشروع. المقارنة الخاصة لقيم Setup من نسخ Git الثلاث المعروفة أثبتت غيابها من الملفات الحالية، دون عرض القيم أوHashes. لم تُقرأ .env أوالأرشيفات أوتُعد عمليات تصنيف التاريخ. منع Sandbox كتابة تقرير اصطناعي أولًا؛ أُعيدت العملية بصلاحية مناسبة قبل فحص المشروع، ولم يُعتبر الخطأ نتيجة نظيفة.
- Demo credentials التاريخية مازالت **Unresolved**، وF2 وRisk Rules B/CAB C وLast Admin Race وRate limits/bcrypt/session revocation/real email/full production review مفتوحة. T2 لا تغلق هذه البوابات، ولا تجرب Credentials قديمة.
- Logout محلي فقط؛ حظر Storage بالكامل قد يمنع حذف سجل قديم، لذا يوجّه المستخدم لإغلاق التبويب. التحقق الصريح يمسح Unsaved workspace data، دون ادعاء Draft recovery أوتحديث الدور لحظيًا؛ Backend تفرض الحالة عند كل طلب.

## Pending A5-T3 Dependencies

Router Data Mode ونقل minimal history adapter وview metadata؛ i18n ar-SA/en وRTL/LTR وfull accessibility/keyboard/screen-reader/mobile visual QA؛ Obsidian & Sage tokens/themes وResponsive shell. صفحات Auth تستخدم نصوصًا English متسقة مع الواجهة القائمة؛ لا ادعاء اكتمال Localization في T2. لا Projects/Settings/Reports وهمية ولا Gemini/CAB مؤمنة.

## Proposed Checkpoint Manifest — T2 only

**28 ملفًا: 9 Modified و19 New**؛ قائمة مقترحة للمراجعة، لا Staging أوCommit. T1 وعزل Legacy محفوظان أصلًا في HEAD الحالي، ولا يعاد إدراجهما كتغييرات T2. مسارات الجدول نسبية لجذر المستودع.

| ID | الحالة | File Path | الغرض |
|---|---|---|---|
| T2-01 | M | backend/docs/development_master_plan.md | تحديث الخطة والحالة والأدلة |
| T2-02 | M | backend/tests/a5_isolated_runner.py | Browser tool inputs وفلترة آمنة للمخرجات |
| T2-03 | M | backend/tests/test_a5_runner_configuration.py | اختبار انحدار لفلتر Metadata |
| T2-04 | M | frontend/index.html | no-referrer |
| T2-05 | M | frontend/scripts/verify.mjs | تضمين الاختبارات الجديدة |
| T2-06 | M | frontend/src/App.tsx | إزالة Auth القديمة وربط الجلسة والصلاحيات والطلبات |
| T2-07 | M | frontend/src/features/auth/authApi.ts | JSON Invitation Acceptance الفعلية |
| T2-08 | M | frontend/src/main.tsx | Runtime/Provider قبل Mount |
| T2-09 | M | frontend/src/types/api.ts | عقود Invitation Input/Activation |
| T2-10 | U | backend/docs/phase2_a5_t2.md | الخطة والتقرير وManifest |
| T2-11 | U | backend/tests/test_a5_t2_browser.py | FastAPI/PostgreSQL/Browser integration المعزولة |
| T2-12 | U | frontend/e2e/auth.mjs | CDP flows بمتصفح جديد وبيانات اصطناعية |
| T2-13 | U | frontend/src/features/auth/AuthContext.ts | Context typed |
| T2-14 | U | frontend/src/features/auth/AuthProvider.tsx | Auth runtime provider |
| T2-15 | U | frontend/src/features/auth/AuthRoot.tsx | الحد الأدنى من المسارات والحالات المحمية |
| T2-16 | U | frontend/src/features/auth/auth.css | Form/focus/status styles محدودة |
| T2-17 | U | frontend/src/features/auth/authStore.ts | Session lifecycle/generation/recovery |
| T2-18 | U | frontend/src/features/auth/invitationFlow.ts | Fragment capture وprivate in-memory state |
| T2-19 | U | frontend/src/features/auth/permissions.ts | ربط Views بالمنح الفعلية |
| T2-20 | U | frontend/src/features/auth/runtime.ts | Browser runtime وearly URL stripping |
| T2-21 | U | frontend/src/features/auth/safeRedirect.ts | Allowed destination وrecovery markers |
| T2-22 | U | frontend/src/features/auth/sessionStorage.ts | Storage error handling وlegacy key removal |
| T2-23 | U | frontend/src/features/auth/useAuth.ts | External store subscription |
| T2-24 | U | frontend/src/features/auth/workspaceGateway.ts | Session/tenant-bound caller requests |
| T2-25 | U | frontend/src/pages/InvitationAcceptancePage.tsx | Accept ثم Login صريح |
| T2-26 | U | frontend/src/pages/WorkspaceLoginPage.tsx | Workspace credentials form |
| T2-27 | U | frontend/tests/auth.test.ts | Session/scope/storage/permissions tests |
| T2-28 | U | frontend/tests/invitation.test.ts | Fragment/validation/replay/network safety |

**Excluded:** .env ونسخها، Backups/ZIPs، PostgreSQL clusters/data، Browser profiles، node_modules/venv، dist/Build/source-map artifacts، caches/tsbuildinfo، Scanner binaries/reports، وأي ملفات Password/control/progress مؤقتة. لم تُنسخ Secrets إلى التوثيق أوالأدوات؛ لا ملف مؤقت يلزم Git. التوثيق الجديد لا ينقل قيم الحسابات القديمة أومفاتيح محلية.

## تحقق التسليم السابق — قبل المراجعة اللاحقة

الفحص السابق شمل28 ملفًا ووجد0 Findings؛ Manifest طابقت9 Modified +19 New وStaging كانت فارغة. Python AST وUTF-8 وdiff check نجحت. هذه نتائج التنفيذ السابقة، ويستبدل قرار المراجعة التالية حالة الجاهزية الحالية.

## Final Development Checkpoint Review — current gate

هذه مراجعة لاحقة مستقلة لنتائج التنفيذ أعلاه. Baseline الحالية مطابقة: HEAD de4d0e36f00cfcb7a8352baee6b94e3e0eff8bb3، الفرع وorigin صحيحان، و9 Modified +19 New دون Staging. لا Git mutations أوT3. لا تجمع نتائج هذه الجولة مع النتائج التاريخية.

- [x] مراجعة الملفات الـ28 وعقود Login/JWT/Session/Invitation/Permissions والـBrowser assertions؛ العيب المؤكد R-T2-01 أدناه.
- [x] اختبار RED ثم إصلاح محدود وGREEN؛ لا تغيير لسياسة Backend أوتصميم T3.
- [x] Full Relevant Backend Regression داخل الحواجز؛ استبعادLegacy invocation. حالاتConstraints وبياناتmembership ذات كلمةbootstrap شُغلت منفصلة بعد إثبات عدم استدعائها Bootstrap.
- [x] إعادة Browser على الكود النهائي وFrontend tests/typecheck/build/lint؛ الأعداد وحدود التغطية أدناه.
- [x] Gitleaks وdiff check وManifest والخطة والتقرير النهائي مكتملة؛ انتظار اعتماد المالك.

#### نتائج المراجعة الجارية — لا تجمع مع نتائج التنفيذ السابقة

**العيب المؤكد R-T2-01:** كانت استجابة Login برمز503 تُصنف كبيانات اعتماد خاطئة، وتحوّل الحالة إلى anonymous/credentials. اختبار جديد أعطى RED: **1 Failed /0 Passed /529.90ms**، ثمGREEN بعد تصحيح503. توسيع الحدود إلى408/429/500/503 كشف استمرار المشكلة مع408: **1 Failed /433.49ms**؛ الإصلاح النهائي يقصر أخطاء الاعتماد/الإدخال على401/422 الفعليتين، ويحفظ403 كحالةForbidden، ويعامل بقية الأعطال كعدم توفر. GREEN النهائي: **1 Passed /0 Failed /300.77ms**، يتضمن حالاتHTTP الأربع. لا تغيير لسياسة Backend أوJWT، ولا كشف لتفاصيل الخادم أوكلمة المرور.

**التبديل أثناء الطلبات:** اختبار Store/Client/Gateway جديد بوسيلة نقل مؤخرة اصطناعية يغطي تبديل المستخدم داخل المؤسسة نفسها أوإلى مؤسسة أخرى، مع وصول نجاح200 أو401 قديمة. يثبت إلغاء الطلب ورفض session_changed، وعدم نشر بيانات قديمة أوإبطال الجلسة الجديدة. **1 Passed** تشمل4 حالات داخلية. كان السلوك صحيحًا بالفعل؛ لم يلزم إصلاح إنتاجي لهذه النقطة.

**Frontend النهائية بعد آخر إصلاح:** **35 Passed /0 Failed /0 Skipped /539.70ms**: منها13 Client T1 و16 Auth/Scope و6 Invitation. نجح Typecheck للتطبيق والاختبارات وVite config. Production Build عبر Vite8.1.4 نجحت في281ms إلى مجلد مؤقت دون قراءة.env أوتغيير dist: عددmodules هو36؛ JS302.75kB/gzip83.57، CSS41.72/gzip7.96، HTML0.50/gzip0.30. Lint: **0 Errors /0 Warnings**. لا تغيير Dependencies أوLockfile. نتيجة749.99ms/484ms السابقة جولة متداخلة قبل استكمال408، ولا تجمع مع هذه الجولة.

#### Full Relevant Backend Regression — completed

| التشغيل | Passed | Failed | Skipped | Deselected | PostgreSQL | Unit/memory | المدة |
|---|---:|---:|---:|---:|---|---|---|
| المجموعة الواسعة:18 ملفًا معA1/A2/A3/A4/T1 وLegacy AST/Startup فقط | **426** | **0** | **1** | **23** | **262 Passed /0 Skipped** | **164 Passed /1 Skipped** | **552.55s** |
| إكمال خمس حالات استُبعدت بكلمةbootstrap فقط | **5** | **0** | **0** | **176** | **4 Passed /0 Skipped** | **1 Passed /0 Skipped** | **40.56s** |

التشغيلان **غير متداخلين في الحالات المنفذة**: الثاني ينتقي فقط الحالات الخمس المستبعدة بالاسم في الأول. النطاق المغطى431 حالةBackend مميزة ناجحة، وSkip واحدة؛ ليست نتيجة تشغيل واحد، ولا يضاف لها303 من مرحلة التنفيذ أوحالةBrowser. لا تجمع أعدادDeselected بين التشغيلين:176 في الثاني هي بقية اختبارات ملفاته الثلاث، ومنها حالات نجحت في الأول. بعد الإكمال يبقى18 Legacy CLI/Import invocation غير منفذة عمدًا؛ حالاتAST/غيابLiterals وStartup الآمنة نجحت ضمن الأول.

Skip الوحيدة في `test_a2_authentication.py:333` لنسخةSQLite منCollation؛ نسخةPostgreSQL نجحت، ولاPostgreSQL Skip. لاFailures نهائية أوCleanup errors. ثبت غيابRun roots لكلا التشغيلين بعد انتهائهما؛ لا اتصال بقاعدة قديمة أوخدمة قائمة ولاقراءة.env أوSecrets فعلية.

**لماذا شُغلت الخمس؟** جردCollect-only أثبت أن الاستبعاد الأول شمل18 Legacy invocations وخمس حالات تحملbootstrap فيالاسم/البيانات. مراجعة مصدر الخمس أكدت أنهاLogin لعضويةFixture مؤكدة، وقيودEvidence/Uniqueness/Directory acceptor، وكشفCheck constraint متغيرة. لاCLI/Service Bootstrap أوSetup فيها. أُكملت علىPostgreSQL جديدة داخل الحواجز، دون تغيير مرشح المجموعة الأولى أوإخفاءاستبعاداتها.

**ملاحظة تشغيلية:** جردCollect-only الأول نجح في استخراجMetadata، لكنSandbox منع حذف مجلده الفارغ. أُعيد خارجSandbox، ونُظف ذلك المسار المحدد بعد إثباته وكونه فارغًا؛ لاDB أُنشئت فيالجرد، ولاACL تغيرت أوحذفRecursive لمسار غير مثبت.

**Browser النهائية بعد آخر إصلاح:** **1 pytest Passed /0 Failed /0 Skipped /0 Deselected /27.06s**، تغطي **13 سيناريوًا** بعد إضافة طلب معلق. استُخدمت FastAPI وPostgreSQL18.4 حقيقيتان داخل موارد اختبار جديدة، مع migrations علىSchema مملوكة، وEdge headless بملف تعريف جديد وVite علىLoopback. تحكم Network/Storage والعضوية محصور في طبقة اختبار خارج Backend runtime؛ لاMock Authentication أوResponse bodies. انتهى التنظيف وثبت غياب Run root والموارد المملوكة دون إيقاف خدمات سابقة. جولة39.98s السابقة تغطي السيناريوهات نفسها قبل استكمال إصلاح408؛ لا تجمع نتيجتها مع هذه الجولة.

| السيناريو المنفذ | Assertions الأساسية | حدود الدليل |
|---|---|---|
| generic-login-failure | Workspace غير موجود وEmail غير موجود يعرضان رسالة الفشل نفسها | لا قياس Timing enumeration أوRate limits |
| workspace-login | Login ثمme وShell وLocal Change منDB؛ لاPublic Signup | حسابRequester اصطناعي |
| refresh-recovery | استعادة الجلسة والتحقق وظهورShell؛ لاJWT في مفتاحlocalStorage القديم | تبويب واحد |
| network-recovery | حجبme يخفي البيانات ويحفظ المرشحة؛ Retry ينجح بعد رفع الحجب | عطل شبكة محقون فيBrowser |
| pending-response-tenant-switch — جديد | تعليق استجابةHTTP حقيقية عندResponse stage عبرCDP؛ Logout ثمLogin لمؤسسة أخرى قبل تحريرها؛ لابيانات Local Change/notification قديمة، والعودة الأولى تجلب بياناتها فقط | لااستبدال للاستجابة؛ Backend/DB حقيقيتان |
| role-change | تعديل دورFixture فيDB ثمVerify membership؛ صلاحيات وOverview محدودة منme | لاتحديثPush لحظي |
| disabled-membership | تعطيلFixture ثمme401؛ العودة للدخول ومسحSessionStorage | لاحساب فعلي |
| tenant-switch-and-logout | هويةWorkspace الثانية ثمLogout وLogin form | السيناريو الأصلي بلاطلب معلق؛ أضيفت الحالة أعلاه لسد الفجوة |
| invitation-fragment-and-explicit-login | إزالةhash/query مبكرًا؛ قبول حقيقي وتفعيل دون جلسة؛ Refresh يعرضMissing link | Mailbox اختبارية، لابريد فعلي |
| invitation-replay | إعادة الدعوة المستهلكة إلىA3 ترفض برسالةUnavailable | Expired/Revoked فيBackend وUnit؛ ليستاBrowser flows منفصلتين |
| expired-token-recovery | JWT اصطناعية منتهية تعيد للدخول وتمسح المرشحة | Local expiry؛ رفضJWT/Claims مغطى فيBackend |
| safe-redirect | external next لايغيّرOrigin؛ الوجهةWorkspace داخلية | لاRouter refactor |
| storage-unavailable | حظرStorage؛ الدخول بالذاكرة مع تحذير؛ Refresh لايبعث جلسة قديمة | حظرStorage محاكى صراحة |

**Code review:** Login Form وJSON acceptance تطابقان A2/A3. API Client تقيد Origin وAuthorization وتمنعRedirect وتسرب تفاصيل الأخطاء. الهوية والمنح منme، وفكJWT للـver/exp المحلية فقط. حالات checking/unavailable/forbidden تخفي البيانات؛ 401/expiry تمسح الجلسة. SessionStorage مؤقتة للاستعادة، وLogout محلي ولايدعي Server revocation. الطلبات مرتبطةبالـbinding، وApp تعاد تهيئتها عند التبديل. Matrix وModels/Migrations وBootstrap وLegacy stubs وBackend runtime دون تغيير.

**الحدود والجودة:** لاDependencies زائدة أوImports مكسورة أوUnused diagnostics. حذفAuth/Signup وdirect fetch القديمة ضمنT2؛ Business views محفوظة. readResponse أصبحت typed cast للـBusiness DTO فقط؛ Runtime validation للهوية وToken/Invitation قائمة، دون ادعاء تحقق شامل لبيانات الأعمال. صفحات الهوية لهاlabels مرتبطة بالمدخلات وpassword autocomplete وأزرار ذات دلالة ولوحة مفاتيح وحالاتpending/alert/status وfocus-visible وأهداف44px. لم تجر مراجعة يدوية كاملة بـscreen reader أوzoom/mobile أوWCAG conformance audit؛ تبقى لبواباتT3 والجودة.

**فجوات التغطية:** لاتوجد Browser flows منفصلة لـExpired/Revoked invitations أو403 أوتبديل مستخدمين داخلTenant واحدة؛ توجدBackend/Unit لهذه الحالات، ومنها4 حالات التبديل الجديدة. لافحص عدة متصفحات/تبويبات/Mobile أوEmail فعلي أوProduction أوF2 positive أوSession revocation. هذه حدود معلنة وليست اختبارات ناجحة ضمنيًا.

**Git وManifest:** **9 Modified +19 New =28**، مطابقة للجدول أعلاه، والوثائق داخلbackend/docs الصحيح دون نسخ إضافية. تغييرات هذه المراجعة: إصلاحauthStore واختباراتauth.test.ts وتوسيعauth.mjs، وجميعها ملفاتNew موجودة فيManifest؛ لااختلاف عددي أوملف خارجها. Staging فارغة؛ لاحفظ فيGitHub.

#### أوامر إعادة التحقق وحدود التشغيل

من مجلدbackend، يشيرPG_BIN إلى مجلد binaries المثبتة فقط؛ لاURL أوCluster قائمة. التنفيذ الفعلي استخدمPython3.13.1، وNode24.17.0، وEdge156.0.4314.50، وPostgreSQL18.4 علىWindows. المسارات الخاصة بالمضيف تمر كمدخلاتCLI، ولا تحفظ في الاختبارات.

```powershell
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' tests/test_a5_runner_configuration.py tests/test_a5_isolation_gate.py tests/test_a5_identity.py tests/test_a2_authentication.py tests/test_a2_security_corrections.py tests/test_a3_invitations.py tests/test_a4_authorization.py tests/test_a4_isolation.py tests/test_a4_notifications.py tests/test_a4_regressions.py tests/test_a1_migrations.py tests/test_a1_schema_contracts.py tests/test_a1_http_boundaries.py tests/test_a1_fixture_safety.py tests/test_change_state_service.py tests/test_model_constraints.py tests/test_schema_hardening.py tests/test_legacy_setup_disabled.py -k 'not bootstrap and not script_and_import_fail_without_database_hashing_or_mutation and not direct_cli_exits_nonzero_without_traceback_or_argument_echo'
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' --browser-bin '<BROWSER_BIN>' --node-bin '<NODE_BIN>' tests/test_a5_t2_browser.py
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' tests/test_a2_authentication.py tests/test_a1_migrations.py tests/test_a1_schema_contracts.py -k bootstrap
```

من مجلدfrontend: `node scripts/verify.mjs all`. لاBare pytest خارج الحواجز؛ حظر تشغيلLegacy/Bootstrap وقواعد موجودة يتقدم على أي توجيه عام لتشغيل مجموعة غير مقيدة. جميع عمليات الإنشاء والترحيل وتعديلFixture users تقتصر علىSchema/Cluster مملوكة جديدة. لاSQLite بديلة عنPostgreSQL؛ الحالات memory/unit موضحة منفصلة.

#### Final Security Scan & Disposition

**Passed — Gitleaks v8.30.1:** جميع الملفات الـ28 المعدلة والجديدة: **0 Findings**. طابقت SHA-256 للحزمة وChecksums المثبتين سابقًا، وexe تطابقZIP الرسمية. أُعيد اختبارDetection و100% Redaction وMetadata-only template ببيانات اصطناعية قبل المشروع. استُخدمت قواعدdefaults وignore file فارغة وignore-gitleaks-allow لمنع الاستثناءات، وبيئة أداة محدودة وstdin محلية. التقارير rule_id/file/line/commit فقط خارج المشروع؛ لا قيم أوRaw matches أومخرجات خام منشورة، ولا محتوى مصدر في مجلد الأداة. مقارنة خاصة في الذاكرة لقيمSetup من نسخGit الثلاث المعروفة أثبتت غيابها من القائمة، دون عرض أوHashes لكلمات المرور أو.env/Backup reads أوإعادة تصنيف للتاريخ. هذه نتيجة النطاق الحالي وليست شهادة خلو مطلقة أوإثبات تقاعدDemo. أُعيد فحص وثيقتي التسليم بعد تثبيت النتيجة: **0 Findings**. تهيئة الفحص الأولى فشلت في الاختبار الاصطناعي بسبب غياب report-format=template الصريحة؛ صُححت قبل أي ملف مشروع. محاولةSandbox لاحقة رفضت إنشاء ملف إعداد فارغ؛ أُعيد الفحص خارجSandbox. لم يُعتبر أي خطأ نتيجة نظيفة، ولم يُكشف Secret.

| البند | الحالة والدليل المطلوب |
|---|---|
| R-T2-01: تصنيفLogin outage | Closed محليًا؛ RED ثمGREEN واختبار408/429/500/503 مع بقاء401/422 و403 مستقلة |
| الجلسات وTenant isolation | Passed ضمنBackend/Unit/Browser المعزولة؛ طلبات معلقة وسلوك401 قديمة لايعيدان بيانات أويُبطلان جلسة بديلة |
| Invitation flow | مطابقA3؛ Fragment/Memory/JSON فقط، إزالة مبكرة، قبول ثمLogin صريح، Replay مرفوض؛ لاSignup |
| Git/Manifest | 9M/19U، Staging فارغة؛ لاRuntime Backend أوPolicies أوDependencies خارج النطاق |
| Legacy Demo retirement | Unresolved؛ يمنع استخدام قاعدة الحسابات القديمة أوالمؤسسات الحقيقية قبل معالجة معتمدة وأدلتها |
| Local JWT/DB Secrets | لم تتغير؛ لاExposure جديدة مثبتة في هذه المراجعة، ولاRotation أوتجربة لصلاحيتها |
| Production gates | F2 وB/C وLast Admin Race وRate limits/bcrypt/session revocation/real email وProduction review باقية |

**نطاق التطوير الآمن:** موارد اصطناعية جديدة ومعزولة فقط، دون.env أوDB قديمة؛ sessionStorage قرار مؤقت مع خطرXSS، وLogout محلي. نجاح الاختبارات لايمنحProduction readiness أويغلقالمخاطر السابقة. الترجمة وRTL/Design System/Router/QA الشاملة مؤجلة إلىT3.

**التوصية النهائية: Ready for Development Checkpoint.** أُغلقت Quality Gates المحلية ضمن الأدلة والحدود أعلاه. Python AST وUTF-8 وgit diff --check وManifest مطابقة Git، وStaging فارغة؛ HEAD de4d0e36f00cfcb7a8352baee6b94e3e0eff8bb3 وmaster محفوظان. لاFailure نهائية أوملف خارجManifest. لاCommit/Push/PR/Merge/Deployment، ولاA5-T3؛ انتظار اعتماد المالك الصريح علىGit Checkpoint.
