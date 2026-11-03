# ChangeFlow Governance — Master Development Implementation Plan

> **For Codex:** After plan review and authorization, implement this plan task-by-task using the user-selected execution method and available native tools. Steps use checkbox (`- [ ]`) syntax for tracking. No external framework sub-skill is required.

**Goal:** تحويل المشروع تدريجيًا إلى Enterprise Multi-Tenant SaaS لتحليل أثر التغيير وإدارة مخاطره وحوكمته، مع عزل المؤسسات وقرارات قابلة للتدقيق وتجربة عربية سعودية وإنجليزية كاملة.

**Architecture:** الإبقاء على React/Vite SPA وFastAPI وSQLAlchemy/Alembic، مع PostgreSQL للترحيل والتكامل والإنتاج. فصل خدمات Risk الحتمية وAI الاستشارية وCAB البشرية، وإعادة هيكلة الواجهة على مراحل مرتبطة بعقود Backend فعلية. تبقى الهوية والصلاحيات مشتقة من Database داخل Backend.

**Tech Stack:** React 19، TypeScript 6، Vite 8، CSS، FastAPI، Pydantic 2، SQLAlchemy 2، Alembic، psycopg2، python-jose، bcrypt، pytest وhttpx للاختبار. الإصدارات التفصيلية أدناه من المستودع وليست توصية ترقية.

**Spec:** طلب المستخدم «ChangeFlow Governance — Enterprise SaaS Transformation — Master Development Prompt»، خاصة القسم 22: **Planning Gate Only**، بتاريخ 2026-11-01 بتوقيت Asia/Riyadh. مصدره المرفق المحلي [نص الطلب](<C:/Users/W10/.codex/attachments/9f871ecd-ce7d-43dd-a1cc-bcc9e4f247e2/نص ملصق.txt>). المرفق خارج Git؛ المتطلبات والقيود التنفيذية محفوظة هنا كي تبقى الخطة قابلة للاستخدام عند غياب المرفق. تقارير [A1](phase2_a1.md) و[A2](phase2_a2.md) و[A3](phase2_a3.md) و[A4](phase2_a4.md) أدلة تاريخية تُراجع مقابل الكود وGit.

**حالة الوثيقة المحدثة — Browser Startup /DevTools Port investigation (2026-11-03):** Checkpoint0ada30a محفوظة،والفرع/Remote HEAD مطابقان وWorking Tree نظيفة عند البدء. أضيف رصد Startup آمن وFault Injection دون تغيير سلوك الانتظار أوالقراءة. Auth13/13 وPresentation62/62 نجحتا؛لم يتكرر read failure الحقيقي. القفل الاصطناعي علىWindows أعادEBUSY ثمValid بعدunlock؛هذا ليس إثباتًا لسببEdge التاريخي. **Root Cause UNRESOLVED؛Browser Gate OPEN / NOT PASSED؛T4-B NOT AUTHORIZED؛التصنيف الشاملC.** Frontend68 Passed وTypecheck/Build/Lint ناجحة؛Python diagnostics9 Passed. لاfunctional fix أوTimeout/Retry جديدة أوCombined بلاسببمثبت. Manifest9 Modified/0 New؛لاGit writes. الأدلة والحدود في [تقريرT4 §17](phase2_a5_t4.md).

## Global Constraints

- المستودع `bigest11/ChangeFlow-Governance` فقط، والمسار `C:\Users\W10\AI_Change_Impact_Analyzer`؛ ArchitectAI خارج النطاق تمامًا.
- الفرع المعتمد `feature/phase2-batch-a-tenant-security`، وخط أساس التحقيق الحالي `0ada30aba8d50b94180b305edcbc0c35fea4634e`؛ عند اختلاف Branch أوRemote أوHEAD المتوقع، توقف واشرح قبل تعديل الملفات. بيانات Stage 0 أدناه تاريخية.
- التفويض الأحدث **Browser Startup /DevTools Port Root Cause Investigation** يسمح بتشخيص Startup ورصد منقح وfault injection مملوكة،وإصلاح Test Infrastructure فقط بعدRootCause مثبتة وRED→GREEN. لاAppBusiness/JWT/PermissionMatrix changes،ولاTimeout increase أوFixedSleep/BlindRetry أوCredentials/DB قديمة/Legacy/Bootstrap. لاCommit/Push/PR/Merge/Deployment/master changes أوT4-B/B/C/D.
- لا Commit أوPush أوPR أوMerge أوRebase أوForce Push أوتعديل `master` دون الموافقة المحددة؛ Git Checkpoint يأتي بعد اعتماد نتائج المرحلة فقط.
- لا تشغيل Bootstrap فعلي أوSeed أوSetup على قاعدة قائمة، ولا بريد حقيقي أوخدمات مدفوعة أوDeployment أوDomains أوProduction Secrets أوProduction Migrations دون موافقة صريحة منفصلة.
- لا اختبار على قاعدة إنتاجية، ولا حذف بيانات Legacy أوHistory، ولا اعتبار `create_all()` بديلًا لـMigrations.
- لا تغيير Windows System ACL أوصلاحيات جذر C أوالمستخدم أوOneDrive لتسهيل الاختبار؛ F2 تبقى مفتوحة إلى وجود إثبات إيجابي مناسب.
- لا Public Registration، ولا Role أوTenant ID من العميل كمرجع موثوق؛ إخفاء عناصر UI ليس Authorization.
- الهوية الرسمية **Obsidian & Sage**: `#151A18`، `#28352F`، `#B8F28B`، `#D9C8A9`، `#F4F1E8`؛ Dark وLight مصممان، مع Risk Colors مستقلة.
- اللغتان `ar-SA` و`en`، واتجاها RTL/LTR، وIntl للتاريخ والوقت والأرقام؛ لا تغيير API Fields أوDatabase Columns لمجرد الترجمة.
- صفحات فعلية وروابط وBrowser History وRefresh؛ لا وظائف وهمية أوبيانات اصطناعية على أنها فعلية أوTemplates على أنها Gemini.
- WCAG 2.2 AA قدر الإمكان، Keyboard وScreen Reader وResponsive و`prefers-reduced-motion`، دون زخرفة أوحركة مشتتة.
- كل مرحلة: Audit → Design → Implementation → Testing → Security Review → Documentation → User Approval → Git Checkpoint بعد الموافقة فقط. لا انتقال تلقائي عند قرار مهم معلق.

## Review Focus

1. انتهاء جلسة أوخفض دور أثناء طلبات متزامنة: إزالة البيانات المخزنة ومنع استجابة قديمة من إعادة بيانات الجلسة السابقة؛ اختبار A5-T2.
2. دعوة منتهية/ملغاة تصل متأخرة، أوRefresh بعد إزالة الرمز من URL: رسالة تعافٍ صادقة دون كشف الرمز أوتخزينه دائمًا؛ اختبار A5-T2 وD-T3.
3. غياب Rule مطلوبة أووجود قواعد متعارضة: لا Score صفر ضمنية ولا Low/Proceed؛ اختبار B-T2.
4. تعديل Change أوRisk Policy أثناء الموافقة/التنفيذ: منع اعتماد أوتنفيذ نسخة غير مراجعة؛ اختبار C-T2.
5. تاريخ عربي/إنجليزي ومحتوى مختلط الاتجاه، مع وقت محلي قديم بلا Offset: عرض متسق دون اختلاق Timezone أوإعادة كتابة التاريخ؛ اختبار A5-T3 وS7-T1.

---

## 1. نتيجة Stage 0 وحالة Git

| الفحص | النتيجة الفعلية في 2026-11-01 |
|---|---|
| CWD | `C:\Users\W10\AI_Change_Impact_Analyzer` |
| origin fetch/push | `https://github.com/bigest11/ChangeFlow-Governance.git` |
| Branch | `feature/phase2-batch-a-tenant-security` |
| HEAD | `5ef6a68df8a5ef1293dfbe0a605e53fefa8afec5` — `feat(authz): implement A4 permissions and tenant resource isolation` |
| Working Tree قبل التدقيق | نظيفة، دون Staged أوUntracked |
| Checkpoints السابقة | A1 `d661c57`؛ A2 `1f7a105`؛ A3 `63f01db`؛ A4 `5ef6a68` |
| تغيير هذه المهمة المقصود | إضافة `backend/docs/development_master_plan.md` فقط؛ Untracked إلى حين موافقة الحفظ |
| التشغيل | فحوص محلية محدودة موثقة في القسم 10؛ لا فتح قاعدة المشروع أو`.env` أوأسرار تشغيلية |

لم توجد `AGENTS.md` ضمن المستودع أوالمسارات الأبوية المفحوصة. قرئت مهارة `writing-plans` لتنظيم الخطة؛ قيود المستخدم بشأن التخطيط والموافقات تتقدم على أمثلة التنفيذ والحفظ فيها.

**تسوية اختلاف التوثيق عن Git:** يصف أول تقرير A4 حالته قبل Commit، لكن Git الحالية تؤكد وجود Checkpoint A4 المحددة. هذه حالة تاريخية في التقرير، وليست اختلافًا عن خط الأساس. لا تُعاد المراحل السابقة ولا يُعاد تفسير حفظها على أنه Production Approval.

## 2. المعمارية الفعلية وTech Stack

```text
React SPA: src/main.tsx → App.tsx + App.css
    │ fetch + Bearer JWT، VITE_API_BASE_URL
FastAPI app/main.py
    ├─ auth / invitations
    ├─ foundation / change-management / change_execution / notifications
    ├─ TenantContext → DB membership → explicit permissions → SQL resource scopes
    └─ SQLAlchemy Session → PostgreSQL المستهدفة / SQLite محلية قديمة
Alembic: initial → A1 expand → backfill → enforce
```

### 2.1 Frontend

- `frontend/package.json`: React/React DOM `^19.2.7`، TypeScript `~6.0.2`، Vite `^8.1.1`، Oxlint `^1.71.0`؛ توجد `package-lock.json`. البناء المحلي أعلن Vite **8.1.4**؛ تختلف نسخة البيئة المثبتة عن الحد الأدنى في Manifest.
- `frontend/src/App.tsx`: **5606 أسطر**، Types وAPI وAuth وState وForms وViews في مكون واحد. `App.css`: **3420 سطرًا**؛ Media Queries وPrint Styles موجودة بالفعل.
- التنقل State محلية باسم `view`، وبعض الانتقال عبر `scrollIntoView`؛ لا Router في Dependencies. توجد Views منفصلة منطقيًا، لكنها ليست Routes تحفظ Deep Links وHistory.
- `fetch` مباشر و`Promise.all` لتحميل موارد كثيرة؛ JWT في `localStorage`، واستعادة الجلسة عبر `/auth/me`، وPolling للعداد كل 30 ثانية. لا Error Boundary أوRoute Splitting أوTest Runner واجهة مسجل.
- Login ترسل `username/password/grant_type` دون `tenant_slug/email`. Signup تستدعي `/auth/register` المغلق. هذه مشكلة تكامل مؤكدة حتى مع نجاح Build.
- القرارات UI مبنية على `role_name`. تحميل البيانات العام قد يطلب Change APIs لأدوار Legacy لا تملك `changes.read`، ثم يفشل تهيئة الجلسة؛ يلزم فصل فشل مورد عن فشل الهوية.
- النصوص الإنجليزية Hardcoded، و`html lang="en"`، وتنسيقات `en-GB`، ودوال مختلفة للوقت المحلي وUTC مع Asia/Riyadh. لا نظام ترجمة أوRTL/Theme Tokens عام؛ لا دليل اختبار Accessibility أوMobile فعلي في هذه الجلسة.

### 2.2 Backend

- `backend/requirements.txt`: FastAPI **0.139.0**، Pydantic **2.13.4**، SQLAlchemy **2.0.51**، Alembic **1.18.5**، psycopg2-binary **2.9.12**، bcrypt **5.0.0**، python-jose **3.5.0**، pytest **9.1.1**. `requirements-dev.txt` تضيف httpx **0.28.1**. هذه إصدارات مصرح بها في الملفات، وليست نتيجة فحص Vulnerabilities.
- Routes كبيرة، وخدمات مستقلة للهوية والتفويض والدعوات وWindows Trust وRisk وChange State وNotifications. تحسين الحدود تدريجي، دون إعادة كتابة شاملة.
- `TenantContext` يتحقق من JWT `sub/tid/ver=2/exp` ومن User وOrganization وRole وDepartment وMembership داخل DB، ويعيد تحميل الحالة لكل طلب. Permissions ثابتة مشتقة من اسم DB Role المحلي.
- `tenant_resources.py` يطبق SQL Scope قبل Count/Pagination/Mutation، ويتحقق من طرفي Dependencies ومن العلاقات البنيوية المتداخلة. ليست حماية RLS على مستوى PostgreSQL، ولا إثباتًا لعزل جميع النصوص الحرة التاريخية.
- `settings.py`: يتطلب JWT Secret؛ الافتراضي Development وSQLite و`CREATE_TABLES_ON_STARTUP=true`. Production ترفض SQLite وStartup create_all ومفتاح JWT أقصر من 32 حرفًا. هذه حواجز جزئية تحتاج Hardening.
- CORS Origins من Settings، وCredentials مفعلة وMethods/Headers واسعة. `/health` يعيد حالة ثابتة دون اختبار DB؛ لا يعد Readiness Check.

### 2.3 Database وMigrations

- **20 جدولًا** في Metadata المسجلة الحالية: organizations، roles، departments، users، it_services، it_systems، system_dependencies، incidents، risk_rules، managed_change_requests، managed_change_affected_systems، managed_impact_assessments، change_status_history، audit_logs، change_approvals، change_implementations، notifications، user_administration_audit_logs، organization_invitations، tenant_access_events.
- `app/models/change_request.py` نموذج Legacy منفصل غير مستورد في تسجيل Models الحالية وغير موجود في سلسلة Initial Migration؛ لا Endpoint مسجلة له. وجوده في المصدر لا يثبت وجود جدوله أوبياناته في قاعدة مستخدمة.
- سلسلة Alembic: `54c5a5c8470d` → `a1_01_identity_expand` → `a1_02_identity_backfill` → `a1_03_identity_enforce`.
- A1 PostgreSQL-only، ترفض Offline SQL وDowngrade؛ Preflight وفحوص Fingerprints لحفظ 18 جدولًا تاريخيًا داخل المعاملات. Roles العامة القديمة محفوظة وتنسخ للمؤسسات، ومعيار البريد `(organization_id, lower(btrim(email)))`.
- Composite FKs تحمي سلسلة Identity وFoundation الأساسية والدعوات وAccess Events؛ بعض Change/Dependency/Notification relationships لا تزال FK بسيطة، وA4 تعزل العلاقات غير المتسقة في SQL دون محوها.
- أوقات تشغيل كثيرة UTC مخزنة دون Timezone، بينما Planned Times موصوفة في Model كقيم محلية للمؤسسة، وطوابع الدعوات Timezone-aware. يلزم قرار وقت وMigration مصرح عند الحاجة؛ لا تحويل جماعي صامت.
- توجد ملفات SQLite وBackups محلية متجاهلة في Git؛ **لم تُفتح أوتُفحص بياناتها**. حالة الترحيل الفعلية والبيانات والأحجام التشغيلية غير معروفة؛ لا نفترض تطبيق A1 عليها.

## 3. جرد الوظائف: الموجود والجزئي والغائب

«موجود» يعني كودًا وعقدًا في المستودع، وليس اعتماد Production. نتيجة التنفيذ الجديدة محصورة في القسم 10.

| الوظيفة | الحالة الفعلية والدليل | ما يلزم |
|---|---|---|
| Tenant Identity وMigrations A1 | منفذة؛ Models و3 Migrations واختبارات حفظ | تشغيل مصرح لاحقًا وخطة Cutover، لا إعادة بناء |
| Workspace Login وJWT v2 A2 | Backend موجود؛ `routes/auth.py` و`tenant_context.py` | تصحيح Frontend A5؛ Rate Limits وRevocation في D |
| `/auth/me` | يعيد الهوية و`role_name` وIDs؛ **لا يعيد Permissions أوWorkspace Slug** | Extension إضافية مقترحة في A5 بعد اعتمادها |
| Invitations A3 | Create/List/Revoke/Resend/Accept؛ Hash-only وSingle-use وExpiry وأقفال وAudit | UI A5؛ Delivery حقيقية لاحقًا؛ لا Password Reset |
| Guarded Bootstrap | CLI بموافقة Ed25519 وربط Deployment وOS identity | F2 وتشغيل مخول؛ غير معتمدة للاستخدام الفعلي |
| Permissions وIsolation A4 | Matrix مركزية وTenant SQL Scopes واختبارات متعددة الأدوار | حفظ السياسة وعدم توسيعها ضمن UI؛ B استثناء مؤكد |
| Projects | لا Model أوRoute مسجلة | تعريف معنى المشروع وعضويته ثم Backend جديدة؛ لا صفحة وهمية |
| Change Requests | Create/List/Paged/Details/Revision وAssessment محفوظة | صفحات Routes وإدارة أخطاء؛ Risk/CAB قبل الاعتماد الإنتاجي |
| State Machine | خدمة حقيقية بـ9 حالات وانتقالات و409 للمخالفات | Policy/Approval Gates وConcurrency في C؛ لا إعادة اختراعها |
| Risk Assessment | Sum لقواعد DB مع Thresholds 35/60/80 وحد أعلى 100 | B: عزل وVersioning وPrecedence وMissing Config |
| Risk Rules | GET/POST/PATCH عالمية؛ لا DELETE API | High مفتوحة؛ تصميم B يشمل حذفًا آمنًا/تعطيلًا موثقًا |
| CAB Approvals | Decision Rows وHistory وAudit موجودة؛ العميل يرسل `approval_level` | High: لا سلطة CAB مستقلة أوQuorum أوSoD أوقفل قرار كافٍ |
| Implementation | Start/Complete/Fail/Rollback/PIR وQueues موجودة | تعيد Start فحص Approved فقط؛ C يفرض دليل موافقة صالح ومعاملات آمنة |
| Catalog | Systems/Services/Departments/Users/Incidents/Dependencies وImpact Profile | Read APIs وبعض Create فقط؛ لا افتراض CRUD كاملة |
| Dependency Analysis | Direct Systems + Incoming Dependencies لمستوى واحد؛ Tenant Scoped | Traversal متعددة المستويات وCycles ومسارات وBounds في S5 |
| Interactive Graph | بيانات Nodes/Edges الأساسية متاحة؛ لا Graph UI تفاعلية | S6 بعد API تحليل واضحة وميزانية حجم |
| Gemini | لا Provider أوSDK أونداء Gemini في المصدر/Dependencies | `ai_explanation` الحالي Template؛ S5 تكامل حقيقي منفصل |
| Legacy AI/Report | `ai_engine/risk_engine.py` و`report_generator.py` قوالب وقواعد محلية غير مسجلة كـAPI | لا توصيلها تلقائيًا؛ تجنب مسارين مختلفين للحقيقة |
| Dashboards | Overview وReview/Delivery Queues حقيقية ومقيدة | Risk Counts/Mean تجمع **كل Assessments** لا آخر واحدة لكل Change؛ قرار Metric في S6 |
| Notifications | Paged/Search/Unread/Read one/Read-all؛ صلاحية المحتوى الحالية من A4 R1 | ترجمة الرسائل المنتجة على Backend دون إعادة كتابة التاريخ؛ لا GET single مستقلة |
| Reports | تفاصيل Assessment وPrint Styles و`window.print()` في UI | لا Export PDF API أوReport CRUD؛ S7 تقارير مفوضة بعربية وإنجليزية |
| Users & Roles | قوائم وRole Assignment وActive Status وAudit | لا Role Designer أوCustom Permissions CRUD؛ Last Admin Race مفتوحة |
| Organization Settings | قراءة المؤسسة عبر Foundation؛ لا Update Settings API | Policy وTimezone/Preferences وعقد Backend قبل صفحة إدارة |
| Profile & Preferences | `/auth/me` للقراءة؛ لا Profile/Password/Preferences Update API | تفضيلات محلية أولًا؛ حفظ عبر الأجهزة يحتاج Backend مصرحًا |
| Localization/Design System | CSS وResponsive جزئي موجودان؛ لا i18n أوObsidian & Sage System | A5 للصفحات المنقولة، واستكمال كل إضافة في مرحلتها |
| CI/CD/Production Operations | لا Workflows أوNetlify/Docker deployment config ضمن الملفات المتتبعة المفحوصة | S8/S9؛ لا ادعاء استضافة أوBackup أوMonitoring قائمة |

### 3.1 العقود التي تعتمدها A5 دون تخمين

- `POST /auth/login`: Form fields `tenant_slug`, `email`, `password`؛ النجاح `{access_token, token_type}`؛ فشل الاعتماد `401` عامة. لا تقص Password ولا تغيّر Email Normalization عن عقد A2.
- `GET /auth/me`: `id, organization_id, department_id, full_name, email, job_title, role_name, department_name`؛ `identity.read` لازمة.
- `POST /auth/register`: `403` دائمًا؛ إزالة واجهته دون إعادة فتحه.
- `POST /auth/invitations/accept`: JSON `token, password, full_name?`؛ الاسم لازم للحساب الجديد؛ نجاح `{user_id, organization_id, status:"activated"}` **دون JWT أوWorkspace Slug**. بعده Login صريح؛ رابط التسليم المخطط يجب أن يحمل Workspace غير سرية أوتُطلب من المستخدم.
- قبول الدعوة: `400` عامة للرمز غير المتاح/البنية غير الصحيحة؛ Password حدها 8 أحرف على الأقل و72 UTF-8 bytes كحد أقصى. لا UI توحي بأن 72 حرفًا تعادل 72 bytes.
- إدارة الدعوات `POST/GET /auth/invitations` و`POST /{id}/revoke|resend` تتطلب `invitations.manage`. لا الرموز الخام أوروابط الدعوة في الاستجابة الإدارية.
- `GET /change-management/requests/paged` وDetails وHistory وAudit وApprovals وImplementation الحالية مصادر صفحات التغيير. `GET /foundation/*` مصادر Catalog. لا إنشاء Endpoint وهمية للصفحات المستقبلية.
- حالات `401/403/404/409` متميزة: انتهاء/فشل هوية، منع صلاحية، مورد غير متاح، تعارض عملية. يظل Backend مسؤولًا عن قرارها النهائي.

### 3.2 سياسة الأدوار القائمة الواجب حفظها

- Requester: طلباته داخل المؤسسة؛ إنشاء ومراجعة بعد طلب معلومات.
- Change Manager: قراءة/موافقة/تنفيذ ضمن المؤسسة، مع قصور CAB الموثق.
- CMDB Manager: Foundation Write وChange Read وRisk Rules Write؛ الأخيرة عالمية حاليًا حتى B.
- System Administrator: إدارة Users/Audit/Invitations؛ **لا Change Read أوApprove أوCMDB Write ضمنية**.
- Legacy Admin/System Owner/Approver/Viewer: القراءات المشتركة المعتمدة فقط؛ لا ترقية ضمنية إلى أدوار الإدارة أوCAB. اسم دور مجهول Deny by Default.

## 4. Security Findings وسجل المخاطر الإلزامي

| ID | الخطر والدليل وحدود الادعاء | المرحلة/شرط الإغلاق |
|---|---|---|
| SEC-01 High | `RiskRule` بلا organization_id؛ GET/POST/PATCH وOverview و`get_rule_score` عالمية؛ اختبار `test_batch_b_finding_global_rule_mutation_is_still_shared_and_not_claimed_isolated` يصف التأثير بين مؤسستين | B؛ اختبارات PostgreSQL تثبت أن Mutation في A لا تغير Score/Count/Rules في B |
| SEC-02 High | `approval_level` نص عميل؛ القرار يحول Pending إلى Approved؛ Start يفحص Status فقط. اختبار `test_batch_c_finding_cab_label_is_not_independent_authorization` يثبت القصور | C؛ Critical لا تبدأ دون Policy ودليل CAB ونسخة صالحة، حتى عبر API مباشرة |
| SEC-03 F2 مفتوحة | Windows handle/ACL safeguards منفذة، لكن Positive Integration كاملة غير مثبتة | D/F2؛ Runner موثوقة وNative Positive + Reader غير إداري، دون تعديل ACL جهاز التطوير |
| SEC-04 Last Administrator Race | `auth.py` يعد المسؤولين ثم يغير User دون تسلسل ذري؛ منع Self-update لا يغلق السباق | D-T1؛ طلبان متداخلان لا يتركان المؤسسة دون Administrator، مع حفظ Audit |
| SEC-05 Rate Limiting | لا Limiter للمسارات الحساسة | D؛ Multi-worker-safe limits واختبار تجاوز واستعادة وProxy Trust |
| SEC-06 bcrypt Timing | تخفيف تكلفة 12 موجود؛ تكاليف Legacy أعلى 12 وفروق DB/الحمل باقية | D؛ ميزانية أداء وجرد مصرح للفئات وخطة تخفيف دون تغيير Hashes صامت؛ لا ادعاء Constant Time |
| SEC-07 Session Revocation | JWT 120 دقيقة افتراضيًا؛ إعادة فحص DB للدور/النشاط موجودة، ولا جلسة قابلة للإبطال أوRefresh/Logout Server | D؛ اختبارات إبطال وتدوير ومزامنة ومعالجة Password Change حسب السياسة المعتمدة |
| SEC-08 Real Email Delivery | Adapter الحالية تفشل صراحة؛ قد تبقى النتيجة pending بعد انقطاع | D-T3؛ Sandbox ثم تسليم حقيقي مصرح به، Fail/Retry/Duplicate/Late؛ لا ادعاء Exactly-Once |
| SEC-09 Bootstrap Operational Authorization | Signed Manifest وOS Policy موجودتان؛ لا اعتماد تشغيل حقيقي أوRecovery | تشغيل منفصل بعد F2/المفاتيح/DB grants/Delivery؛ موافقة صريحة لكل تفعيل |
| SEC-10 Full Production Security Review | لا Production Assessment أوLoad/Restore/Monitoring Evidence | S8/S9؛ Security Review وRunbooks وRecovery وأدلة البيئة قبل Release |
| AUD-01 Integrity | Missing Rule تعيد 0؛ قواعد متكررة لنفس condition قد تختارها `.first()` دون ترتيب أوUnique Key مناسب | B؛ Missing/Ambiguous Config تمنع Assessment موثوقة، وترتيب ثابت وRuleSet Snapshot |
| AUD-02 أدوات تشغيل Legacy | السلوك الخطر التاريخي: اختيار أول Organization وUser بالبريد عالميًا وإعادة إسناد المؤسسة/الدور/Password Hash، وSeed Foundation/Global Rules. **عُزل محليًا بتفويض منفصل**؛ Working Tree الحالية تتوقف على Import/CLI قبل Dependencies، ولا Helpers أوCredentials ثابتة | 24 اختبار عزل ناجح؛ لم تُشغّل النسخ الأصلية. مراجعة المستخدم والحفظ المصرح والتعبئة/التشغيل الفعلي ما زالت مطلوبة؛ HEAD والتاريخ والأرشيفات القديمة لم تُغيّر، ولا ادعاء غلق Exposure أوإطلاق D |
| AUD-03 مصدر النص | اسم `ai_explanation` يوحي بـAI بينما القيمة Template؛ Notifications وFactors نصوص English Backend | A5 وS5/S7؛ Provenance مرئية وStructured Codes، وعدم نسبة قوالب إلى Gemini |
| AUD-04 أداء وحدود | Lists غير مقسمة لبعض Catalogs؛ Risk traversal استعلامات داخل loops؛ Dashboard يحمل Assessments؛ حدود Description غير مكتملة | D/S5/S6/S8؛ Limits وQuery/Load budgets قبل اعتماد الأحجام |
| AUD-05 وقت ومقاييس | Mix بين UTC naive وOrg-local؛ Counts للمخاطر لكل Assessment؛ أحجام التشغيل غير مقاسة | قرار DEC-10/11 واختبارات قبل تحويل البيانات أوتغيير معنى المؤشر |
| PRE-01..05 — Security Preflight مانعة لاستئناف A5-T1 | عزل PRE-01 محفوظ في Working Tree؛ PRE-02/05 مثبتتان مستقلًا بـ19 موقع Gitleaks تاريخي/أرشيفي. GL-L01/02: JWT settings محلية بـgeneric-api-key؛ PRE-04 DB candidate لم تنتج Finding من defaults ولا تُعتبر False Positive. لا Production use أوCompromise مثبت | Scanner مستقلة اكتملت بالقسم 10 من [التقرير](phase2_a5_t1.md)؛ المتبقي اعتماد التصنيف والمالك/البيئة/الاستخدام/التعرض وأي معالجة لازمة. لا Rotation أوHistory Rewrite أوCommit أوإذن A5 تلقائي |

نجاح الاختبارين التوصيفيين لـB وC حاليًا يعني **إثبات استمرار الخلل**، لا إغلاقه. عند الإصلاح تُحوّل Assertions إلى ضمانات أمنية مع الاحتفاظ بدليل السلوك السابق في التوثيق.

## 5. القرارات المعمارية المقترحة واعتماديات المراحل

| القرار | المقترح والمبرر | الاعتماد |
|---|---|---|
| التطوير التدريجي | الإبقاء على FastAPI/SQLAlchemy وReact/Vite؛ استخراج Modules حسب Feature دون إعادة كتابة | اعتماد الخطة |
| Routing | React Router Browser Routing في SPA؛ Nested Layouts وLazy Pages. تقييم Declarative مقابل Data Mode في A5؛ يوصى Data Mode لحدود Route Loading/Errors. Hash Routing يغير شكل الروابط ويزاحم Fragment الدعوة؛ Custom Router يضيف عبء History/Guards | DEC-01؛ تثبيت نسخة متوافقة وقياس Bundle قبل الإضافة |
| Localization | i18next + React binding مرشح؛ ملفات محلية بلا خدمة ترجمة مدفوعة. قاموس يدوي أقل Dependencies لكنه يحتاج تنفيذ plurals/fallback/loading يدويًا؛ Intl وحده للتنسيق ولا يكفي لإدارة النصوص | DEC-01/10؛ لا إضافة مكتبات الآن |
| UI | CSS semantic tokens وFeature Components؛ لا اعتماد UI Suite كبيرة قبل فحص الحاجة والحجم؛ الخط العربي/اللاتيني محلي إن سمح الترخيص | A5 Design Gate |
| State وData | Auth Context لهوية واحدة؛ Page-local State وHooks وAPI client. Scope للـCache بمؤسسة/مستخدم/Permission generation وإفراغه عند Logout؛ لا إضافة Redux/Query library افتراضيًا | DEC-02؛ تقييم القياس أولًا |
| Auth Contract | إضافة `permissions: string[]` و`workspace_slug: string` إلى CurrentUserOutput من السياق الموثوق وDB؛ إبقاء الحقول الحالية | DEC-03؛ Backend صغيرة ضمن A5، دون Schema Migration |
| قواعد المخاطر | RuleSet منشور immutable لكل مؤسسة، وDraft قابل للتحرير؛ Assessments جديدة تحتفظ بإصدار القواعد وتفصيل العوامل | DEC-05؛ Expand/Backfill/Enforce معتمدة قبل Migration |
| CAB | توسيع State Service القائمة بخدمة Governance ومعاملات تقفل Change ثم Policy/Approval Rows بترتيب محدد؛ لا صلاحية من Label العميل | DEC-06/07؛ C بعد B |
| AI | واجهة Provider داخل Backend؛ Gemini تعطي Insights فقط بعد تحليل حتمي، مع Provenance وحالة فشل صريحة | DEC-08؛ S5 بعد B/C/D |
| التقارير | Snapshot مفوضة من نفس Change Scope؛ اختيار PDF engine بعد تجربة عربية/Fonts وقياس الذاكرة؛ Print موجودة لكنها ليست Export API | DEC-12؛ S7 |

مراجعة وثائق أولية بتاريخ 2026-11-01: [React Router modes](https://reactrouter.com/start/modes) و[Routing](https://reactrouter.com/start/declarative/routing) تدعمان اختيار نمط مناسب لـSPA؛ [i18next](https://www.i18next.com/) يدعم إدارة الترجمة بما فيها plurals/interpolation. اختيار النمط والحزم هنا **توصية هندسية** من فحص المشروع، وليست إثبات تكامل أوأداء. لا تثبيت أوترقية في Stage 0.

### 5.1 ترتيب التنفيذ والاعتماديات

```text
Stage 0 approval
  → Stage 1 A5 foundation + identity contract + real supported pages
  → Stage 2 B risk integrity + rule migration
  → Stage 3 C enforceable governance
  → Stage 4 D security + email adapter + F2 evidence gate
  → Stage 5 dependency analysis + Gemini advisory
  → Stage 6 interactive graph + real analytics
  → Stage 7 bilingual reports + complete deferred product pages + UX
  → Stage 8 integration/security/performance readiness
  → Stage 9 deployment preparation only
  → explicit staging/release authorizations outside this plan's execution grant
```

- A5 لا تحتاج تعديل Risk Schema أوCAB Policy لتصحيح Login والتنقل؛ تتوقف واجهات إدارة Risk/CAB التنفيذية الجديدة عند اعتماد B/C. لا توسع تشغيل المنصة لمؤسسات فعلية قبل إغلاق High Findings.
- A5 تنقل الصفحات المدعومة فعلًا، مع عرض تقييم Legacy بوصفه تقييمًا قائمًا ذا قيود معلنة إن لزم؛ لا تسمية CAB Enforced أوAI حقيقية. لا إصدار Low/Proceed جديدة بمعنى موثوق قبل B.
- C تعتمد على إصدار Risk يمكن ربطه بالموافقة؛ تعديل قواعد أوRevision Change يجب أن يملك سياسة Reapproval معتمدة.
- F2 تعتمد على Runner خارج جهاز التطوير. يمكن إعداد تصميمها دون تعطيل تحليل بقية الخطة؛ تبقى Bootstrap والإنتاج محجوبين إذا لم تتوفر الأدلة. لا تجاوز للبوابة لمجرد تقدم UI.
- S5 Traversal تغير معنى Impact؛ إن أثرت في Scoring أوApproval Thresholds، تمر عبر Versioning في B وReapproval في C، ولا تُدخل تغييرًا ضمنيًا للحساب.
- Projects وOrganization/Profile CRUD لا توضع كواجهات Placeholder؛ تنفذ كعقود Backend مستقلة ضمن S7 قبل عرض صفحاتها، أوتبقى مطلبًا غير مكتمل يمنع إعلان اكتمال المنتج.

## 6. قرارات تحتاج موافقة المستخدم

اعتماد الخطة لا يعني تلقائيًا اعتماد كل قرار حساس فيها. يثبت سجل القرار المعتمد وتاريخه ونطاقه قبل تنفيذ المهمة التابعة.

| ID | القرار المطلوب | التوصية المطروحة وحدّ التوقف |
|---|---|---|
| DEC-01 | اعتماد نطاق A5 والمكتبات Router/i18n/Test | React Router + i18next/React binding؛ Vitest/Testing Library وPlaywright/axe مرشحات للفحص والتثبيت المتوافق؛ لا إطار جديد شامل |
| DEC-02 | Session persistence وRemember me | SessionStorage مؤقتًا لاستعادة Refresh بنفس التبويب، والرمز بالذاكرة أثناء التشغيل؛ إزالة localStorage القديمة وإجبار Login جديد. D تصمم HttpOnly/Refresh إن اعتمدت؛ Memory-only لا تستعيد Refresh، وBrowser Storage معرض لـXSS |
| DEC-03 | `/auth/me` extension | Permissions وworkspace_slug من Backend، دون نسخ Matrix سلطوية للواجهة. لا Grant جديد |
| DEC-04 | مسار رابط الدعوة والتعافي | `/accept-invitation#token=...` مع Workspace غير سرية؛ إزالة Fragment قبل التحليلات/التحميل الخارجي، والرمز Memory فقط. Refresh بعدها يطلب فتح الرابط الأصلي مجددًا؛ لا Token في Query أوLogs |
| DEC-05 | Risk Default Strategy وMissing/Ambiguous Configuration | نسخ Legacy Rules إلى RuleSet لكل مؤسسة بعد تقرير تعارضات؛ لا fallback عالمي. Missing Config تمنع Create/Revise Assessment بـ409 ورمز خطأ ثابت دون كتابة جزئية؛ بديل قبول Change غير مقيمة يحتاج Status/Schema معتمدة منفصلة |
| DEC-06 | CAB Authority/Quorum/SoD | تحديد أدوار CAB ومن يعيّنها، عدد الموافقات وVeto/Abstain والتفويض وحظر موافقة مقدم الطلب/المنفذ على نفسه وسياسة Emergency. لا نفترض أن Change Manager أوApprover Legacy هو CAB |
| DEC-07 | Reassessment وReapproval وLegacy Approved | ربط الموافقة بـChange Revision وRisk RuleSet/Assessment؛ لا إنشاء دليل CAB تاريخي مختلق. اعتماد طريقة التعامل مع Approved قديمة وPolicy Changes قبل تنفيذها |
| DEC-08 | Gemini model/data/cost | تحديد الموديل والمنطقة والميزانية والحصة والبيانات المسموحة والاحتفاظ والموافقة على خروجها؛ لا نداء مدفوع أوحقيقي قبل الإذن |
| DEC-09 | Email provider وretry/durable token strategy | Adapter الحالية تبقى Fail Closed؛ لا تخزين Raw Tokens لإعادة المحاولة. أي Outbox/تشفير أوإعادة إصدار تلقائية يحتاج تصميم مفاتيح وموافقة؛ لا Exactly-Once |
| DEC-10 | Locale default/Calendar/Digits/Timezone | ar-SA افتراضي مقترح، مع switch إلى en؛ اختيار Gregorian/Hijri وشكل الأرقام وOrganization timezone قبل تثبيت Intl Options. لا تحويل Legacy Planned Times بتخمين |
| DEC-11 | Analytics semantics وحجم التشغيل | Distribution حسب آخر Assessment صالحة لكل Change، وUnknown منفصلة؛ تحديد المستخدمين والأنظمة والحواف/مؤسسة وSLO قبل Load Gate |
| DEC-12 | Projects وOrg Settings وProfile/Report access | تعريف Project ownership/membership/link to Change وصلاحيات Reports وSettings وحقول Profile؛ لا توسيع صلاحيات System Administrator تلقائيًا |
| DEC-13 | Session/Password security business policy | TTL وRevocation وRefresh/rotation وPassword Recovery وLockout/Rate Limits ومتطلبات MFA/SSO إن أريدت؛ لا ندعي وجود MFA/SSO/Billing الآن |
| DEC-14 | F2 Runner وتجهيزها | VM Windows موثوقة مسبقًا واختبار Reader عادي؛ لا طلب تغيير ACL الجذر أوالمجلدات على هذا الجهاز |
| DEC-15 | Hosting/data residency/operations | Netlify للواجهة هدف معتمد، مع استضافة FastAPI وManaged PostgreSQL تُقارن لاحقًا وفق المنطقة/التكلفة/Backup/RPO/RTO؛ لا مزود مدفوع مختار الآن |
| DEC-16 | كل Migration حساسة وCheckpoint/تشغيل خارجي | اعتماد تصميم البيانات أولًا، ثم إذن منفصل للتطبيق على بيئة محددة؛ Commit/Push/PR/Deployment/بريد/Bootstrap ليست مشمولة بموافقة تنفيذ برمجية عامة |

**سجل الاعتماد اللاحق — 2026-11-01:** اعتمد المستخدم DEC-01/02/03/04/10 وحدود DEC-16 وأذن بـA5-T1 فقط بشرط Preflight. القرارات الصريحة: React Router Data Mode عند مرحلة Routing، وAuth Context/حالة محلية بدل Redux، وSessionStorage مؤقتة للتطوير، و`/auth/me` مصدر Permissions/Workspace، وInvitation Fragment/Memory عند A5-T2، وar-SA افتراضية/en اختيارية، وGregorian/24-hour/Asia-Riyadh عندما يكون معنى Timestamp محددًا، وهوية Obsidian & Sage، وفصل إذن الكود عن Git/Deployment. لا تنفيذ مبكر للقرارات التابعة لـT2/T3/T4، ولا تغيير تلقائي للمخاطر/السياسات المؤجلة. Preflight أوقفت التنفيذ أولًا؛ أجيز T1 لاحقًا فقط بعد عزل اصطناعي مثبت كما في 10.7. لا يشمل ذلك قواعد قديمة أوتقاعد Demo أوT2. بقية DEC-05..15 غير المذكورة ضمن الاعتماد الصريح تبقى لبواباتها.

## 7. خطة التنفيذ المرحلية وQuality Gates

الملفات المسماة «إنشاء» أدناه **مقترحة وليست موجودة الآن**. تعكس أسماء العقود المستقبلية تصميمًا للمراجعة، ولا تغير API الحالية. كل مرحلة تُحدّث هذا الملف بنتائجها ومخاطرها قبل طلب الاعتماد. تكتب Regression للسلوك الجديد أولًا، وتثبت فشلها للسبب الصحيح، ثم تنفذ أقل تعديل يحقق العقد وتعيد الفحوص. لا Commit تلقائي في أي Task.

كل إضافة Models أوRoutes تشمل تسجيلها صراحة في `backend/app/main.py` و`backend/migrations/env.py` وFixtures اللازمة حسب الحاجة، مع اختبار جرد Endpoints وMetadata وMigration Contracts؛ وجود ملف مصدر وحده لا يجعل الميزة متاحة.

### Stage 0 — Planning & Architecture — اعتمد الاتجاه؛ أجيزت A5-T1 بشرط Preflight

- [x] التحقق من Remote/Branch/HEAD وWorking Tree قبل التعديل.
- [x] قراءة A1–A4 ومراجعة Routes/Models/Migrations/Frontend/Tests الفعلية.
- [x] توثيق Inventory والفجوات والقرارات والاعتماديات والمخاطر ونتائج الفحوص المحدودة.
- [x] إنشاء Master Plan في المسار المطلوب دون تنفيذ Features.
- [x] مراجعة المستخدم واعتماد اتجاه الخطة وقرارات ونطاق A5-T1 فقط، مع Security Preflight إلزامية؛ لا اعتماد تنفيذ كامل A5.
- [ ] Git Checkpoint فقط إذا صدر إذن محدد بعد المراجعة؛ لا يُفترض من اعتماد الخطة.

**Gate:** ملف واحد مقصود، لا تغيير API/DB/أسرار، وGit على خط الأساس. الخطر: قراءة الاختبارات التاريخية كأنها أُعيدت الآن؛ يعالج الفصل في سجل القسم 10.

### Stage 1 — A5 Frontend Foundation

**الدخول:** اعتماد Stage 0 وقرارات A5. **الخروج:** صفحات حقيقية مدعومة، Login/Invitations متوافقة، Design System ولغتان وResponsive مثبتة. B/C/D تبقى معلنة غير مكتملة.

**الحالة الحالية:** A5-T1 محفوظة باعتماد صريح. نُفذت A5-T2 محليًا بعد اجتياز Isolation Gate مجددًا، وتنتظر مراجعة Development Checkpoint. لا انتقال إلى T3/T4 أوحفظ Git دون موافقة جديدة. أدلة T1 تاريخية في [تقريرها](phase2_a5_t1.md)، وأدلة التنفيذ الحالي في [تقرير T2](phase2_a5_t2.md).

عزل Setup اللاحق إصلاح أمني مستقل مصرح به فقط؛ لا ينفذ API Client أو`/auth/me` ولا يعيد فتح Gate A5-T1 تلقائيًا.

#### A5-T1 — عقد الهوية وAPI Client

**Files الفعلية لـT1:** تعديل `backend/app/schemas/auth.py` و`backend/app/routes/auth.py`؛ إضافة `backend/tests/test_a5_identity.py` و`test_a5_isolation_gate.py` و`a5_isolation.py` و`a5_isolated_runner.py` و`test_a5_runner_configuration.py`، وتعديل test conftest/Native fixture فقط. إنشاء `frontend/src/types/api.ts` و`src/services/api/{client,config,errors,session}.ts` و`src/features/auth/authApi.ts` و`frontend/tests/api.test.ts` وRunner/tsconfig للتحقق، وإضافة test/verify scripts إلى package.json. لا تعديل App.tsx أوModels/Migrations.

**Interfaces المقترحة:**

- Backend `CurrentUserOutput.permissions: list[str]` و`workspace_slug: str` من DB/Context، مع الحقول القائمة دون تغيير. لا DB Migration.
- `login(input: {tenant_slug: string; email: string; password: string}, signal?: AbortSignal): Promise<TokenOutput>`؛ Form بالقيم المعتمدة وبدون username.
- `request<T>(path: string, options?: RequestInit): Promise<T>`؛ ApiError تحمل status وcode الآمنة، دون Credential Input أوتخزين تفاصيل Validation الحساسة.

- [x] اختبارات عقد Login tenant_slug/email/password، وJWT v2/Claims وPermissions الحالية من DB لا JWT/Client؛ A1/A2/A4 regressions ضمن Runner معزولة.
- [x] إثبات RED لعقد Permissions ثم إضافة permissions/workspace_slug مع حفظ جميع الحقول السابقة؛ لا تغيير Matrix أوJWT أوDatabase schema.
- [x] إنشاء Services/Client مع Abort/Timeout وOrigin allowlist وGeneration و401 invalidation/cleanup boundary؛ 403/404/409 مستقلة ولا retries تلقائية. ربط الجلسة/البيانات الفعلية في UI مؤجل صراحة إلى T2، ولا ادعاء انتقال استدعاءات App.tsx الآن.
- [x] تحقق HTTP/PostgreSQL مؤقتة: إعادة Identity+Gate **15 passed**، منها 13 حالة PostgreSQL و2 guard/settings؛ Frontend **13 passed**. لا Browser E2E أوProduction claim.

**Assertions المطلوبة:** Login يرسل `tenant_slug/email/password` فقط؛ تغيير دور DB يغير grants في الطلب التالي؛ System Administrator لا تظهر له `changes.approve`؛ Header Tenant لا يغير Scope؛ 401 تزيل الجلسة والـCache، و403 تعرض منعًا.

#### A5-T2 — Session وWorkspace Login وInvitation Acceptance

**Files الفعلية:** تعديل `frontend/src/App.tsx` تدريجيًا وmain/index وauthApi/types/verify؛ إضافة AuthContext/AuthProvider/useAuth/AuthRoot وauthStore/sessionStorage/runtime/safeRedirect/permissions/workspaceGateway/invitationFlow وCSS محدودة، وصفحتي WorkspaceLoginPage/InvitationAcceptancePage. الاختبارات الفعلية `frontend/tests/auth.test.ts` و`invitation.test.ts` و`frontend/e2e/auth.mjs` و`backend/tests/test_a5_t2_browser.py`، مع توسيع Runner واختبار أمان مخرجاتها. لا Dependencies جديدة؛ Manifest كاملة في تقرير T2.

**Interfaces الفعلية:** AuthSnapshot بحالات checking/authenticated/anonymous/unavailable/forbidden، وUser موثقة وgeneration/binding؛ login/recover/logout محلية فوق Client T1. safeReturnTo لا تسمح إلا بالـWorkspace الافتراضية؛ Invitation accept ترسل JSON إلى A3 دون Auto-login. Minimal history routes للدخول/Workspace/قبول الدعوة فقط، إلى حين Router Data Mode في T3. لا Server Revocation قبل D.

- [x] استعادة Session عبر `/auth/me` وDEC-02، دون هوية من JWT decoding؛ network failures تحتفظ بمرشحة مخفية، و401/expiry تمسح الجلسة.
- [x] إزالة Signup؛ Login بثلاثة مدخلات وForm Content-Type الفعلية ورسالة فشل عامة. الترجمة الشاملة في T3؛ النص الحالي English مثل الواجهة القائمة.
- [x] Fragment تلتقط وتزال قبل React mount؛ Memory-only وReferrer Policy no-referrer، دون query token أوlogs/storage.
- [x] قبول الدعوة JSON وفق A3، ثم Login صريح؛ لا Auto-login أوToken output مختلقة.
- [x] Backend regression تغطي Replay/Expired/Revoke/Resend/Directory activation؛ Frontend Unicode وRefresh وgeneric unavailable، وBrowser accept/replay فعلية.
- [x] Logout أثناء طلب بطيء وSession switching وScoped gateway وkeyed shell تمنع استجابات/بيانات المؤسسة السابقة.
- [x] Safe redirect ثابتة إلى Workspace مسموحة؛ URL مطلقة و//host وencoded/next لا تغير الوجهة، واختبار Browser يثبت تجاهل external next.

#### A5-T3 — Design System وLocalization وRouting Shell

**Files:** تعديل `frontend/src/main.tsx` و`App.tsx` و`index.css` و`App.css` و`frontend/index.html` و`package.json` و`package-lock.json`؛ إنشاء `frontend/src/app/router.tsx` و`AppProviders.tsx` و`ErrorBoundary.tsx`؛ `frontend/src/layouts/AppLayout.tsx`؛ `frontend/src/components/navigation/{Sidebar,MobileNavigation,Breadcrumbs}.tsx`؛ `frontend/src/components/ui/`؛ `frontend/src/styles/{tokens,global}.css`؛ `frontend/src/localization/{index,formatters}.ts` و`locales/{ar-SA,en}.json`؛ الاختبارات الفعلية `frontend/tests/presentation.test.ts` و`frontend/e2e/presentation.mjs` و`backend/tests/test_a5_t3_browser.py`؛ القائمة الكاملة في تقريرT3.

**Interfaces:** `can(user: CurrentUser, permission: string): boolean` في `frontend/src/features/auth/permissions.ts`؛ `formatDateTime(value: string, kind: "utc" | "organization-local", locale: "ar-SA" | "en"): string` وفق قرار Timezone؛ Route metadata تحمل permission/key الخاصة بالعنوان لا نصوص UI Hardcoded.

- [x] تثبيت الخيارات المعتمدة فقط بعد فحص React/Node/TypeScript compatibility وLicenses/Bundle؛ اعتماد Lockfile. لا ترقية عشوائية لبقية Dependencies.
- [x] تعريف Semantic Tokens للألوان/Typography/Spacing/Focus، وLight/Dark منفصلين، وRisk Critical/High/Medium/Low مع نص وأيقونة، لا لون فقط.
- [x] بناء Buttons/Inputs/Forms/Cards/Tables/Dialogs/Badges/Toasts/Navigation/Loading/Empty/Error مع حالات Keyboard/Screen Reader؛ Dialog focus trap وعودة التركيز وEscape.
- [x] ضبط `lang` و`dir` على الجذر، ومفاتيح ترجمة لكل نص/Validation/ARIA/Toast؛ CSS logical properties، وعدم قلب الرموز غير الاتجاهية.
- [x] تصميم Sidebar Desktop وMobile Drawer واضحة وTouch Targets مريحة؛ Breakpoints تُختبر عند 360/390 و768 و1366 و1440، دون Overflow غير مقصود.
- [x] تطبيق Lazy Loading وError Boundaries وSkeletons وTransitions محدودة تدعم reduced motion؛ عدم تحميل كل موارد التطبيق بمجرد المصادقة.
- [x] اختبارات Back/Forward/Deep Link/Refresh/404/403 والتركيز بعد التنقل، واللغتين مع Theme Switch وحفظ Preference. في A5 يثبت fallback محلي للاستضافة الثابتة؛ S9 يجهز إعداد Netlify قبل النشر.
- [x] اختبار أسماء عربية طويلة وEmail/IDs مختلطة الاتجاه وPlural/Zero/Numbers والتواريخ غير الصالحة. لا تترجم بيانات المستخدم أوAPI enums في النقل.

**حدود الإغلاق:** Business tabs وترجمة/فصل الميزات القديمة إلىT4. لاادعاء Screen Reader audit أوWCAG شامل أوMulti-browser QA؛ Incomplete التباين موثق بقياس مستقل. لاBackend APIs أوModels/Migrations أوJWT/Matrix policy changes.

#### A5-T4 — نقل الصفحات المدعومة تدريجيًا

**الاعتماد الحالي T4-A فقط؛ الدفعات T4-B/C/D/E غير معتمدة للتنفيذ.** الجرد والعقود وخطة Feature modules و resource lifecycle والـ Quality Gates مفصلة في [phase2_a5_t4.md](phase2_a5_t4.md). لا Feature page انتقلت بعد، ولا Shared abstraction غيرمستهلكة؛ Layer النقل والجلسة الحالية معاد استخدامها. إزالة Legacy Adapter لا تجوز قبل إثبات Function parity أوتقاعد معتمد للوظائف المتعذرة بسبب B/C/D. Browser Regression تحتاجحسمًا قبل الدفعة التالية.

**Files:** إنشاء `frontend/src/pages/{Dashboard,Changes,ChangeDetails,Systems,SystemDetails,Notifications,Users}Page.tsx`؛ مجلدات `frontend/src/features/{changes,systems,notifications,users}/` بـAPI/Types/Hooks/Components؛ اختبارات Feature و`frontend/e2e/supported-pages.spec.ts`. تقليص App.tsx وCSS القديمة فقط بعد نقل السلوك والتحقق منه.

| Route مقترحة | المصدر الفعلي والحد |
|---|---|
| `/login` و`/invitations/accept` | A2/A3، دون Registration |
| `/dashboard` | Change overview/queues لمن يملك changes.read؛ إدارة Users لمن يملكها؛ لا Change Dashboard لمسؤول لا يملك Permission |
| `/changes` و`/changes/new` و`/changes/:id` و`/changes/:id/revise` | Paged/Details/Create/Revision/History/Audit الحالية، مع ملكية Requester |
| `/systems` و`/systems/:id` | Catalog/Dependencies/Incidents/Impact Profile، لا Graph متقدمة قبل S6 |
| `/notifications` | APIs A4 R1 وقيد قراءة المورد الحالي |
| `/users` و`/users/invitations` | User administration وA3 مع Permissions المناسبة؛ لا Role Designer |
| Presentation preferences الحالية داخلShell | لغة/Theme محليتان؛ لاRoute جديدة أوحفظProfile وهمي فيT4-A |

- [ ] نقل كل Feature مع اختبارات سلوك وLoading/Error/Empty منفصلة؛ Page failure لا تسقط بقية التطبيق أوالهوية.
- [ ] حفظ Search/Filters/Page في URL حيث يلزم، وCancel لطلبات تغير المرشحات ومنع نتائج قديمة من الكتابة فوق الجديدة.
- [ ] الحفاظ على قراءة التفاصيل/History/PIR الموجودة مع عرض الحدود الصريح؛ لا إطلاق CAB جديدة قبل C أوRisk Rule editor مؤسسية قبل B.
- [ ] فصل deterministic explanations الحالية عن AI في نصوص UI؛ اسم الحقل القديم لا يغير provenance.
- [ ] إزالة تحذيرات Hooks بطريقة تضبط dependencies/closures فعليًا، دون Suppression أوحلقات Fetch أوتعطيل StrictMode.
- [ ] تنفيذ Component + E2E محلية على Backend وقاعدة مؤقتة معزولة، تشمل كل دور ودخول Workspace A/B. لا Bootstrap تشغيلية لإعداد الحسابات.

**A5 Gate:** tsc/build/lint بلا أخطاء أوتحذيرات Hooks جديدة، Tests عقود Login وInvitations وPermissions ناجحة، وE2E Deep Links/History/Expired Session/403، وفحص اللغتين وMobile/Keyboard/AA للصفحات المنقولة. تسجل أحجام Initial/Lazy chunks؛ لا يُقبل تحسن شكلي مع Regression أوإعادة Registration. **المخاطر:** Session storage وToken leak وترجمة جزئية وطلب APIs ممنوعة وخلط UTC/local. **الموافقة:** تقرير وDiff واعتماد المستخدم قبل الحفظ أوB.

### Stage 2 — Batch B: Tenant-Scoped Risk Rules & Risk Integrity

#### B-T1 — تصميم البيانات وExpand/Backfill/Enforce

**Files:** تعديل `backend/app/models/foundation.py` و`schemas/foundation.py` و`routes/foundation.py`؛ إنشاء `backend/app/models/risk_policy.py` و`backend/app/services/risk_rules.py` و`backend/migrations/risk_rules_b.py` و3 Revisions تالية لـA1، و`backend/docs/phase2_b.md`؛ Tests `backend/tests/test_b_migrations.py` و`test_b_risk_isolation.py`.

**تصميم للموافقة DEC-05:** RiskRuleSet تحتوي Organization/Version/Publication State؛ Rules المنشورة immutable. إضافة Organization وRuleSet وLegacy source references للقواعد المنسوخة؛ صفوف Legacy الأصلية ومحتواها محفوظة وغير مؤهلة للاستعمال runtime. لا Global Fallback عند غياب إعداد مؤسسة.

- [ ] **Audit/Design قبل DDL:** احصر Global rules وcondition duplicates/missing keys/inactive rules وLegacy assessment references على Fixture ممثلة؛ على قاعدة فعلية يحتاج ذلك تفويضًا مستقلًا. اعرض Mapping وReport Counts دون أسرار؛ أي تعارض يوقف Backfill بدل `.first()`.
- [ ] **Expand بعد موافقة حساسية Schema:** إضافة جداول Versioning/أعمدة nullable/Composite targets دون تعديل أوحذف Legacy Rules. تثبيت نسخة التطبيق المتوافقة ونافذة منع الكتابة وخطة Locks؛ لا افتراض Rolling Compatibility.
- [ ] **Backfill:** التقاط Fingerprints، وإنشاء baseline مستقل لكل مؤسسة بعد اعتماد Mapping؛ نسخ القيم وsource IDs دون إعادة حساب أوتغيير Assessments التاريخية. أي تعارض/فقد بيانات يؤدي إلى Transaction rollback.
- [ ] **Enforce:** Composite Tenant FKs وUnique active published set per tenant، وUnique condition key داخل الإصدار، وChecks تفصل Legacy rows عن القواعد المملوكة؛ استبدال global name uniqueness دون ضياع ضمان uniqueness للسجلات القديمة. runtime تستعلم Scope مؤسسية فقط.
- [ ] اختبار Expand/Backfill/Enforce وفشل كل خطوة وحفظ جميع السجلات القديمة، ورفض External DB وDowngrade المدمرة. قبل نجاح Cutover: Transaction rollback؛ بعده Forward Repair معتمد أوRestore مخطط يحمي الكتابات اللاحقة.

#### B-T2 — محرك حتمي وعقد القواعد

**Files:** تعديل `backend/app/services/foundation_risk_engine.py` و`backend/app/routes/change_management.py` و`backend/app/models/change_management.py` وSchemas Assessment؛ إنشاء `backend/tests/test_b_risk_scoring.py` و`test_b_risk_atomicity.py`؛ واجهة `frontend/src/features/risk/` بعد اعتماد API.

**Interfaces المقترحة:** `resolve_rule_score(db: Session, organization_id: int, ruleset_id: int, condition_type: str, condition_value: str) -> RuleContribution`؛ `RuleContribution` تشمل rule ID/version/condition/score. لا قيمة صفر بديلة لRule مفقودة؛ Rule صفر صريحة معتمدة تبقى صحيحة. `RiskConfigurationError` تنقل كـ409 code `risk_configuration_required` دون Partial Writes، وفق DEC-05.

- [ ] اختبار تعديل/create/update/delete rule بمؤسسة A لا يغير Score أوRule Lists/Count أوAssessments بمؤسسة B؛ Foreign IDs تعيد رفضًا مماثلًا للغائبة.
- [ ] تنفيذ precedence: Published RuleSet المؤسسة فقط؛ Draft لا تؤثر، Legacy لا تؤثر، وتعارض Published/Key يفشل مغلقًا. لا newest `.first()` غير حتمي.
- [ ] حفظ inputs وruleset version وfactor contributions وalgorithm version وraw/capped score في Assessment جديدة؛ ترتيب ثابت للمدخلات/العوامل، وحد 100 وحدود 35/60/80 محفوظة ما لم يعتمد تغييرها.
- [ ] تعريف Scope الحذف: حذف Draft غير مستخدمة فقط أوRetire/Deactivate مع History؛ Published أوRules referenced لا تُمحى. لا DELETE عامة دون عقد وأذونات واختبارات معتمدة.
- [ ] اختبارات Missing/Inactive/Ambiguous و0 الصريحة وOrder Invariance وThreshold boundaries وConcurrent publication، ومقارنة البيانات بعد الرفض. تعديل A4 characterization لتثبت الإصلاح دون تعطيلها.

**B Gate:** PostgreSQL متعددة المؤسسات + Migration Preservation + Determinism/Failure/Concurrency، وSecurity Review للقوائم/Counts/Scoring/Mutation. لا Low/Proceed مع Missing Config، ولا غلق SEC-01 دون Assertions للScore الفعلية. **المخاطر:** Global rules legacy ملتبسة، اختيار Defaults أوتغيير نتيجة تاريخية، lock duration. **التوقف:** Schema design وDefault Strategy والتطبيق على أي DB فعلية تحتاج موافقة صريحة.

### Stage 3 — Batch C: CAB & Change Governance

#### C-T1 — اعتماد السياسة وState Machine الموسعة

**Files:** تعديل `backend/app/services/change_state_service.py` و`models/change_management.py` وSchemas/Routes approvals؛ إنشاء `backend/app/models/governance.py` و`backend/app/services/governance_service.py` و`backend/docs/phase2_c.md` وRevisions Expand/Backfill/Enforce بعد تصميم معتمد؛ `backend/tests/test_c_governance_policy.py` و`test_c_legacy_approval_migration.py`.

- [ ] اعتماد DEC-06/07: Policy matrix حسب Risk/Change Mode، سلطة CAB وQuorum/SoD/Rejected/Revision/Emergency/Delegation ووقت صلاحية Evidence.
- [ ] توثيق جدول كل Transition بـActor permission/policy preconditions/required evidence/audit/notification؛ تبقى الحالات الحالية ما لم يعتمد تغييرها صراحة.
- [ ] تمثيل Change Revision وApproval Policy version وAssessment ID/Ruleset ومجموعة القرار في Snapshot قابلة للتدقيق؛ لا تحويل Label تاريخية إلى CAB Evidence معتمدة.
- [ ] سياسة Legacy Approved/Unowned Requester تعرض للمستخدم؛ لا موافقات تلقائية أوحذف قرارات قديمة.

#### C-T2 — Enforcement وConcurrency

**Files:** تعديل `backend/app/routes/change_management.py` و`change_execution.py` و`notification_service.py`؛ إنشاء `backend/tests/test_c_approval_enforcement.py` و`test_c_concurrency.py` و`test_c_atomicity.py`؛ `frontend/src/features/governance/` و`frontend/src/pages/ApprovalsPage.tsx` و`ImplementationPage.tsx` بعد اعتماد العقود.

**Interface المقترحة:** `record_approval(db: Session, actor: TenantContext, change_id: int, expected_revision: int, decision: ApprovalDecision) -> ApprovalOutcome`؛ `authorize_implementation_start(db: Session, actor: TenantContext, change_id: int, expected_revision: int) -> GovernanceEvidence`. لا تستقبل سلطة CAB من `approval_level`.

- [ ] اختبارات Critical عبر HTTP مباشرة: Manager وحده لا يكفي حين تتطلب Policy CAB؛ تغيير Label أوRole/Tenant payload لا يمنح سلطة؛ منع Self approval وفق السياسة.
- [ ] تنفيذ Decision وStatus وAudit وNotification ذرية؛ إعادة قراءة Authority بعد القفل، وترتيب Locks متوافق مع A3 Role/User/Organization لمنع Deadlocks جديدة.
- [ ] Start تعيد التحقق من Revision وAssessment/Policy Evidence لا Status فقط؛ Revision/RuleSet updates تُبطل أوتطلب Reapproval وفق القرار المعتمد.
- [ ] معاملات PostgreSQL متداخلة بحواجز انتظار فعلية: approve/approve وapprove/reject وrevise/approve وstart/start وrevoke-authority/start وpolicy-update/approve؛ لا duplicate decisions أوتنفيذ بلا دليل.
- [ ] حقن فشل Audit/DB يرد المعاملة كاملةً؛ اختبارات Foreign tenant/Requester ownership والتاريخ محفوظ. لا Background task لتنفيذ تغيير تقني حقيقي ضمن Tracker.

**C Gate:** لا Critical implementation بلا CAB فعلية، وSoD/Revision/Concurrency/Atomicity مثبتة بDB النهائية لا HTTP status فقط. **المخاطر:** سياسة أعمال غير معتمدة وEvidence قديمة وتداخل الأقفال. Last Administrator Race تقع في D كأول Task قبل توسيع إدارة Users؛ لا تختلط بإثبات CAB. **الموافقة:** Policy والـMigration ونتائج المرحلة قبل Checkpoint.

### Stage 4 — Batch D: Security Hardening & Invitations Operations

#### D-T1 — Identity races وSession/Token lifecycle

**Files:** `backend/app/routes/auth.py` و`services/{auth_service,tenant_context,invitation_service}.py` و`settings.py`؛ إنشاء `backend/app/services/session_service.py` و`backend/app/models/auth_session.py` وRevisions بعد DEC-13؛ Tests `backend/tests/test_d_last_admin_concurrency.py` و`test_d_sessions.py`، وإعادة استخدام `backend/tests/test_legacy_setup_disabled.py` الموجودة من الإصلاح المحدود بدل تكرارها؛ Legacy Setup معطلة في Working Tree ولا يعاد تفعيلها أوتشغيلها على بيانات قائمة.

- [ ] إصلاح Last Admin بقفل تسلسلي داخل المؤسسة وإعادة Count/Authority تحت القفل؛ اختبار Cross-deactivate/Role-demote المتزامن مع A3 grant changes؛ يلزم بقاء مسؤول فعلي واحد على الأقل.
- [x] عزل Legacy Setup محليًا بتفويض Credential Safety Remediation المستقل: توقف Import/CLI قبل Dependencies دون Flags أووظائف كتابة، و24 اختبارًا معزولًا. هذا إنجاز تمهيدي محدود، وليس بدء Batch D أوإغلاق بقية Gate D؛ مراجعة التعبئة/التشغيل وحالة Credentials التاريخية لا تزال مطلوبة.
- [ ] تنفيذ سياسة Revocation/Session version أوjti registry وفق DEC-13، وLogout Server وRefresh إن اعتمدت؛ تحديد التعامل مع JWT v2 الحالية وKey rotation دون قبول خوارزميات عشوائية.
- [ ] اختبارات Password change/deactivation/role-change/revocation/reuse/concurrency؛ تبقى Legacy hashes محفوظة ما لم تعتمد خطة ترقية منفصلة.

#### D-T2 — حدود التشغيل وF2

**Files:** `backend/app/main.py` و`settings.py` و`services/windows_trust_policy.py` عند حاجة مثبتة؛ إنشاء `backend/app/middleware/` و`backend/docs/security_operations.md` وTests `test_d_rate_limits.py` و`test_d_redaction.py` و`test_d_headers.py`؛ تجهيز CI لاحقًا في S8.

- [ ] Rate Limits لـLogin/Accept/Create/Resend/Bootstrap-boundaries الحساسة، وفق Tenant/IP/account privacy، مع trusted proxy config وMulti-worker backend إذا تطلبها النشر؛ لا in-memory limiter على أنها موزعة.
- [ ] مراجعة bcrypt المتبقية ببيانات اصطناعية وLoad budget؛ حصر legacy cost inventory على تقرير مجمع مصرح، دون استخراج Hashes أوخفض تكلفتها ضمنيًا.
- [ ] Request/body/pagination/resource/query limits وDB/provider timeouts، وCORS allowlist وSecurity Headers وredaction وsafe errors وsecret lifecycle وaudit retention/monitoring/alert runbooks. لا logs تحتوي Password/JWT/InvitationToken/AI prompt حساسة.
- [ ] Dependency audit وLicense review باستخدام معلومات Advisories حديثة عند التنفيذ؛ الفصل بين Dependency pinning وإثبات خلو Vulnerabilities.
- [ ] **F2:** تجهيز Windows VM مستقلة موثوقة مسبقًا؛ Native Positive test الحالية مع opt-in وعلى fixture-owned objects فقط، ثم قراءة Policy اصطناعية بحساب Reader عادي وNative handles نفسها. negative tests تصل للعنصر المقصود بدل النجاح لمجرد رفض ancestor مبكر.
- [ ] لا تخفيف ACL checks ولا تغيير جذر C/ProgramData/مجلد المستخدم/OneDrive على جهاز التطوير. إذا غابت Runner تسجل Not run/Blocked evidence؛ **F2 لا تغلق وBootstrap لا تستخدم فعليًا**.
- [ ] مراجعة Signed Manifest/key rotation/deployment binding/operator/DB grants وخطة Recovery المستقلة؛ لا تشغيل Bootstrap فعلي بوصفه اختبارًا.

#### D-T3 — Email Delivery Adapter

**Files:** تمديد `backend/app/services/invitation_mailer.py` عبر `backend/app/services/email_delivery.py` وConfiguration مستقلة؛ Tests `backend/tests/test_d_email_delivery.py` و`test_d_delivery_recovery.py`؛ `backend/docs/invitation_delivery.md`.

**Interface محفوظة:** `InvitationMailer.send_invitation(message: InvitationMessage) -> None`. Production adapter لا تعمل افتراضيًا دون Configuration معتمدة، وSecretStr لا تُطبع.

- [ ] اختيار Provider/Sandbox بعد DEC-09؛ عدم توصيل خدمة مدفوعة أوإرسال رسالة حقيقية ضمن إذن كتابة الكود.
- [ ] تثبيت URL أصلية allowlisted للقبول تحمل Fragment token وWorkspace غير سرية، مع عدم تسجيل الرابط أوتضمين Analytics بالصفحة.
- [ ] اختبار failure قبل النقل وبعده، timeout، retries bounded، duplicate/late deliveries، crash بين commit/send/status، وإبطال الرمز القديم في resend. حفظ حالة عدم اليقين دون Fake sent.
- [ ] لا Outbox تحمل Raw Token مخالفة لـHash-only. إعادة إرسال آمنة بإصدار جديد أوتصميم مشفر منفصل معتمد؛ لا وعد Exactly-Once.
- [ ] اختبار Email template عربية/إنجليزية وSecret redaction داخل fake/sandbox؛ الدليل على Real Delivery يحتاج تصريحًا واختبارًا تشغيليًا منفصلًا.

**D Gate:** Regression A1–C وCross-Tenant/Concurrency/Revocation/Rate Limits؛ مراجعة تسريب Logs وOperational safeguards. كل Finding تُغلق بدليل مستقل؛ F2 وبريد التشغيل وBootstrap تبقى مفتوحة إن لم تُختبر شروطها، وتمنع Production المناسبة. **المخاطر:** بنية limiter/session store وتكلفة provider وأقفال Identity وWindows trust.

### Stage 5 — AI & Advanced Dependency Analysis

#### S5-T1 — Dependency traversal قابلة للتفسير

**Files:** إنشاء `backend/app/services/dependency_analysis.py` و`backend/app/schemas/dependency_analysis.py`؛ تعديل Foundation Routes/Risk Engine بعقد معتمد؛ Tests `backend/tests/test_dependency_traversal.py` و`test_dependency_limits.py`.

**Interface المقترحة:** `analyze_dependencies(db: Session, organization_id: int, root_system_ids: list[int], max_depth: int, max_nodes: int) -> DependencyImpact`؛ المخرجات system IDs وdepth وpaths وcycles وtruncated مع owners/departments/criticality والـincident context الموجود فقط.

- [ ] تعريف اتجاه الحافة من البيانات الحالية: source يعتمد على target؛ Impact يبدأ من target إلى dependents. BFS/visited تمنع الدوران، وstable sort وdedup لا تخفي Multiple Paths.
- [ ] اختبارات chain متعددة المستويات وdiamond وcycle وisolated node وTenant edge فاسدة وroot foreign/absent وحدود الحجم/العمق، مع Query count budget وتجنب N+1.
- [ ] عدم اختراع Business Relationships أوIncidents؛ لا historical context غير متوفر. فصل score policy عن graph algorithm، وتغيير Score يخضع لـB/C Versioning.

#### S5-T2 — Gemini حقيقية واستشارية

**Files:** إنشاء `backend/app/services/ai/{provider,gemini_provider,fake_provider,insight_service}.py` و`backend/app/schemas/ai_insights.py` و`backend/app/models/ai_insight.py` وRoutes insights بعد اعتمادها، وSettings/Migrations الملائمة؛ Tests `backend/tests/test_ai_provider.py` و`test_ai_isolation.py` و`test_ai_failures.py`.

**Interface المقترحة:** `AIProvider.generate_insights(context: SanitizedChangeContext, locale: str) -> AIInsightResult`؛ Result تحمل `status, provider, model, generated_at, assumptions, uncertainties, usage` مع explanation/recommendations/rollback/testing/stakeholders، دون `approved` أوبديل RiskScore سلطوي.

- [ ] تثبيت SDK أوREST وفق توافق Python ودعم Structured Outputs بعد مراجعة docs/model الحالية؛ Secret من Runtime، لا VITE ولا frontend.
- [ ] Pydantic validation لJSON output وbounds وIDs against allowed tenant context؛ النصوص الحرة Untrusted Data، دون أدوات كتابة أوتحميل روابط من Prompt أوتغيير قرارات.
- [ ] Timeouts وbounded retry مع backoff/jitter للأخطاء القابلة فقط وrespect retry-after، وحصص/تكلفة لكل Tenant وrequest usage؛ لا تخمين تكلفة دقيقة عند غياب بيانات التسعير.
- [ ] Data minimization دون Password/Token/Emails غير لازمة؛ لا cross-tenant cache أوshared prompt history. تحفظ provenance وinput revision/prompt version إذا اعتمد التخزين.
- [ ] FakeProvider للوحدة؛ أخطاء 429/5xx/timeout/malformed schema/prompt injection/unknown IDs/foreign IDs، ولا fallback templates باسم AI. عند الفشل تبقى النتيجة الحتمية وتظهر insights unavailable صراحة.
- [ ] اختبار تكامل Gemini حقيقي opt-in ببيانات اصطناعية بعد اعتماد DEC-08 والتكلفة؛ fake وحدها لا تثبت Provider الإنتاج.

تؤكد [وثائق Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) وجود JSON Schema ودعم Pydantic في Python؛ Validation التطبيق وقيود المعنى والتفويض تظل لازمة، ولا تثبت صحة التوصيات بمجرد مطابقة Schema.

**S5 Gate:** Traversal صحيحة ومحدودة ومؤسسية؛ AI failure/isolation/provenance وRisk/CAB immutable؛ عدم إغلاق Real Integration بمجرد FakeProvider. **المخاطر:** بيانات حساسة خارج النظام، model drift، cost/latency، إعادة احتساب غير معتمدة.

### Stage 6 — Interactive Visualizations & Analytics

**Files:** `frontend/src/features/dependencies/{DependencyGraph,GraphFilters,SystemInspector}.tsx` و`frontend/src/pages/DependencyGraphPage.tsx` و`features/analytics/`؛ Backend `backend/app/services/analytics_service.py` وSchemas/Routes المعتمدة؛ Tests `backend/tests/test_analytics_latest_assessment.py` و`frontend/e2e/graph.spec.ts`.

- [ ] اعتماد DEC-11 وقياس Nodes/Edges في Fixture ممثلة؛ مقارنة SVG/Canvas/library candidates بBundle/interaction/accessibility قبل اختيار Dependency. لا إضافة مكتبة graph كبيرة افتراضيًا.
- [ ] عرض Nodes/Edges الفعلية وDirect/Indirect/Cycle/criticality، مع click inspector/search/filter/zoom/pan وMobile وKeyboard بديل جدولي قابل للقراءة. الإخفاء البصري لا يوسع API Scope.
- [ ] تصحيح Analytics إلى آخر Assessment صالحة لكل Change إن اعتمد، وUnknown غير مقيمة؛ Total/Distribution/Pending/Approved/Rejected/Implementation/Affected Systems/Recent Activity من Backend مفوضة. لا اشتقاق أرقام عشوائية عند Empty/Failure.
- [ ] اختبارات Tenant A/B وRequester ownership وRevision متعددة؛ مجموع التوزيع يطابق تعريف المقياس، وNull/Empty تظهر دون تضليل. Query budget وpagination/aggregation في DB حسب القياس.
- [ ] Lazy chunks وreduce-motion charts، وتحكم بإعادة الرسم والبيانات الكبيرة؛ benchmark محدد الأجهزة بعد تعريف SLO.

**S6 Gate:** لا حافة أومؤشر بلا بيانات أصلية؛ Legends وLabels وKeyboard وMobile فعالة، وصحة Metrics/Counts مثبتة. **المخاطر:** data scale والتشتيت والاعتقاد أن الرسم يثبت سلطة أوScore لم تُحسب.

### Stage 7 — Reports, Remaining Product Contracts & UX Refinement

#### S7-T1 — تقارير مفوضة باللغتين

**Files:** إنشاء `backend/app/services/report_service.py` و`backend/app/routes/reports.py` و`backend/app/schemas/reports.py` و`backend/app/templates/reports/` بعد اعتماد PDF engine؛ `frontend/src/features/reports/` و`pages/ReportsPage.tsx`؛ Tests `backend/tests/test_report_authorization.py` و`test_report_content.py` و`frontend/e2e/reports.spec.ts`.

- [ ] مصدر واحد لـReport snapshot من scope_changes والـAssessment/AI provenance/Approvals/Timeline؛ لا استدعاء Legacy report_generator غير المعزولة.
- [ ] تضمين Executive/Technical summaries وSystems/Departments/Factors وRecommendations/Rollback/Tests وCAB History وLifecycle وAssumptions، مع فصل الحتمي/AI/القرار البشري.
- [ ] عقد locale لـPDF/Print، وFonts مرخصة وArabic shaping/bidi والهوامش والجداول الطويلة/page breaks؛ render-and-inspect عينات عربية وإنجليزية، لا نجاح اعتمادًا على وجود ملف PDF فقط.
- [ ] ترجمة Backend-generated messages عبر structured event/factor codes وparameters للنتائج الجديدة، مع حفظ النصوص التاريخية دون ترجمة دائمة مدمرة أوترجمة بيانات المستخدم تلقائيًا.
- [ ] ربط Export/read permissions بالموارد نفسها، وScope لكل job/cache/file إن اختير Async؛ إعادة التحقق عند Download بعد role downgrade؛ حماية أسماء الملفات وHeaders والوقت/الحجم.
- [ ] اختبارات منع Foreign tenant وRequester الآخر وRole change، وحفظ History وActual Arabic content ووقت timezone المعتمد. لا تصدير نجاحًا عند Provider/DB failure.

#### S7-T2 — Contracts للصفحات التي لا Backend لها

**Files المقترحة:** `backend/app/models/{project,organization_settings}.py` و`schemas/{project,preferences}.py` و`routes/{projects,organization_settings,profile}.py` وMigrations معتمدة؛ `frontend/src/features/{projects,organization,profile}/` وPages مستقلة؛ Tests `backend/tests/test_projects_isolation.py` و`test_settings_permissions.py` و`test_profile_preferences.py`.

- [ ] اعتماد DEC-12 قبل Model/Permission/API: ماذا يعني Project، ومن يراه/يديره، وعلاقته بـChange دون كسر Legacy records، وما Settings/Profile fields المسموحة.
- [ ] إضافة Backend contracts وTenant FKs/Scopes/Validation/Audit/Migrations preservation لكل مهمة منفصلة؛ لا تسمية القراءة Update أواختراع save success.
- [ ] بناء `/projects` و`/organization/settings` و`/profile` فقط بعد اختبارات عقودها، وربط Preferences عبر الأجهزة إن اعتُمدت. لا Password Recovery أوRole designer ضمنية؛ تحتاج قرار DEC-13.
- [ ] مراجعة استكمال كل صفحة مطلوبة: Risk Assessment بعد B، CAB/Implementation بعد C، AI بعد S5،Graph بعد S6، Reports/Analytics، Projects/Users/Settings/Profile. Missing contracts تبقى Incomplete لا Placeholder جاهزة.

#### S7-T3 — استكمال UX والجودة

- [ ] مراجعة كل Route باللغتين وRTL/LTR والجوال واللابتوب، وكل Toast/Dialog/Chart/Error/Email/Report ضمن Localization؛ audit لـHardcoded UI.
- [ ] AA contrast وKeyboard/screen reader وfocus restoration، loading/error/empty والـresponsive tables/card views؛ توثيق أي فجوات بدل عبارة «accessible» عامة.
- [ ] ضبط performance/re-renders/caching وMicro-interactions وprefers-reduced-motion باستخدام القياس، والتحقق من Network/Error Recovery.

**S7 Gate:** PDFs مقروءة بصريًا باللغتين ومفوضة؛ كل صفحة إما تعمل بعقد حقيقية أوتظل مطلبًا مفتوحًا يمنع إعلان الاكتمال؛ لا hardcoded UI في النطاق النهائي. **المخاطر:** Bidi/fonts وReport leakage وProduct scope غير معتمد وCache بعد downgrade.

### Stage 8 — Final Integration & Production Readiness Assessment

**Files:** `frontend/e2e/` و`backend/tests/` و`.github/workflows/quality.yml` و`backend/docs/production_readiness.md`؛ أدوات Load/Security معزولة بعد تحديد الميزانية.

- [ ] CI reproducible مع pinned runtimes/lockfiles، Unit/Component/Typecheck/Lint/Build وPostgreSQL integration/migration/authorization/concurrency؛ Windows Runner المعتمدة لـF2، دون bootstrap تشغيلية.
- [ ] Full E2E فعلية على disposable test DB: Login الصحيح/الخاطئ، Invitation lifecycle، roles change، Foreign resources، B rules، C approvals/start/revision، D revoke/rate limits، graph، AI failure، report export، ar-SA/en وmobile.
- [ ] Load datasets والسعة وp95/p99/concurrency/query budgets مبنية على DEC-11؛ قياس UI bundle/interaction وAPI/DB/provider timeouts، وتوثيق bottlenecks. لا أرقام أداء تشغيلية مختلقة.
- [ ] مراجعة أمنية كاملة/dependency advisories/secrets/redaction/CORS/headers/abuse وaudit alerts؛ أي High مفتوحة تمنع Gate.
- [ ] محاكاة Backup/Restore وMigration failure/Rollback في بيئة غير إنتاجية، وتوثيق RPO/RTO وIncident Response/ownership ودليل استعادة لا مجرد وجود Backup job.
- [ ] تقرير Passed/Failed/Skipped لكل منصة؛ أي skipped متطلب حرج يمنع قبول Production ولا يحسب نجاحًا.

**S8 Gate:** جميع Product contracts ومتطلبات العزل والحوكمة مكتملة، ولا High مفتوحة، وأدلة F2/Email/Gemini التشغيلية ضمن نطاق التصاريح إن كانت لازمة للاعتماد. **المخاطر:** بنية Runner/البيانات/حمل التكامل؛ غيابها يسجل عائقًا صريحًا لا إغلاقًا وهميًا.

### Stage 9 — Deployment Preparation Only

**Files:** `frontend/netlify.toml` أو`frontend/public/_redirects` باختيار واحد مدروس، وEnvironment examples، و`backend/docs/{deployment,backup_recovery,incident_response}.md` وCI templates وHealth/Readiness endpoints مفوضة حسب الحاجة.

- [ ] مقارنة استضافة FastAPI وManaged PostgreSQL: region/data residency وsupported PostgreSQL/extensions/TLS/pooling/limits وBackup/PITR وRPO/RTO وmonitoring وstaging والتكلفة الفعلية بتاريخ القرار. لا مزود محدد أوسعر مضمون في Stage 0.
- [ ] Frontend build base=`frontend` وcommand=`npm ci && npm run build` وpublish=`dist` ضمن base؛ VITE_API_BASE_URL عامة فقط؛ keys/secrets server-side.
- [ ] إعداد SPA rewrite محليًا مع static assets والأخطاء وAPI precedence؛ اختبار فتح `/changes/123` مباشرة وRefresh/History، وعدم تحويل API خطأ إلى HTML نجاحًا.
- [ ] CORS محددة لـapproved frontend/staging origins وHTTPS وSecret injection/rotation وstartup migration opt-out وliveness/readiness فعلية؛ لا افتراض أن Netlify تستضيف FastAPI/PostgreSQL الحالية تلقائيًا.
- [ ] إجراءات release/migration: explicit target/preflight/backup/write freeze/preservation/forward repair وhealth verification وrollback decision؛ فصل التطبيق السابق غير المتوافق عن A1 النهائي.
- [ ] تجهيز Staging/Release/Monitoring/Error reporting/Incident Response runbooks وOwner لكل خطوة. أي إنشاء خدمة مدفوعة أوتعديل Domain/Secrets/تطبيق Migration أونشر يحتاج موافقة منفصلة.

تدعم [وثائق Netlify الخاصة بـSPA rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) fallback إلى `index.html` لHistory navigation؛ الإعداد الفعلي واختبارات المسارات ستنفذ ضمن المرحلة المعتمدة، دون نشر الآن.

**S9 Gate:** حزمة إعداد ووثائق ومقارنة تكلفة معتمدة واختبارات Routing/Config محلية؛ **لا Deployment فعلي**. Production Activation مرحلة تشغيل بتفويض صريح جديد بعد جاهزية S8 ومراجعة بيئة الهدف.

## 8. سجل تغييرات API وDatabase المخططة

كل بند **Proposed**، وليس API متاحة الآن. الأسماء النهائية تسجل في Design Gate قبل التنفيذ؛ لا تُنشأ واجهة تدّعي دعمها مسبقًا.

| المرحلة | API المخططة | Database/Compatibility |
|---|---|---|
| A5 | Extension لـGET `/auth/me`: permissions/workspace_slug؛ بقية Login/Accept الحالية محفوظة | لا Migration؛ SessionStorage قرار UI وقد يفرض Login جديد بدل migration للرموز |
| B | Scope لـrisk-rules وOverview/Score؛ Draft/Publish/Retire endpoints حسب العقد؛ Missing Config code 409 | RuleSets/versioning + Tenant ownership/keys وAssessment factor/version snapshot؛ Expand/Backfill/Enforce؛ لا إعادة كتابة التاريخ |
| C | Policy/authority/evidence وrevision preconditions على Approvals/Start؛ منع client approval_level من منح السلطة | Governance policy/decisions/revisions وربط Evidence؛ policy migration مع Legacy review لا موافقات مختلقة |
| D | Logout/revocation/session/refresh وفق القرار، وRate limits/headers/errors | Session registry/version إن اعتمد؛ خطة توافق JWT/مفاتيح؛ أي durable delivery schema بتصميم منفصل |
| S5 | Dependency analysis bounded وChange insights read/generate endpoints بعد تفويضها | AIInsight provenance/usage optional storage وVersion metadata؛ لا overwrite للRisk/CAB |
| S6 | Latest-per-change analytics وbounded graph dataset | Indexes/query plans عند القياس؛ تغيير Metric يحتاج اعتماد وتوثيق |
| S7 | Report read/export/locale، وProjects/Org Settings/Profile CRUD المقيدة بعد اعتماد Policy | Project/settings/preferences models وtenant keys، وحفظ علاقات Changes القديمة |
| S8/S9 | Health readiness/operational endpoints حسب تصميم النشر | لا migrations تشغيلية ضمن Stage 0؛ DB production تغيير مصرح مستقل |

**قاعدة مشتركة:** UI translates codes/display values فقط؛ أسماء Fields/Columns الحالية محفوظة ما لم يبرر تغيير تعاقدي موثق. Catalog CRUD غير الموجود ليس جزءًا من A5 لمجرد وجود صفحة Catalog؛ أي Update/Delete جديدة تضاف كتغيير Backend مستقل وTenant tests.

## 9. استراتيجية الاختبار وQuality Gates المشتركة

| الطبقة | ما يجب إثباته | نوع الأدلة |
|---|---|---|
| Auth/Authorization | Workspace/JWT strictness وcurrent DB roles/permissions وabsence vs foreign equivalence وmass assignment | ASGI HTTP + PostgreSQL disposable، وتغير الدور مع JWT نفسها |
| Data isolation | lists/search/counts/nested resources/mutations/cache/reports/AI والـRequester ownership | مؤسستان بقيم مميزة، ومقارنة كامل البيانات قبل/بعد الرفض |
| Migrations | Preflight/constraints/indexes/defaults/preservation/failed step/forward repair | owned fixture فقط؛ initial→head مع legacy representative وSchema Contracts |
| Risk | contributions/versions/precedence/thresholds/missing/ambiguity/order invariance | Assertions للScore والعوامل والإصدار وTenant B بعد تعديل A |
| Governance | authority/SoD/quorum/revision/start enforcement وatomic audit | DB transactions متداخلة مع حواجز، وfinal records/counts لا status فقط |
| Invitations | expiry/replay/resend/revoke/concurrency/late delivery/failure/redaction | fake adapter للوحدة؛ Provider sandbox ثم real authorized delivery كدليل منفصل |
| AI | schema/semantics/untrusted prompt/foreign IDs/minimization/error status/usage | FakeProvider محددة + opt-in real integration ببيانات اصطناعية بعد الموافقة |
| UI | routes/refresh/back/forward/permission loading/races/session clearing | Component tests + local E2E على API وDB مؤقتتين |
| i18n/a11y/responsive | كل Routes/ARIA/errors/print/reports، rtl/ltr/theme/focus/reduced motion/overflow | Automated axe + manual keyboard/screen reader/visual review باللغتين والأحجام المحددة |
| Performance/operations | workload/query/bundle/timeout/rate limit/recovery/backup/monitoring | baseline ثم budgets معتمدة، load معزول وrestore drill، دون وعود بلا قياس |

### 9.1 تشغيل آمن

- `backend/tests/conftest.py` يفرض ENVIRONMENT=test وSQLite داخل الذاكرة وJWT اصطناعية وCREATE_TABLES_ON_STARTUP=false قبل استيراد التطبيق؛ لا تستبدل ذلك بDATABASE_URL فعلية.
- Fixture `tests/a1_postgresql.py` وحدها تنشئ الموارد وتثبت ملكية Engine وCluster وSchema وSearch Path. Native fixture `a2_native_postgresql.py` بديل اختياري؛ لا اتصال بPostgreSQL قائمة. لا تجاوز ownership checks عند التعثر.
- Production bootstrap/seed/setup محظورة لإعداد الاختبارات. Tests الخاصة بها تستخدم Signed policies وUsers وMailers اصطناعية داخل Fixtures فقط.
- إعادة الاختبارات الكاملة تُطلب عند تغييرات runtime في المرحلة المناسبة، لا لإيهام أن Documentation-only أغلقت Security Findings.
- Unit command الحالية من `backend`، دون PostgreSQL أوكتابة cache:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:PYTHONPATH='.'
$env:CHANGEFLOW_A1_POSTGRES_TESTS='0'
.\venv\Scripts\python.exe -B -m pytest -q -ra --tb=short -p no:cacheprovider tests/test_change_state_service.py tests/test_model_constraints.py tests/test_schema_hardening.py
```

- مثال **مستقبلي** Full PostgreSQL Regression من `backend` عند اعتماد تنفيذ يتطلبه، بعد التحقق من المضيف/Fixture:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:PYTHONPATH='.'
$env:CHANGEFLOW_A1_POSTGRES_TESTS='1'
$env:CHANGEFLOW_TEST_POSTGRES_BIN='C:\Program Files\PostgreSQL\18\bin'
.\venv\Scripts\python.exe -B -m pytest -q -ra --tb=short -p no:cacheprovider
```

هذا المثال لم ينفذ في Stage 0. F2 positive opt-in لا يضاف على جهاز التطوير؛ له Runner مستقلة كما في A3.

## 10. سجل نتائج التحقق الفعلية

### 10.1 المنفذ في Planning Gate — 2026-11-01 Asia/Riyadh

| الفحص | الأمر/النطاق | النتيجة وحدودها |
|---|---|---|
| Git baseline | status/branch/rev-parse/remote/log | مطابق، ونظيفة قبل إضافة الخطة؛ لا fetch/push/commit |
| Backend limited tests | الأمر المحدود في 9.1، Python 3.13.1 المحلية | **40 passed، 0 failed، 0 skipped، 2.26s**؛ State transitions وModel definitions وPydantic schemas فقط، بلا PostgreSQL |
| Test collection | `python -B -m pytest --collect-only -q -p no:cacheprovider` مع نفس عزل conftest | **509 tests collected، Exit 0، 4.42s**؛ Collection فقط، ليست 509 Passed |
| TypeScript + production build | Node `C:\Program Files\nodejs\node.exe` **v24.17.0**؛ `node_modules/typescript/bin/tsc -b` ثم `node_modules/vite/bin/vite.js build` من frontend | **Exit 0**؛ Vite 8.1.4، 17 modules. CSS 41.11 kB / gzip 7.80؛ JS 286.52 kB / gzip 78.21؛ HTML 0.45 / gzip 0.29. لا إثبات صحة Login أوUI runtime |
| Lint | نفس Node مع `node_modules/oxlint/bin/oxlint` | **Exit 0، 0 errors، 6 warnings** في App.tsx:1170/1196/1221/1242/1257/1274، missing Hook dependencies؛ لم تُخف أوتُصلح في Planning |
| Whitespace | `git diff --check` قبل الخطة وبعدها، وفحص مستقل لكل أسطر الملف الجديد | **Passed**؛ لا trailing whitespace أوUnicode replacement characters؛ تحقق وجود Stages 0–9 وSEC-01..10 وDEC-01..16. Untracked فُحصت مستقلًا لأن git diff لا يشملها |
| Frontend Component/E2E/a11y/mobile | لا scripts أوframework مسجلة حاليًا | **لم تنفذ**؛ لا ادعاء نجاح أوتغطية |
| Full PostgreSQL/Windows F2/Gemini/Email | خارج الفحوص المحلية المحدودة | **لم تنفذ في هذه الجلسة**؛ لا يُصنف عدم تشغيلها Passed أوSkipped جديدًا |

البناء ولد فقط `frontend/dist` وTypeScript build-info داخل `node_modules/.tmp` المتجاهلة في Git؛ لا تغيير Product Source. لم تثبت Dependencies أوتُغير Lockfile. الأوامر أعلاه مكافئة لمحتوى scripts الحالية؛ استخدمت Node بالمسار الصريح لأن اكتشافه عبر PATH لم يعرضه في Shell هذه الجلسة.

### 10.2 نتائج تاريخية من A1–A4، لم تُعد هنا

- A2 final corrections: **312 passed، 1 skipped، 4 warnings** حسب تقرير A2.
- A3 final regression: **441 passed، 2 skipped، 4 warnings** حسب تقرير A3؛ F2 غير مغلقة.
- A4 final after R1: **507 passed، 2 skipped، 0 warnings، 807.78s** حسب تقرير A4، على PostgreSQL 18.4 مؤقتة. لا تجمع أعداد هذه الجولات المتداخلة أوتضيف إليها اختبارات Stage 0.
- التجاوزان التاريخيان: PostgreSQL collation case على SQLite؛ و`test_native_positive_policy_chain_on_prepared_windows_runner`. الثاني بوابة أمنية مفتوحة، وليس نجاحًا ضمنيًا.
- وجود PostgreSQL executable على المضيف فُحص كمسار فقط؛ لم تُشغّل Cluster أوتُتحقق نسخة PostgreSQL runtime في Planning Gate. **18.4 هنا معلومة من التقارير التاريخية**.

### 10.3 Security Preflight + A5-T1 — نتائج جلسة لاحقة في 2026-11-01

- التفويض المحلي لـA5-T1 مُنح بشرط Gate أمنية؛ الفحص كشف Credentials محتملة، فأوقف التنفيذ قبل تعديل Application Code. النتيجة **Blocked by findings**، لا Feature مكتملة.
- فُحصت 106 ملفات متتبعة وملف الخطة Untracked، و189 سجل Blob/Path من 9 Commits محلية reachable، و15 ملف Config/Build/Backup محليًا و135 عضو أرشيف داخل الذاكرة. لم تُفتح قواعد البيانات، ولا Fresh Fetch أوخدمات خارجية. الأعداد من تمريرة ما قبل تحديث التوثيق، وتفاصيل الحدود في [phase2_a5_t1.md](phase2_a5_t1.md).
- لا Gitleaks/TruffleHog/detect-secrets ظاهرة في PATH؛ استُخدم Regex/AST محلي محدود دون تثبيت. نجحت **10 Synthetic scanner checks**؛ ليست اختبارات التطبيق أوإثبات تكافؤ الأداة مع Scanner مستقلة.
- Password literals مثبتة في Setup المتتبعة و3 نسخ تاريخية وأرشيفين؛ JWT/DB candidates محلية. المقارنة الحرفية للقيم المحلية الثلاث داخل Blobs التاريخ المفحوص لم تجد تطابقًا، دون نشر قيم أوHashes أوادعاء خلو المستودع من الأسرار.
- لا مسار استدعاء تلقائي مثبت لـSetup ضمن ملفات التطبيق/الفروع/Scripts المفحوصة؛ تظل قابلة للاستدعاء اليدوي بإعدادات DB مناسبة، ولم تُنفذ.
- **لم تُشغّل** Typecheck/Build/Lint/Backend/PostgreSQL tests لهذه الجلسة بعد الإيقاف. لا نتائج A5-T1 Passed أوPytest Skipped؛ تبقى نتائج Stage 0 وA4 السابقة تاريخية.
- التعديل Documentation فقط: الخطة وهذا التقرير؛ لا Models/Migrations/API/Frontend أوSecurity Policy أوSecrets تغيرت.

### 10.4 Credential Safety Remediation — الإصلاح المحدود المعتمد

- [x] إعادة Dependency/Invocation audit دون تشغيل النسخ الأصلية؛ لا اعتماد تشغيلي مثبت ضمن Python/Script/Config المحلية المفحوصة.
- [x] كتابة `backend/tests/test_legacy_setup_disabled.py` أولًا، وإثبات RED دون تشغيل الكود الخطر: **3 failed، 1 passed، 20 deselected، 0.42s**؛ توقف مبكر مفقود للأداتين و4 Password arguments في Setup.
- [x] استبدال `backend/setup_auth_users.py` و`backend/seed_foundation.py` بـSystemExit غير مشروط قبل Imports؛ لا Legacy helpers أوDB/Hashing imports أوخيارات إعادة تفعيل، ولا Password literals في المصدر المعدل.
- [x] اختبارات Import/Script/CLI في development/test/production وCI/flag اصطناعية، وحواجز Dependency/Connection/File write، وLifespan دون Legacy import: **24 passed**؛ الجولة النهائية المركزة **4.85s**.
- [x] Backend suite كاملة مع PostgreSQL/F2 positive opt-out، خارج Sandbox بعد موافقة الأداة: **216 passed، 317 skipped، دون failures أوPytest warnings، 33.77s**. تشمل الـ24؛ لا تجمع النتائج المتداخلة. المحاولة داخل Sandbox لم تكتمل بسبب Windows asyncio socketpair وSetup errors مبكرة؛ التفاصيل في التقرير ولا تعتبر Passed.
- [x] 317 skipped = 315 تتطلب PostgreSQL غير المفعلة + Collation على SQLite + F2 Positive التي تحتاج Runner موثوقة. لم تُشغّل PostgreSQL أوDB قائمة؛ SQLite الاختبارية داخل الذاكرة فقط من الاختبارات القائمة.
- [x] توثيق حدود العزل والتاريخ وغياب Rotation/History Rewrite/تثبيت أدوات/Git/Deployment؛ A5-T1 و`/auth/me` وAPI Client لم تبدأ.
- [ ] مراجعة المستخدم للإصلاح المحدود؛ لا Commit أوانتقال تلقائي.

الملفات المقصودة: الأداتان Modified؛ ملف اختبار واحد جديد؛ والخطة وتقرير `phase2_a5_t1.md` الموجودان Untracked حُدثا دون حذف سجل Preflight السابق. النسخ القديمة في **HEAD الحالية** والتاريخ والأرشيفين باقية؛ فحص المصادر الحالية لا يغلق Exposure تاريخية أويعني تغيير Credentials فعلية.

### 10.5 Independent Gitleaks Security Scan — بوابة مستقلة معتمدة

- [x] التحقق من Remote/Branch/HEAD وحفظ بصمات جميع ملفات Git الحالية المتتبعة وغير المتتبعة؛ لا تعديل Source أثناء الفحص. HEAD `5ef6a68` وmaster `10faab2` كما هما.
- [x] تنزيل Windows x64 v8.30.1 وChecksums من GitHub Releases الرسمية فقط؛ مطابقة SHA-256 **قبل** الاستخراج والتشغيل، ثم تحقق `version`. المجلد منفصل ومؤقت: `C:\Users\W10\AppData\Local\Temp\changeflow-gitleaks-8.30.1-lnmykfm8`؛ لا PATH/Registry/Services أوDependency/CI changes.
- [x] SHA-256 الحزمة: `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`؛ Manifest: `061476c21adaf5441516f96f185c1a4706a83cd6329b9b38762271b3d4a52fae`.
- [x] Synthetic-only Directory/Archive وstdin checks نجحت قبل إدخال المشروع. Template تختار Rule/Path/Line/Commit فقط؛ `--redact=100`، دون Verbose/Debug/Diagnostics أوRaw Match reports؛ stdout/stderr لا تعرض أوتحفظ. لا ملفات `.env`/Keys نُسخت إلى الأدوات.
- [x] Git Patch scan: 4 Findings؛ Directory scan: 10 Findings. المرور المكمّل عبر stdin غطى **188 Historical Blob/Path + 128 Current files + 135 Archive members = 451 input، 5,635,588 bytes**؛ دون أخطاء Scanner أوPartial logs. لا تجمع النتائج المتداخلة.
- [x] النتيجة المصنفة: **21 موقعًا، لا 21 Secret فريدة**: 11 موقعًا في 3 نسخ تاريخية لـSetup + 8 مواقع بأرشيفين، كلها Historical Credentials ذات Literal source مؤكدة؛ وموقع JWT في `.env:1` Potential Active Secret، ونسخة JWT احتياطية Local-Only Secret. لا False Positive أوSynthetic classification داخل مجموعة المشروع؛ Synthetic fixtures خارجها.
- [x] Scope snapshot: 8 local refs/9 reachable commits، بما فيها CodeX refs وFeature/master وorigin counterparts؛ ليست Shallow؛ لا Tags محلية. لا Fetch أوفحص Remote refs/PRs/Forks غير المتاحة. استثنيت Git internals/dependencies/caches من المكمل، والـSource/Config/Build المتاحة شملتها stdin حتى عند وجود مرشحات paths افتراضية. لا Source Maps موجودة خارج dependencies. DB bytes محلية دون SQL/DB connection؛ لا Semantic DB audit.
- [x] defaults محفوظة مع Rule واحدة محدودة لـSetup؛ لا Custom Allowlist عامة أوBaseline لإخفاء التاريخ. بقيت الأداتان معطلتين، ولم تُشغلا أوتتغير ملفات التطبيق أوالاختبار؛ التعديل في هذه الجلسة Documentation فقط.
- [ ] اعتماد التصنيف والتقاعد/الاستخدام والتعرض، وContainment/Rotation إن لزمت بتفويض منفصل؛ لا إعلان Gate خالية من الأسرار أوإذن استئناف A5-T1.

تفاصيل كل Finding بـRule/Path/Line/Commit/Severity/Classification/Remediation، وإثبات الأداة وحدود الأرشيفات/الترميز وMetadata artifacts في **القسم 10 من [phase2_a5_t1.md](phase2_a5_t1.md)**. PRE-04 Database credential المعروفة سياقيًا لم تلتقطها Gitleaks defaults؛ تبقى مفتوحة ولا تُستبعد لعدم ظهور Match. اختبارات التطبيق السابقة لم تُعد في مهمة Scan/Documentation؛ لا تغيير لـ24/216/317 التاريخية.

### 10.6 Credential Remediation Execution Plan — تحقق وخطة غير منفذة

- [x] حفظ Branch وHEAD المعتمدين والتغييرات الخمسة السابقة؛ لا Stage/Commit أوتبديل Source. مقارنة 66 ملفًا من app/migrations وBootstrap واختبارات A1–A4 بـHEAD بلا اختلاف بعد تسوية Line endings؛ لا تغيير للوظائف بموجب مقارنة المصدر، ولا ادعاء Regression جديدة.
- [x] فحص التوقف غير المشروط للأداتين قبل Imports/DB writes، وغياب Password literals/القيم القديمة عن الأداتين والاختبار دون عرضها؛ لا Flag تسمح بإعادتهما في Production.
- [x] اختبارات العزل وحدها، مع SQLite memory/إعدادات اصطناعية وفخاخ Dependencies/Connections وMock startup: **24 passed / 0 failed / 0 skipped / 5.42s**؛ لا warnings في الناتج. شُغلت Stubs الحالية داخل حراسة الاختبار بعد AST، لا النسخ التاريخية أوSetup فعال. لم تُعد Full suite أوBuild/History scan.
- [x] Gitleaks **v8.30.1** السابقة: تحقق الحزمة وexe/Synthetic safety proof، وفحص stdin موجّه للأداتين وملف الاختبار بقواعد defaults/Metadata-only reports: **0 Findings في 3 ملفات**؛ لا دليل Secret فعلية جديدة ضمن هذا النطاق، ولا برهان خلو مطلق.
- [x] مراجعة `.env` Metadata و`.gitignore` دون قيم: JWT وDB password موجودتان محليًا، development/Loopback لا يثبتان عزلًا. `.env` والنسخة الاحتياطية والأرشيفان غير متتبعة وتشملها ignore؛ ليست ignore دليل عدم تعرض. لا تغيير لهذه الملفات أوالقيم، ولا رفعها.
- [x] تثبيت إفادات المالك بدل تكرار التصنيف: Demo intent مؤكد، retirement **Unresolved**؛ Local Environment Secrets ذات Exposure Unresolved، والأرشيفات Local Backups ذات External Distribution غير مؤكدة. لا دليل جديد يفرض Rotation تلقائية؛ القيم تبقى دون تغيير.
- [x] توثيق DEMO-R1..R6 غير المنفذة: Manifest من organization_id/user_id موثوقتين، معاينة Metadata داخل المؤسسة، منع Global email lookup، تعطيل دائم محدد عبر Admin API بعد الموافقة، حفظ Audit، ومعالجة JWT عبر DB inactive check. Password change لا يبطل JWT تلقائيًا؛ لا Reactivation تلقائية لهوية Demo ولا حذف/تغيير Org/Role/Hash.
- [ ] اعتماد مسار تطوير A5-T1 المعزول وإثبات Fixture ownership/Signing key اصطناعية مستقلة قبل Import وعدم fallback لإعدادات `.env` أوDB الحالية. **لم تُنشأ الموارد ولم يبدأ A5-T1**؛ قبول المخاطر محليًا يحتاج قرار المالك ولا يغلق تقاعد الحسابات القديمة.
- [ ] عند الحاجة لقاعدة قديمة: اعتماد Manifest ونافذة احتواء ومراجعة Metadata ثم معالجة موجهة وإثبات تقاعد/Audit؛ لا تعطيل Administrator عند غياب ضمان منع Last Administrator Race أوإصلاح معتمد لها.

**قرار الجاهزية المقترح:** **Conditional Approval Required** لتطوير محلي اصطناعي مثبت الفصل فقط؛ **Blocked Pending Credential Remediation** لاستخدام قاعدة الحسابات القديمة أوالمؤسسات الحقيقية. الأدلة المطلوبة وحدود قبول المخاطر وClosure Matrix وRotation contingency وProduction Blockers في القسم 11 من [التقرير](phase2_a5_t1.md). عزل الأدوات مغلق تقنيًا ضمن Working Tree؛ إغلاق بيانات Demo غير مثبت؛ جميع SEC-01..10 تبقى كما هي. الخطوات الموثقة ليست تفويضًا أوتنفيذًا أوتغيير Security Policy.


### 10.7 A5-T1 Conditional Execution & Resumed Verification — النتيجة النهائية المحلية

- [x] Isolation Gate قبل تعديل الوظائف: **3 passed /14.30s**؛ Child env allowlist ومفتاح توقيع اصطناعي جديد، منع dotenv discovery/reads، DB driver/target guards وCluster/Schema ownership. PostgreSQL **18.4** جديدة فقط، بلا Docker أوDependencies أواتصال بخدمة قائمة. محاولة Sandbox الأولى تعثرت وسُجلت؛ الإعادة الناجحة سبقت التطبيق.
- [x] `/auth/me` توسعت بـpermissions مرتبة من Matrix A4 وworkspace_slug من Organization الحالية؛ حفظ جميع الحقول السابقة، دون JWT/Matrix/Model/Migration/API breaking removal.
- [x] Client/Services typed مع runtime validation وtrusted origins وredirect rejection وBearer memory boundary و401/403/404/409 وAbort/Timeout/Generation وlate response rejection وData cleanup subscriptions؛ Login Form الحقيقية بلا Public registration. لا wiring للواجهة القديمة قبل T2.
- [x] استُعيد تشغيل الانحدار السابق بدل إعادته: **388 passed /1 failed /1 skipped /546.90s**. الفشل في اختبار جديد حاول إسناد دور Foreign فرفضته FK؛ صُحح الاختبار دون تغيير Constraints أوالتطبيق. أُعيدت Identity+Gate فقط: **15 passed /0 failed /0 skipped /47.74s**، منها 13 HTTP/PostgreSQL/owned-DDL و2 guard/settings.
- [x] الـSkip الوحيدة هي نسخة SQLite لاختبار Collation؛ نسختها PostgreSQL نُفذت. لا PostgreSQL tests متخطاة ضمن المجموعة المختارة. لا Bare full suite أوBootstrap/F2/Legacy CLI أوBrowser E2E جديدة؛ نتائج العزل/Regression السابقة تبقى تاريخية.
- [x] Frontend النهائية **13 passed** بعد RED→GREEN لإصلاح خطأ Headers المحتمل كشف إدخال وBody transport error classification. App/API tests/Vite-config Typecheck: Exit0؛ Vite Build بلا warnings إلى Temp جديدة دون overwrite لـdist أوتحميل env؛ JS286.52kB/gzip78.21 وCSS41.11/gzip7.80.
- [x] Lint: **0 errors /6 warnings** سابقة في App.tsx (exhaustive-deps)؛ لا warnings جديدة. لا UI redesign أوتعديل App.tsx/AuthProvider/Storage أوصفحات A5-T2.
- [x] مراجعة Source/Diff دون إخراج كلمات المرور المحذوفة؛ Gitleaks v8.30.1 موجّه بقواعد defaults وMetadata-only reports: **23 ملفًا، 0 Findings**، دون .env أوRaw matches أوإعادة Scan للتاريخ. Python AST/UTF-8/Whitespace وgit diff --check وحفظ ملفات العزل السابقة وDEC-01..16/SEC-01..10 نجحت؛ تفاصيل الإثبات في التقرير 12.5.
- [x] عزل Setup السابق محفوظ؛ لا .env/DB/Users/Hashes/Roles/Tokens حقيقية أوSecrets/History تغيرت، ولا Bootstrap/Legacy execution. Cleanups تخص الموارد الجديدة المملوكة فقط.
- [x] تحديث الخطة والتقرير؛ **جاهزة لمراجعة Development Checkpoint** وليس إذن Git. تفاصيل الملفات والأوامر والأعداد المتداخلة والتحذيرات وحدود Security في القسم 12 من [التقرير](phase2_a5_t1.md).


### 10.8 Final Checkpoint Review — إعادة المجموعة الواسعة بعد التصحيح

- [x] التحقق من Branch/HEAD و24 Modified/Untracked file وStaging الفارغة؛ مراجعة النطاق لكل ملف، دون إخراج Diff كلمات المرور المحذوفة.
- [x] إصلاح عيب Portability في Test runner فقط: حذف مسار المطور الثابت، وقبول --postgres-bin أوPATH مع أدوات في Directory واحدة وفشل آمن عند غيابها. RED أربع حالات ثم **4 passed /0.08s**؛ لا Dependencies أومسارات User home في الاختبارات الجديدة.
- [x] Backend الواسعة من جديد بعد تصحيح Tenant FK: **399 passed /0 failed /1 skipped /18 deselected /635.56s /Exit0**. التقسيم: **235 PostgreSQL passed /0 skipped** و**164 unit/memory passed /1 skipped**؛ لا جمع مع نتائج الاستكمال السابقة.
- [x] Skip واحدة لنسخة SQLite من Collation؛ نسخة PostgreSQL نُفذت. Deselect للحالات الـ18 التي تستدعي Legacy CLI/Import احترامًا لحظر تشغيلهما؛ حالات AST/غياب literals وStartup الست نجحت. لا Bootstrap/F2 positive أوBrowser E2E ضمن المجموعة.
- [x] Child env allowlist ومفتاح اصطناعي جديد وdotenv/read/driver guards، وClusters PostgreSQL جديدة ومنافذ/Schemas مملوكة فقط. انتهى التنظيف ثم ثبت غياب Run root؛ لا خدمة أوقاعدة قائمة أُوقفت أوحُذفت.
- [x] Frontend أعيدت: **13 passed /0 failed /0 skipped /681.50ms**، وTypecheck لApp/Tests/Vite config وBuild ناجحة. Vite8.1.4/286ms، JS286.52kB/gzip78.21 وCSS41.11/gzip7.80، دون Build warnings؛ Lint **0 errors /6 warnings قديمة**.
- [x] Gitleaks v8.30.1 موجّه للملفات الـ24 بقواعد defaults وMetadata-only reports بعد integrity/template verification: **0 Findings**. مقارنة private AST لقيم Setup من النسخ التاريخية الثلاث المعروفة أثبتت غيابها من القائمة الحالية، دون عرض قيم أوHashes أوقراءة .env/بيانات قديمة.
- [x] لا Models/Migrations/JWT v2/Permission Matrix أوApp/Bootstrap تغيّرت خارج تفويض T1. تعطيل Setup لا يكسر Imports تشغيلية مثبتة، وStartup tests لا تحملهما. Client/runtime validation وعقد Login وTenant authorization صحيحة ضمن أدلة المجموعة.
- [x] **Checkpoint Manifest حصرية CP-01..24** في التقرير 13.4: 7 Modified و17 New تتضمن Documentation/Tests، وتستبعد env/backups/build/dependencies/caches/scanner files/temporary fixtures. لا tempfile يحتاج Git.
- [x] **التوصية: Ready for Development Checkpoint**؛ ينتظر اعتماد المالك الصريح للحفظ في GitHub. Legacy Unresolved وF2 وB/C وبقية Production gates باقية؛ لا Git أوT2 أوDeployment الآن.

### 10.9 A5-T2 — التنفيذ المحلي والتحقق النهائي

- [x] baseline والفرع وRemote صحيحة، وWorking Tree نظيفة قبل التنفيذ عند HEAD `de4d0e36f00cfcb7a8352baee6b94e3e0eff8bb3` بعد حفظ T1 باعتماد صريح. لا Git mutations في مهمة T2.
- [x] Isolation Gate قبل الوظائف **3 passed /12.49s**. الاختبارات تستعمل allowlisted environment ومفاتيح اصطناعية وdotenv/read/driver guards وPostgreSQL جديدة فقط؛ لا DB قديمة أوBootstrap/Legacy invocation.
- [x] Backend relevant regression: **303 passed /0 failed /1 skipped /2 deselected /446.22s**؛ **196 PostgreSQL passed /0 skipped** و107 unit/memory passed +1 skipped. Skip نسخة SQLite لاختبار Collation ونسخة PostgreSQL ناجحة؛ حالتان bootstrap deselected. ليست bare full suite ولا إعادة لنتيجة T1 ذات399 حالة.
- [x] Browser فعلية محلية على Edge profile جديدة وVite/FastAPI/PostgreSQL مملوكة: **1 pytest passed /25.55s** تغطي **12 سيناريوًا**؛ Login/recovery/network/role/disabled/switch/logout/invitation/replay/expiry/redirect/storage failure. جميع Finalizers نجحت وثبت غياب Run roots؛ لا توقف خدمة سابقة.
- [x] Frontend **33 passed /0 failed /0 skipped /423.43ms**: 13 Client T1 و14 Auth/Scope و6 Invitation. Typecheck للتطبيق/الاختبارات/config ناجحة؛ Production Build **254ms** وLint **0 errors /0 warnings**.
- [x] أضيف اختبار RED ثم GREEN لفلتر مخرجات Runner حتى لا ينسخ Traceback/rawstderr عند البحث عن Metadata. مسارات أدوات Browser/Node تمر صراحة عبر CLI وتُتحقق؛ لا مسار جهاز ثابت في الاختبارات ولا تثبيت جديد.
- [x] UI الحالية محفوظة؛ لا تغييرات Backend runtime/Models/Migrations/JWT v2/Permission Matrix/Bootstrap أوLegacy stubs. لا كلمات مرور قديمة في ملفات جديدة؛ نتائج Scanner الحالية والManifest في تقرير T2.
- [x] Gitleaks v8.30.1 بعد integrity/synthetic redaction/template verification: **28 ملفًا، 0 Findings**؛ فحص وثيقتي التسليم النهائي إضافي دون تغيير العدد الفريد. Manifest مطابقة Git وStaging فارغة وgit diff --check ناجحة؛ لا raw secrets أو.env reads.
- [x] الحالة **Ready for Development Checkpoint Review** ضمن العزل المحلي فقط. JWT/sessionStorage مؤقتة، Logout محلي ولا Revocation؛ Demo retirement Unresolved وF2/B/C وبقية Production gates باقية. Email link formatter والتسليم الحقيقي إلى D؛ i18n/RTL/Design System/Router إلى T3.

### 10.10 A5-T2 Final Development Checkpoint Review

- [x] Branch/Remote/HEAD مطابقة، و9 Modified +19 New =28 دون Staging. Manifest مطابقة، والوثائق داخلbackend/docs الصحيح دون نسخ إضافية؛ لاحفظ فيGitHub.
- [x] مراجعة الملفات وعقودA2/A3 وJWT v2 والاستعادة وGeneration وScoped gateway والمنح وقبول الدعوة. Backend runtime وModels/Migrations وPermission Matrix وBootstrap وLegacy stubs وDependencies دون تغيير؛ لاPublic Signup أوAuto-login.
- [x] **R-T2-01:** كانت أعطالLogin برمزي503 و408 تصنف كخطأ اعتماد. RED ثمGREEN؛ التصنيف النهائي يحفظ408/429/500/503 كعدم توفر دون تفاصيل، مع401/422 و403 المستقلة. اختبارات التبديل مع pending success/401 لمستخدم آخر داخل المؤسسة نفسها أوإلى مؤسسة أخرى نجحت؛ لا إصلاح إنتاجي إضافي لهذا السلوك الصحيح.
- [x] مجموعةBackend الواسعة من18 ملفًا: **426 Passed /0 Failed /1 Skipped /23 Deselected /552.55s**؛ منها **262 PostgreSQL Passed /0 Skipped** و164 unit/memory Passed +1 Skipped.
- [x] جردCollect-only حدد18 Legacy invocation وخمس حالات تحملbootstrap فيالاسم/البيانات. مراجعتها أثبتت أنهاConstraints وFixture membership فقط دونBootstrap invocation. أُكملت منفصلة فيCluster جديدة: **5 Passed /0 Failed /0 Skipped /176 Deselected /40.56s**، منها4 PostgreSQL و1memory. الحالات الخمس لا تتداخل مع426؛ و176 مجرد فلترة بقية ملفات التشغيل الثاني. يبقى18 Legacy invocations غير منفذة عمدًا.
- [x] Skip الوحيدةSQLite Collation ونسختهاPostgreSQL ناجحة. حواجزT1 وChild env allowlist ومفتاح اصطناعي ومنعdotenv/read/driver/target والملكية محفوظة. انتهى التنظيف وثبت غيابRun roots. جردCollection تعثر فيحذف مجلد فارغ تحتSandbox ثمأعيد ونُظف المسار المحدد دونDB أوACL changes؛ ليس فشل اختبارBackend.
- [x] Browser النهائية: **1 pytest Passed /0 Failed /0 Skipped /27.06s** تغطي **13 سيناريوًا** علىEdge headless بملف تعريف جديد وFastAPI/PostgreSQL حقيقيتين معزولتين. شُملت استجابةHTTP حقيقية معلقة عبرCDP ثمLogout/Login لمؤسسة أخرى قبل تحريرها، دون ظهور بيانات قديمة. لاMock Authentication أوResponse bodies؛ تحكم الأعطال وStorage والعضوية للاختبار فقط.
- [x] Frontend النهائية: **35 Passed /0 Failed /0 Skipped /539.70ms**؛ App/Tests/Vite config Typecheck وBuild **281ms** وLint **0 Errors /0 Warnings**. المخرجات مؤقتة معenvDir=false دون تعديلdist أوDependencies. لا فشل نهائي غير محسوم؛ نتائج33/303 السابقة تاريخية.
- [x] Gitleaks v8.30.1 بعد سلامة الحزمة وChecksums وexe واختبارSynthetic redaction/template: **28 ملفًا، 0 Findings**، مع إعادة فحص وثيقتي التسليم. Python AST/UTF-8 وdiff check وManifest ناجحة؛ لا قيم سرية أوملفات بيئة/أرشيفات ضمن المدخلات.
- [x] **Ready for Development Checkpoint** ضمن التطوير الاصطناعي المعزول فقط؛ ينتظرGit اعتمادًا جديدًا. Demo retirement Unresolved وF2/B/C وبقيةProduction gates مفتوحة؛ Logout محلي وsessionStorage مؤقتة، وQA/i18n/RTL/Router/Design System إلىT3.

### 10.11 A5-T3 — التنفيذ والاستئناف والتحقق المحلي النهائي

- [x] React Router Data Mode وNested protected layouts وPermission navigation وSafe redirects وLazy business adapter، بلا Auth fetching مكرر أوتغيير JWT/Matrix/Client policies.
- [x] Obsidian & Sage وخط Readex Pro محلي وSemantic tokens وar-SA/en وRTL/LTR وLight/Dark وصفحات Auth وShell متجاوبة. صفحات الأعمال لم تفكك؛ محتواها الإنجليزي معلن إلى T4.
- [x] Frontend: **44 Passed /0 Failed /0 Skipped**، منها 9 Presentation؛ Typecheck وProduction Build ناجحتان، Lint **0 Errors /0 Warnings**؛ git diff --check ناجح.
- [x] Relevant Backend: **304 Passed /0 Failed /1 Skipped /2 Deselected**، ثم إكمال المستبعدتين بالاسم فقط: **2 Passed /0 Failed /0 Skipped /134 Deselected** بعد إثبات عدم تشغيل Bootstrap. الحصيلة غير المتداخلة 306 Passed، منها 197 PostgreSQL و109 Unit/in-memory. Skip للـcollation على SQLite، ونسختها PostgreSQL ناجحة.
- [x] Browser production preview محلي: **2 pytest Passed**؛ T2=13 سيناريوًا وT3=52. إعادة T3 للتباين: 52 ناجحة دون إضافتها للعدد. مصفوفة 40 تخطيطًا و20 axe runs مع 0 Violations؛ Incomplete واحد لعنوان Dialog، تحقق إضافي: 17.445:1 وvisible/unobscured ولقطة مراجعة. لا ادعاء WCAG أوScreen Reader شامل.
- [x] Keyboard regression: RED عند Shift+Tab عبر حدود native dialog؛ Boundary wrap ثم GREEN، مع Escape وعودة التركيز وReduced motion. إصلاحات Harness (Enter/CORS/encoding) موثقة ولا تُحسب نجاحًا للتطبيق قبل الإصلاح.
- [x] حواجز Isolation من T1/T2 محفوظة؛ dotenv محظورة، Clean env، وPostgreSQL18.4 جديدة على loopback وملكيتها مثبتة، وHTTP حقيقية مع Fixtures اصطناعية. لا قاعدة قديمة أوLegacy/Bootstrap/Production writes. موارد الجولات منظفة وArtifacts اصطناعية خارج Git.
- [x] Dependencies exact: react-router 7.18.5، i18next 26.6.0، react-i18next 17.1.9، Readex Pro 5.3.0، وaxe-core 4.14.0 للتطوير. روجعت Compatibility/Licenses/Lockfile integrity؛ لا تغيير لإصدارات الحزم السابقة أواعتماديات إضافية.
- [x] Gitleaks8.30.1 موثقة وسابقة التثبيت: Synthetic redaction/template أولًا، ثم 57 ملفًا و0 Findings؛ 0 Known historical value matches. ليست إعادة History scan أوإثبات تقاعد Demo. أُعيد الفحص النهائي للملفات الـ57 ثم لوثيقتي التسليم؛ 0 Findings.
- [x] Manifest: **19 Modified +38 New =57** في تقرير T3؛ Staging فارغة وHEAD a89468f محفوظ. لا .env/ZIP/Build/Dependencies/Scanner/Artifacts ضمنها. **Ready for Development Checkpoint** فقط؛ لا Commit/Push أوT4، ومخاطر Legacy/F2/B/C/D باقية.

### 10.12 A5-T3 Final Visual Review & Premium Motion Refinement — 2026-11-02

- [x] حافظت المراجعة على Obsidian & Sage وLogin المعتمدة دون إعادة تصميم T4. Motion tokens=160/200/240ms مع Reduced Motion وEntry only؛ لا Exit snapshots أوMotion dependencies أوتأخير Navigation.
- [x] RED→GREEN: التركيز التلقائي كان مصدر إطار Main، لا form border؛ حُذف أول تحميل فقط وبقي Skip Link/Keyboard focus. تهيئة Presentation قبل Entry JS تمنع theme flash وتقرأ مفتاحين غير سريين فقط. صححت وحدات CSS الزمنية بعد minification، وطبقة compatibility بعد Legacy تمنع الهيدر المكرر وتثبت44px. تنقل الهاتف الجديد لا يحتفظ بإزاحة الصفحة القديمة؛ POP لا يُجبر إلى الصفر ولاStorage إضافية.
- [x] Frontend **46 Passed /0 Failed /0 Skipped**؛ Typecheck وProduction Build98 modules وLint0 Warnings/0 Errors ناجحة. Browser مشتركة **2 Passed /0 Failed /0 Skipped /0 Deselected،62.85s**، تغطي13 Auth و62 Presentation؛ **80 layout combinations** عبر4 صفحات×5 مقاسات×لغتين×ثيمين. لا جمع مع الجولات المتداخلة.
- [x] axe: **36 فحصًا، 0 Violations**؛3 Incomplete لعنوان Drawer الإنجليزي. تحقق إضافي من ألوان العرض والظهور وعدم الحجب يثبت13.759:1 و17.445:1؛ لا ادعاء WCAG شامل أوScreen Reader يدوي. Business legacy مستثناة من4 فحوص axe الخاصة بـShell، واستكمالها إلىT4.
- [x] طلب Tenant معلق لا يعيد بياناته؛ Shell القديمة منفصلة من أولrAF بعد Logout. AuthStore/Provider/Client/JWT/Matrix/Models/Migrations دون تغيير. Backend Regression306 Pass/1 Skip دليل سابق لم يُعد هنا؛ HTTP/PostgreSQL المعزولة الحالية فعلية بحواجزT1/T2.
- [x] Dependencies/Lockfile/Readex OFL دون تغيير في هذه المراجعة؛ لا Install جديدة. Theme shifts=0 في العينة المحلية؛ Entry Opacity/Transform فقط، ولا ادعاء60fps أوCore Web Vitals.
- [x] Gitleaks8.30.1: **58 ملفًا،0 Findings** مع توثيق binary integrity وsynthetic detection/redaction/template؛ أعيد فحص الوثيقتين بعد الخلاصة. Manifest58 مطابقة، Staging فارغة، diff/UTF-8/Python AST ناجحة، وجذور الاختبار النهائية المملوكة منظفة. **Ready for Development Checkpoint** فقط؛ انتظار اعتماد المالك. Legacy/F2/B/C/D باقية؛ لا Commit/Push أوT4 أوDeployment.

### 10.13 A5-T4 / T4-A — Architecture & Contracts Review — 2026-11-02

- [x] Baseline48c1e8e والفرع/Remote صحيحان و Working Tree نظيفة عندالبدء؛ master10faab20 دونتغيير. قراءة T1/T2/T3 وطبقات Auth/Router/Shell/Client والعقودالفعلية.
- [x] جرد 54 function و 84 useState و 8 useEffect/8 useEffectEvent في App5227 سطرًا؛ 56 registered handler ، مع Permissions/Tenant/DTO/State/Error/Owner/Target وتصنيف Safe/Security-Limited/Missing/Deferred.
- [x] T4-A docs-only: لا API جديدة أو Models/Migrations أو JWT/Matrix changes أو Dependency install. Shared transport/session الحالية كافية؛ Runtime decoders و same-binding latest-request protection مطلوبة مع أول consumer في T4-B ، وليستمنفذة الآن.
- [x] Frontend46 Passed ؛ Typecheck/Production Build98 modules/Lint0 Warnings/0 Errors ناجحة. Backend relevant21 Passed/0 Failed/0 Skipped/0 Deselected ، منها 19 PostgreSQL و 2 unit ؛ ليست Full Backend Regression306 التاريخية.
- [ ] Browser Regression Gate غير ناجحة؛ الجولة المشتركةالأولى 1 Passed/1 Failed (Auth4 pass ثم pending-response-tenant-switch fail ، Presentation62 pass). إعادة Auth منفردةسجلت 13/0 في metadata ؛ الجولة المشتركةالثانية 1 Passed/1 Failed مع Auth13/0 و Presentation62/0 لكن Auth process exit غيرصفر. لاتجمعالجولاتالمتداخلة ولاتعد Metadata وحدهانجاح pytest. التفاصيلوالتشخيصفيتقرير T4.
- [x] الفجواتموثقة: RiskGLOBAL/missing→0 و aggregates غير latest ؛ CAB/implementation writes مؤجلة C ؛ maildelivery/sessionrevocation/F2 إلى D ؛ businesscasts و same-session query race و UTC و encodedslash query قبلالنقل. لا تصنيفجديدلأسرارقديمةبلادليل.
- [x] Gitleaks8.30.1 النهائية: وثيقتان،0 Findings و0 historical literal matches؛ integrity وsynthetic detection/redaction/template ناجحة. diff check ناجحة؛ Manifest1 Modified+1 New وStaging فارغة. لاT4-B أوGit writes.

### 10.14 T4-A Browser Regression Investigation — 2026-11-02

- [x] Baseline والوثيقتان الحاليتان محفوظتان؛ لا مصدر تطبيقي أواختبار أوتبعية متغير. لا Reset/Clean/Checkout/Stash أو Git writes.
- [x] Reproduction matrix محدودة: Auth وحدها 1 Passed/46.27s ؛ Presentation وحدها 1 Passed/65.24s ؛ Auth→Presentation2 Passed/107.84s ؛ Presentation→Auth2 Passed/105.38s. جميعها 0 Failed/Skipped/Deselected ، و Auth13/Presentation62 scenarios حيثينطبق، و Node exit0 بلا stderr.
- [x] جولة observer مشتركة:2 Passed/0 Failed/0 Skipped/0 Deselected/72.15s ؛ Auth0 CDP/JS/Console/uncaught errors ؛ Presentation0 CDP/JS/uncaught و Console event واحدةغيرمصنفة. Network cancellation و blocking counters موثقة دون values أو URLs. ليستدليلًا علىغياب Race تحتتوقيتآخر.
- [x] محاولة observer preparation منفصلة:2 pytest Failed قبلبدءالسيناريوهات،لامخرجات A5_BROWSER_METADATA ، 32.84s. تصحيحتحميلالأداةالمؤقتة إلى file URI ، دونتغييرالمشروع؛ ليستإعادةإنتاجللحادثةالأصلية.
- [x] Frontend46 Passed/0 Failed/0 Skipped و app/test/node Typecheck/Build98 modules/Lint0 warnings0 errors ناجحة. Relevant Backend181 Passed/0 Failed/1 Skipped/0 Deselected/197.05s:105 PostgreSQL و 76 Unit/Memory ؛ skip للـ SQLite collation case فقط، PG counterpart passed.
- [ ] **Root Cause Unresolved / incident gate open.** لا Application/Infrastructure fix ، ولااختبار RED/ادعاء GREEN لإصلاحغيرموجود. الفشلانالتاريخيانفي 10.13 والقسم 8 من T4 محفوظان؛ نجاحالجولاتالحاليةلايثبتسببهما أوإصلاحهما. لا T4-B دونحسمومراجعةالمالك.
- [x] الفحص النهائي Gitleaks8.30.1: وثيقتان،0 Findings و0 historical literal matches؛ integrity وsynthetic redaction/template ناجحة. diff check وUTF-8/Markdown tables ناجحة؛ جذور الجولات السبع المملوكة منظفة. Manifest وثيقتان فقط وStaging فارغة.

### 10.15 T4-A Conditional Gate & Browser Diagnostics — 2026-11-02

- [x] Architecture approval مبدئية فقط؛13 ملفًا (7 Modified+6 New) تشملالوثيقتينالمحفوظتين وTest Infrastructure/schema/tests؛0 application source changes.
- [x] RED→GREEN لميزةالرصد:7 Node tests و8 Python tests؛sensitive-field/identifier rejection،mutated errors،legacy summary،Windows actual exit،missing summary،timeout/cleanup وتصنيفfirst-failed motion predicate. ليستإصلاحًا للحادثةالتاريخية.
- [x] Frontend53 Passed/0 Failed/0 Skipped وTypecheck app/test/node وBuild/Lint0 warnings0 errors. Backend189 Passed/0 Failed/1 Skipped/0 Deselected،288.41s:105 PostgreSQL و84 Unit/Memory؛skip نسخةSQLite منcollation فقط،PG counterpart ناجحة.
- [ ] Browser Gate **Blocked**: InitialAuth Startup0 Passed/1 Failed،31.70s،Runner Failure وBrowser Cleanup Timeout؛Auth retry1 Passed/13 scenarios،48.34s؛InitialPresentation0 Passed/1 Failed عندP02،29.56s،Test Assertion؛Presentation predicate retry1 Passed/62 scenarios،79.77s. Combined النهائية1 Passed/1 Failed،103.12s: AuthA05 نجحتثمA06/role-change/wait فشلتبـevaluation_error (Nodeexit1)،Presentation62/62 (Nodeexit0). جميعteardowns فيCombined ناجحة. لاRCA تخمينية ولاAssertion/Sleep changes؛لاتغلقretry النتائجالفاشلة.
- [x] Metadata فقطبـfinite allowlists؛actualNode exit منPython وFastAPI/fixture cleanup records. 5 مجلداتArtifacts خارجGit،6 JSON metadata files و834 canonical records،0 account images/DOM/network traces؛لاraw values.
- [x] Gitleaks8.30.1:13 files،0 Findings و0 historical literal matches؛integrity وsynthetic redaction/template ناجحة. Final diff/cleanup/manifest verification ناجحة؛13 file manifest مطابقة وowned run roots منظفة. Staging فارغة؛لاCommit/Push/PR/Deployment/master change.
- [ ] HIST-AUTH-01 Open/Unresolved؛DIAG-START-01 وDIAG-PRES-02 وDIAG-AUTH-06 Open. يلزم مراجعتها وتحديد سببA06 قبلقرارRead-only T4-B؛لاجاهزيةحالـيةللانتقال،واعتمادCheckpoint وبدءT4-B قرارانمنفصلانللمالك.

### 10.16 T4-A Targeted Browser Failure Investigation — 2026-11-02

- [x] Baseline48c1 و7 Modified+6 New محفوظة،ومراجعةالتقاريروالاختباروالسياسات؛لاReset/Clean/Checkout/Stash.
- [x] Safe diagnostics موسعةبـexception names وdocument/default-context/target/browser state وbrowser child exit،وA06 operation IDs. bounded failure-only DOM sampler بعدإشارةجديدة؛لاraw JS/stack/DOM/URLs/headers/tokens/bodies محفوظة. Backward-compatible defaults لا تخترعبياناتتاريخية.
- [x] TDD للـdiagnostic extension:10 Node instrumentation tests و9 Python tests. Frontend56 Passed/0 Failed/0 Skipped وTypecheck/Build/Lint0 warnings0 errors؛Backend190 Passed/0 Failed/1 Skipped/0 Deselected،292.95s،105 PostgreSQL و85 Unit/Memory. Skip نسخةSQLite منcollation فقط،PG counterpart ناجحة.
- [x] Auth كاملة1 Passed/45.45s؛Presentation كاملة1 Passed/61.11s؛Auth→Presentation1 Passed/1 Failed/111.47s عندA06/verify-dialog-ready/condition timeout؛Presentation→Auth2 Passed/103.68s؛إعادةموجهةAuth→Presentation2 Passed/71.16s. جميعالجولات0 Skipped/0 Deselected؛لاتجمعالأعدادالمتداخلة.
- [ ] A06 **Unresolved**: المحاولةالحاليةانتظرتحوارالتأكيدولمتجدهضمنالحد؛document/context/target متاحةقبلأولfailure. لمتعدevaluation_error السابقة،ولايمكنتعيينعبارتهاالقديمةبأثررجعي. P02 وStartup لم تعاد إنتاجهما؛لاRoot Cause مؤكدةولاProduction/Test-flow Fix تخمينية.
- [ ] **Decision C — Unresolved / Blocked**. نجاحالإعادةليسClosure؛لاReady أوCheckpoint أوT4-B تلقائيًا. HIST-AUTH-01 وDIAG-AUTH-06/PRES-02/START-01 Open.
- [x] Gitleaks8.30.1:13 files،0 Findings و0 historical literal matches؛integrity وsynthetic redaction/template ناجحة. diff/UTF-8/AST/JSON/Node syntax/tables وmetadata audit ناجحة؛5 artifact directories و8 metadata files و2290 canonical rows،0 صور/Traces خام؛0 owned test-run roots متبقية. Staging فارغة،والفرع/HEAD/master محفوظة؛لاGit writes أوDeployment.

### 10.17 A06 State Transition &403 Recovery — أحدث نتيجة

- [x] Baseline7M+6N وHEAD/branch/origin محفوظة؛لا Application/Auth/JWT/Permission Matrix/Models/Migrations changes. ثلاثة ملفات اختبار جديدة تفسر Manifest16: a06Probe.mjs وa06Recovery.mjs وtest_a5_a06_recovery.py.
- [x] رصد opt-in داخل test build فقط: fixed handler/state/dialog/403/recovery/permission-change event IDs؛لا raw session/DOM/JS/stack/URL/token/permission values. MutationObserver يميز unmount/remount؛Normal production build دون plugin.
- [x] Control/Exposure مع FastAPI/PostgreSQL/Edge حقيقية اصطناعية: old helper نجحت Control وفشلت Exposure في verify-dialog-ready بعد403→Recovery→Unmount→current grants→Forbidden. العقد القائم يخفي Shell عندchecking ويعيدها عندbinding جديدة؛لا Contract Gap أوسياسة جديدة لهذا dialog.
- [x] Test Harness فقط: terminal secure state أوmodal control،فحص ذري قبلclick،تأكيد يدوي واحد عند الحاجة،ثمassertion strict؛غياب control وحده يفشل. Unit RED12/2 ثمGREEN14/0؛final focused2/2 وAuth13/13 وCombined13/13+62/62،exit0 وcleanup passed؛لا جمع للنتائج المتداخلة.
- [x] Frontend60/0 وTypecheck/Build/Lint0 warnings0 errors. Relevant Backend190 Passed/1 Skipped/0 Failed/0 Deselected،314.99s؛105 PostgreSQL و85 Unit/Memory. Skip SQLite collation فقط ونسخةPG ناجحة؛Gitleaks8.30.1:16 files،0 Findings و0 historical literal matches؛integrity وsynthetic redaction/template ناجحة. diff check ناجحة؛صفر owned processes/run roots متبقية؛metadata-only artifacts خارجGit؛تفاصيل تقريرT4 §14.
- [ ] **A06 B محليًا؛Overall C — Unresolved/Blocked.** أول GREEN خارجSandbox واجه browser cleanup timeout مستقلة رغم اكتمالControl؛لم تُخف أوتعتبر retry اللاحقة إصلاحًا لها. P02/Startup/evaluation_error التاريخية غير المنسوبة تبقىOpen. لا Production claim أوReady شامل.
- [ ] لا Checkpoint أوT4-B الآن. إصلاحA06 جاهز للمراجعة؛يلزم disposition لمخاطر Browser lifecycle وقرار المالك المنفصل. تفاصيلExpected/Actual وstate diagram وArtifacts وManifest في [تقريرT4 §14](phase2_a5_t4.md).

### 10.18 Browser Cleanup Finalization — أحدث بوابة

- [x] Baseline48c1 و7 Modified+9 New وStaging فارغة؛ كل العمل السابق محفوظ. لا Application/JWT/Matrix/Models/Migrations/Dependencies changes.
- [x] رصد resource lifecycle بأربع حقول ثابتة وNode/Python allowlists. Instrumentation RED14/1→GREEN15/0، ثم cleanup RED15/2→GREEN17/0 بعمليتي Node child حقيقيتين مملوكتين؛ لاSecrets أوraw artifacts.
- [x] L1 Auth فشلت في A05/replacement-empty/dom_target_missing؛ L2 Presentation62/62 نجحت؛ L3 Auth13/13 نجحت ثم Startup read-debug-port فشلت بلاCDP وتبعتهاcleanup timeout؛ L4 P02 entry-no-progress فشلت ثمAuth13/13 نجحت. L5 الوحيدة بعد الإصلاح نجحت13/13 ثم62/62،exit0 وcleanup completed. لا جمع للجولات ولا closure عبرretry.
- [x] cleanup بدونCDP كانت تنتظر خروجًا لم تطلبه؛ أصلحت لإنهاء child المملوكة أولًا ضمن نفس الميزانية، مع signal-aware exit ورفض nonzero غير متوقع. فشل Startup الأصلي محفوظ؛ لا تغيير Policy أوAssertions.
- [x] Frontend63 Passed/0 Failed/0 Skipped وTypecheck/Build/Lint0 warnings/errors؛ Backend190 Passed/1 Skipped/0 Failed/0 Deselected،238.11s،منها105PG و85Unit/Memory. Skip نسخةSQLite collation فقط ونسخةPG ناجحة. لا عمليات أوrun roots مرصودة تطابق مسارات المهمة؛ حدود جرد descendants/handles معلنة في التقرير.
- [x] Gitleaks8.30.1:16 files،0 Findings و0 historical literal matches؛ integrity وsynthetic redaction/template ناجحة. diff/syntax ناجحة؛5 artifact directories و8 metadata files و1773 canonical rows،0 raw artifacts خارجGit. هذا لا يغلق مخاطر Credentials التاريخية.
- [ ] **C — Unresolved شاملًا.** Startup read error وP02 وA05 ومهلة post-functional السابقة غير مغلقة. A06 المثبتة وstartup-cleanup fix محفوظتان؛ Browser Quality Gate ما زالتOpen ولاProduction claim.
- [ ] **Investigation Development Checkpoint موصى بها للمراجعة فقط** لحفظ التوثيق والاختبارات والإصلاحات بعد موافقة Git صريحة. حفظها لا يعني Browser Gate passed ولا يؤهلT4-B تلقائيًا. لم تبدأT4-B ولم يُنفذGit write. الأدلة والقرارات الثلاثة وManifest في [تقريرT4 §15](phase2_a5_t4.md).

## 11. عوائق وحدود المعرفة وخطة إغلاقها

- **عائق استخدام قاعدة قديمة/Production:** نُفذ مسار A5-T1 الاصطناعي المعتمد مع إثبات العزل؛ لا إعادة تصنيف 21 موضعًا أوPRE-04 بلا دليل جديد. تقاعد Demo Unresolved ولا يجوز استخدام قاعدة قديمة قبل إثبات تقاعد أوDEMO-R1..R6 مصرح بها. Exposure للأسرار المحلية وتوزيع الأرشيفات غير محسومين؛ لا Rotation تلقائية أوإغلاق Risk/CAB/F2 بواسطة نجاح T1.
- لا بيانات تشغيل فعلية: لا عدد Tenants/Users/Systems، ولا Current migration revision للـDB المحلية/المستضافة، ولا جرد Rule conflicts/Legacy Hash costs. تُجمع بتفويض ومخرجات مجمعة قبل Cutover؛ لا تخمين أواتصال خفي.
- لا F2 Runner متاحة مثبتة لهذه المهمة؛ تجهيزها مسؤولية تشغيل معتمدة. لا تغيير ACL الجهاز كحل سريع.
- Provider Email/مفاتيح Gemini/Cloud hosting/regions/budget لم تعتمد؛ يمكن تنفيذ Interfaces وfake tests لاحقًا بإذن كتابة، ولا إثبات Real Integration دون الاختبار الفعلي المصرح.
- CAB quorum/SoD/roles وEmergency وLegacy Approved policy غير معتمدة؛ لا تبدأ C implementation قبل حسمها.
- Session persistence وlocale/timezone/project semantics تؤثر في UX/API/data؛ القرارات المسجلة تمنع اتخاذها ضمنيًا.
- Dependency advisory assessment وsupply-chain/licensing وLoad/Accessibility لم تجر في هذه المهمة؛ تُسند إلى Gates D/S8 وA5/S7.
- كمال المنتج يتطلب تنفيذ جميع الصفحات والاعتماديات؛ إعادة تصميم Dashboard أونجاح Build وحده لا يحقق المواصفات.

## 12. إدارة التقدم وCheckpoint والاستئناف

| المرحلة | الحالة الحالية؛ الأدلة السابقة محفوظة تاريخيًا | ما يمنع الانتقال |
|---|---|---|
| A1–A4 | Checkpoints موجودة؛ قبول Development فقط ضمن حدود التقارير | High B/C وF2 وبقية سجل المخاطر |
| Stage 0 | Audit/Plan مكتملتان؛ اتجاه الخطة والقرارات المحددة معتمدة | لا اعتماد Production أوباقي المراحل |
| Stage 1 A5 | T1/T2/T3 محفوظة؛T4-A Architecture معتمدة مبدئيًا؛A06 وstartup-cleanup fixes مثبتة محليًا | Overall C؛Startup/P02/A05 وpost-functional cleanup disposition؛يمكن اعتماد Investigation Checkpoint منفصلة دون فتحT4-B |
| Stage 2 B | Not started | اعتماد A5، وRisk/Migration design |
| Stage 3 C | Not started | B وCAB policy/Legacy treatment |
| Stage 4 D | Not started | C وSession/Email/F2 decisions |
| Stage 5–7 | Not started | Gates السابقة وFeature contracts/data/model approvals |
| Stage 8–9 | Not started | Integration/security evidence وoperations decisions |

بعد كل مرحلة يسجل التقرير: ما نُفذ، قرارات المعمارية، Files Changed، API/DB Changes، Security Findings، Commands/Passed/Failed/Skipped، المخاطر، Git status، والمرحلة التالية. إذا فشل Gate، تُصلح المرحلة نفسها دون بدء التالية.

**Development Checkpoint المعتمدة:** حفظManifest27 فيتقريرT4 §19.7 فوقمرجعالبداية`0ada30aba8d50b94180b305edcbc0c35fea4634e` بالرسالة`test(a5): establish playwright security gate for t4 development`،معPush للفرعالمعتمدفقط. SHA الفعليةفيGit وتقريرالتسليمبعدالتنفيذ؛السياسةالمعتمدةوحدودالحفظفيT4 §20. لاProduction Approval أوبدءT4-B ضمنالحفظ،ولا تغييرmaster.

**خطوة الاستئناف الدقيقة:** اقرأ تقريرT4 §20 وسياسةالقسم17 أدناه. **Playwright Security Gate = APPROVED for T4-B Read-Only Development**؛Security7/7 وPresentation4/4 وCombined11/11 بالترتيبين وBackend63/63 معتمدة. **T4-B: READY FOR SEPARATE EXECUTION APPROVAL — NOT STARTED**. CDP القديمةLegacy غيرمعتمدةللإصداروالfindings تبقىOpen؛لاFull Browser Suite Parity أوProduction Readiness. لايلزمتحقيقCDP جديددوندليلأمنيمؤثر،ولايبدأتنفيذالصفحاتتلقائيًا.

**التحقق التاريخي:** المراحل والمخاطر العشرة والقرارات الستة عشر محفوظة. Stage0/Preflight/Setup/Scanner في 10.1–10.6 تاريخية؛ T1 في 10.7–10.8 ، T2 في 10.9–10.10 ، T3 في 10.11–10.12 ، T4-A في 10.13 وتقاريرها. لا جمع لأعداد الجولات المتداخلة، و Skipped ليست نجاحًا.

**التوقف المطلوب بعد T4-A:** تقرير عربي و Manifest ونتائج صادقة، ثم انتظار اعتماد المالك؛ لا T4-B/C/D/E أو Git Checkpoint تلقائيًا. لا إغلاق Demo retirement/F2/B/C/D أو SEC-01..10 ، ولا Production claim أو Deployment/Rotation.


## 13. Investigation Checkpoint authorization — 2026-11-03

موافقة حفظ التحقيق في Git منفصلة عن Browser Gate وعن بدء T4-B. النطاق هو Manifest16 في تقريرT4 §14.8/15.6؛ Index صريحة وكامل staged blobs تخضع لـGitleaks دون قيم سرية قبل Commit. تحفظ findings المفتوحة ومخاطرDemo/B/C/D/F2/Session Revocation كما هي. رسالةCommit: `test(a5): document t4 architecture and harden browser diagnostics`. لاCommit SHA متوقعة قبل التنفيذ؛ النتيجة الفعلية في التقرير النهائي وسجل Git.

بعد حفظ Checkpoint: التوقف للمراجعة. الخطوة الهندسية الموصى بها عند تفويض لاحق هي تحقيق واحد في Startup DevTools port read بأكوادOS وحالات قراءة ثابتة منقحة، دون زيادةTimeout أوRetry أوفتحT4-B تلقائيًا.


## 14. Startup investigation current disposition — 2026-11-03

- [x] Baseline المحلي والبعيد0ada30aba8d50b94180b305edcbc0c35fea4634e وmaster10faab2 محفوظان؛Staging فارغة؛لاعملسابقغيرمتوقع.
- [x] startup/file/process/OS/error/duration allowlists وnumeric Python validation؛لاPID values أوprofile paths أوURLs/rawerrors/environment values محفوظة. إصدارEdge المحلي156.0.4314.58؛لا تثبيت أوتغييرarguments.
- [x] controlledMissing/Empty/Partial/Invalid/Valid،spawnENOENT،childexit7 قبلالملف،وWindows FileShare.None→EBUSY ثمunlock→Valid. الرصدخضعRED→GREEN؛ليستRootFix للفشلالتاريخي.
- [x] Auth13/13 وPresentation62/62 عبرHTTP/PG اصطناعيتين،Node/runner0 وcleanup completed. قراءتاالملفValid معprocess running،عند618ms و372ms؛CDP متصلةعند1118ms و755ms. لاreal startup failure أعيدت.
- [x] Frontend68 Passed/0 Failed/0 Skipped وTypecheck/Build/Lint0 warnings/errors؛Pythondiagnostics9 Passed/0 Failed/0 Skipped. لاFullBackend190 جديدة. Combinedلمتعمل لعدموجودRootFix مثبتة؛لاopen loop.
- [ ] **Root Cause UNRESOLVED؛Browser Gate OPEN / NOT PASSED؛T4-B NOT AUTHORIZED.** A05/P02/Startup/HistoricalCleanup باقية؛A06 وstartup-cleanup المعتمدانمحفوظان. لاAntivirus/Windows blame بلاEvidence،ولاfunctional fix تخمينية.
- [ ] Manifest9 Modified/0 New فيتقريرT4 §17؛التوقف للمراجعة دونGit writes. Gitleaks8.30.1:9 files،0 Findings و0 historical literal matches؛integrity وsynthetic redaction ناجحة. diff/syntax ناجحة؛0 owned rooted processes/run roots مرصودة،و2 metadata artifacts فقط؛الحدودفيالتقرير. المخاطرDemo/B/C/D/F2/SessionRevocation لا تتغير.

خطوةلاحقةموصىبهافقطعندتفويضجديد: استخدامالرصدالحالي عندإعادةالفشل لتحديدOS code وfile/process states قبلقرارreadiness condition أوغيره؛لازيادةTimeout أوRetry احترازي،ولابدءT4-B. حفظهذهالتغييراتغيرمعتمدفيهذهالمهمة.

## 15. Browser Harness Architecture Decision — أحدث قرار،2026-11-03

- [x] **A — Adopt Playwright Incrementally** فيTest Infrastructure فقط؛الحزمة1.63.0 مستقلةومثبتة،Node24.17.0 متوافقة،وChromium153 managed؛لا تعديلEdge أوApplication/JWT/Permission Matrix.
- [x] PostgreSQL schema/cluster وFastAPI اصطناعيتان معحواجزالملكية؛ORM create_all فقط،**لا Database Migrations** حتىفيCDP controls؛لاقراءة.env أواعتماداتفعليةأوMedia/Trace/HAR حساسة.
- [x] Pilot تغطيLogin/Recovery وA05 وA06 control/race وP02 وContext/Cookie/SessionStorage isolation والتنظيف؛identity/grants/403/404 وstale-response assertions إيجابية،لااختزالالأمانإلىإخفاءعناصر.
- [x] ثلاثجولات: R1 منفردة5 pytest passed/6 cases؛R2 أماميةfailed بسببP02 advanced=false معنجاحالأمانوالتنظيف؛R3 بعدانتظارAnimation events أمامية6/6 وعكسية6/6،2 pytest passed/128.48s،exit0 وbrowser exits0 وcontexts0. فحصالـP02 النهائيالموجه32.25s passed بعدحفظقياسopacity أثناءالحركة؛ليسجولةمقارنةإضافية.
- [ ] CDP Controls لمتجتزالبوابة: أمامية2 failed/75.98s (Auth13 نجحتثمcleanup timeout،PresentationP02 failed+cleanup timeout)؛عكسية1 failed/1 passed/53.89s (P02 failed،Auth13/13). لاRCA تخمينيةأوادعاءأنPlaywrightتمنعFlakiness.
- [x] Frontend68/68 وprivacy reporter2/2؛Typecheck app/test/config وBuild98 modules وLint0/0 ناجحة. Backendsubset17 passed/1 failed/0 skipped؛الفشل القائم`test_metadata_filter_does_not_echo_traceback_copies_of_browser_output` موثقفيتقريرT4 §18.8،لاFullBackendأوmigrations suites.
- [ ] **Browser Quality Gate = OPEN / NOT PASSED؛T4-B NOT AUTHORIZED.** نجاحPilot لايغلقStartup/A05/P02/HistoricalCleanup بأثررجعيولايثبتparity معAuth13+Presentation62. خطرDemo/B/C/D/F2/SessionRevocation محفوظ.
- [ ] خطةالمراجعةمحددة: نقلAuth معassertion map،ثمPresentation/layout/axe،ثمقبولparity/exit/cleanup/order قبلتبديلdefault؛القديميبقىحتىيثبتالبديل. تقدير8–14 يومعملمستقبلي،بلاعملإضافيهنا.

Manifest9 Modified محفوظة+9 New،Staging فارغة؛Gitleaks8.30.1 شملت18 files و0 Findings بعدintegrity/synthetic detection/redaction؛0 matching test processes و0 run roots متبقية. الحدودفيتقريرT4 §18.8. التوقفبعدالتقريروالقرار؛لاT4-B أوهجرةشاملةأوCommit/Push/Deployment. هذهالفقرةتحلالمحلخطوةالاستئنافالمقترحةفي§14؛نتائجهاالتاريخيةمحفوظة.

## 16. Playwright Security Gate — أحدث توصية جاهزية،2026-11-03

- [x] البداية0ada30a والفرعالمطلوب،9 Modified+9 New وStaging فارغة؛كلالعملالسابقمحفوظ،لاReset/Clean/Checkout/Stash أوGit writes.
- [x] **Backend failure RCA:** `tests/test_a5_runner_configuration.py::test_metadata_filter_does_not_echo_traceback_copies_of_browser_output` فشلتعند`assert metadata in result`؛fixture phase=workspace-login غيرمسموحة. أُعيدالفشلبـHEAD-only blobs دونPilot. إصلاحfixture إلىA02 فقط،مع3 رفضunknown phase،بلاFilter/Security Logic changes؛GREEN9/9.
- [x] **Relevant Backend63/63،0 failed/skipped،91.11s**؛43 PostgreSQL+20 Unit/Memory. Assertions الهوية/الدور/claims/foreign tenant/nested resources/count/search/notifications الأصليةمستضافةعلىORM-owned schema؛لاAlembic أوmigrations execution.
- [x] **Security Gate7/7**:Login/Recovery،A05،A06 control/race،Context/Storage isolation بمافيهاA13 memory-only،ProtectedRoutes/Forbidden،network/401/expiry boundaries. 403/404/megrants مثبتةبـBackend حقيقية؛لاDOM-only success.
- [x] **Presentation Gate4/4**:P02 RTL/LTR،1440/390،Axe وfocus وReducedMotion؛disabled/frozen negative faults ترفضهاassertion الإيجابيةنفسها. ليستترحيل62 سيناريوأوWCAG audit.
- [x] **Strict Runner**:missing/skipped/failed/unclean لايمربـexit0؛unknown gate أعادتexit1 فعليًا معcleanup. Frontend suite القياسيةتضمinfra unit tests الآن.
- [x] أولCombined:forward11/11،reverse10/11 وفشلsession-boundaries عندإلزامme401 والاشتراكمتأخرًا؛لميُخفالفشل. Probeواحدفشلكذلكعندانتظارمصدر401 محدد. التصحيحفيfixture:الاشتراكقبلdisable،401 authenticated حقيقيةثممسحsession/DOM،ومطالبةme برفضالتوكنالقديممباشرة. لاتوسعةtimeout/retry أوتغييرالتطبيق؛دقةتسلسلreverse الأولليستRCA كاملة.
- [x] **التحقق النهائي:**Security7/7 ثمforward11/11 ثمreverse11/11؛3 pytestpassed/0 failed/skipped،173.65s؛browser/runner exits0 وcontexts0 وcleanup passed. إعادةمحدودةبسببخللfixture الجديدالمحدد،لاتكرارإحصائيأوتحقيقمفتوح.
- [x] Frontend72/72،Typecheck app/test/config وBuild98modules وLint0/0؛diff/syntax ناجحة. Gitleaks8.30.1:27 files،0 Findings بعدintegrity/synthetic detection/redaction. 0 matching test processes/run roots/HEAD export roots مرصودة.
- [x] **Coverage equivalence لنطاقبدءT4-B Read-Only مثبتة** بمصفوفةتقريرT4 §19.5. A09/A10 invitation write workflows وبقيةPresentation62 لمتُنقل؛خارجالدفعة،وتبقىLegacy. Feature tests للـDTO/API/latest-request/loading/error والعزلومتطلباتالعرضتضافعندتنفيذصفحاتT4-B قبلقبولها.
- [ ] **التوصية:**اعتمادPlaywright Security Gate بوابةتطويرمستقبلية؛Security وPresentation scoped وCombined=PASS. **T4-B Read-Only READY FOR OWNER AUTHORIZATION،NOT STARTED**؛لا مانعفني مثبت متبقٍ ضمنالبدءالمختبر،والتنفيذيتطلبتفويضالمالكالمستقل.
- [ ] CDP Historical Findings تبقىOpen/Unresolved دونإغلاقبأثررجعي؛CDP Legacy coverage غيرمعتمدةللإصدار. لاProduction readiness أوإغلاقRisk/CAB/SessionRevocation/Demo/F2،ولاFull Backend/Migration parity claim.

Manifest الفعلية **11 Modified+16 New** فيتقريرT4 §19.7؛HEAD وmaster محفوظتان،Staging فارغة. التوقفبعدالتقرير؛لاT4-B أوهجرةكاملةأوCommit/Push/PR/Merge/Deployment. هذاالقسمهوأحدثقرار؛حالاتالحظرالأقدمفي§§14–15 وT4 §18 تبقىسجلًاتاريخيًاولا تُنسبإلىنتيجةالبوابةالجديدة.

## 17. Approved Playwright Development Gate & Git Checkpoint — 2026-11-03

**Playwright Security Gate = APPROVED for T4-B Read-Only Development.** اعتمادالمالكصريحللبوابةولـCommit واحدةوPush لحفظManifest27؛لايشملتفوّيضتنفيذT4-B أوRelease/Production Approval. هذاالقسموتقريرT4 §20 هماالسياسةالأحدث؛التوصياتوالقيودالتاريخيةفيالأقسامالسابقةمحفوظةكسجل.

كلصفحةجديدةتتطلب **Real Backend Integration،Tenant Isolation،Permission Enforcement،Runtime DTO Validation،Stale Response Protection،Loading/Empty/Error States،RTL/LTR،Responsive UI،Accessibility،Relevant Playwright Regression**. Security Gate كاملة،وPresentation علىالوظائفالمتأثرة،وCombined عندتغييرAuth/session/resource lifecycle وقبلقبولدفعةأوCheckpoint. لاتنجحالبوابةباستبعادفشلدونبديلمتكافئموثق.

أدلةالقبولالمعتمدة:Security7/7،Presentation4/4،Forward11/11،Reverse11/11،Backend63،Frontend72،Typecheck/Build/Lint Passed،Gitleaks27files/Zero Findings وCleanup Passed. مراجعةالحفظلمتغيرسلوكالكود؛تحديثوثيقتيالسياسةوإزالةسطرEOF فارغزائدفيfixtures.mjs فقط،معإثباتفرقwhitespace وفحصsyntax،لذلكلاتُعادالاختباراتالطويلةدونسبب. يُفحصالـIndex صراحةوتُمسحStaged Blobs بـGitleaks قبلCommit؛أيمشكلةأمنيةجديدةأوتغيرغيرمتوقعيوقفالحفظ.

Commit المصرح بها:`test(a5): establish playwright security gate for t4 development`،ودفععاديفقطإلى`origin/feature/phase2-batch-a-tenant-security`؛لاForce/Amend/Rebase/PR/Merge أوتغييرmaster. SHA وRemote HEAD وclean tree تُثبتفيالتقريرالنهائي. Manifest27 فيT4 §19.7؛لاnode_modules/Binaries/Media/Traces/HAR/DB dumps،ولاProduction Auth/JWT/Permissions أوModels/Migrations changes.

Historical CDP Findings **Open/Unresolved**،والـCDP Harness واختباراتها محفوظةLegacy غيرمعتمدةللإصدار. **Full Browser Suite Parity وProduction Readiness غيرمتحققتين**؛المخاطرRisk/CAB/SessionRevocation/Demo/F2 والحدودفيT4 §§19–20 محفوظة. لاتُفتحتحقيقاتCDP قديمةإلابدليلأمنيجديدمؤثر.

**T4-B: READY FOR SEPARATE EXECUTION APPROVAL — NOT STARTED.** التوقفبعدالحفظوالدفعوالتقرير. لاT4-B/C/D/E أوBatch B/C/D الأمنيةأوMigration/Deployment/Credential changes ضمنهذهالمهمة.
