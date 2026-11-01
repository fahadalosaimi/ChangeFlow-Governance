# A5-T3 — Obsidian & Sage, Routing & Localization Implementation Plan

> **For Codex:** After plan review and authorization, implement this plan task-by-task using the available native tools. Checkboxes record verified work. No external framework sub-skill is required. No Commit/Push orA5-T4 without separate approval.

**Goal:** تنفيذ أساس واجهة مؤسسية عربية/إنجليزية قابلة للصيانة، مع مسارات فعلية وDark/Light وتجربة متجاوبة، دون تغيير عقود الأمان أوتفكيك ميزات الأعمال قبلT4.

**Architecture:** React Router Data Mode بترتيب Root → Auth boundary → AppLayout → Home أوTransitional Business Adapter. AuthStore/Provider وClient منT1/T2 مصدر الجلسة الوحيد؛ لاAuth fetch فيRouter loaders. المسارات تحدد المنح وعناوين الترجمة، وApp القديمة تتلقى view/id/navigation عبرالمحوّل. i18next/react-i18next بموارد محلية منظمة؛ تفضيل اللغة والثيم فقط فيlocalStorage، مع بقاءJWT فيmemory/sessionStorage وفقT2.

**Tech Stack:** React19/TypeScript6/Vite8 الحالية؛ إضافة محدودة ومثبتة الإصدارات لـreact-router وi18next/react-i18next وخطReadex Pro المحلي المرخصOFL. لاUI framework أوMotion library جديدة؛ CSS وnative dialog وSVG icons صغيرة. التوافق والإصدارات الدقيقة تسجل قبل التثبيت.

**Spec:** موافقة المالك «A5-T3 — Premium UI/UX, Routing, Localization & Responsive Design»، المرفق5151bea5-64e5-40c1-9ca3-adb7173e6b0b. Repository bigest11/ChangeFlow-Governance، Branch feature/phase2-batch-a-tenant-security، baseline a89468f82c3edbb0d252dd2788e243e162358524. Working Tree نظيفة قبل هذه الوثيقة. T1/T2 ومخاطرهما أدلة تاريخية محفوظة.

## Global Constraints

- A5-T3 فقط؛ لاA5-T4 أوB/C/D/Gemini أوBackend business APIs/Models/Migrations/JWTv2/Permission Matrix changes.
- لا.env أوSecrets فعلية أوDB قائمة أوRotation أوLegacy/Bootstrap invocation. اختباراتHTTP/PostgreSQL بموارد جديدة وحواجزT1/T2؛ لاMigration علىDB موجودة.
- لاCommit/Push/PR/Merge/Force Push أوتعديلmaster أوDeployment/مزود استضافة/GitHub deployment wiring.
- ar-SA افتراضية، en اختيارية؛ حفظPreferences غير السرية فقط. Invitation Fragment تزال قبل إنشاءRouter، ولاToken فيURL/History state/Logs/Analytics.
- Login/Recovery/Generation/Scope وLogout المحلي محفوظة؛ لاServer revocation أوRefresh flow مختلقة.
- صفحات الأعمال الحالية محتواها بالإنجليزية داخلمنطقةlang=en/dir=ltr معلنة، إلىT4؛ ترجمةAuth/Shell/الحالات وعناصرT3 كاملة. لاIDs/Emails/Enums مترجمة فيالنقل.

## Review Focus

1. Router navigation وBack/Forward/Deep link أثناءRecovery أوLogout أوطلبTenant قديم: لاSession resurrection أوعرض بيانات سابقة.
2. Invitation hash داخلنفس الوثيقة: capture/strip تسبقRouter state؛ تغييرالرابط يمسحForm state القديمة.
3. Language/theme storage blocked أوتالفة: Defaults آمنة وتحذيرمحلي دونتعطيلAuth أوالعودة إلىToken فيlocalStorage.
4. قائمةMobile أوDialog: Focus trap وEscape وعودةالتركيز، بدونعناصرخلفية قابلةللتفاعل أوoverflow عند360px/Zoom.
5. Legacy CSS/lazy chunk: لاglobal blue/body overrides أوتحميلApp الثقيلةفيصفحةالدخول/Overview؛ فشلChunk يعرضحالةمترجمةدونRaw error.

## Design direction — reviewed against the brief

**Palette:** Obsidian #151A18، Deep Forest #28352F، Sage #B8F28B، Warm Sand #D9C8A9، Soft Ivory #F4F1E8. Light surface قريبةمنالعاجي وDark surface غابية؛ Semantic tokens للحدودوالنصوالأزرار، معألوانRisk مستقلةونصوأيقونة.

**Type:** Readex Pro Variable للعربيةواللاتينية، استضافةمحليةOFL-1.1، font-display:swap وأوزان400/500/600/700 علىمحور160–700؛ جدول/رموزbdi والأرقامtabular. عناوينهادئةونصأساسي16px وخطوططويلةمحدودةالطول. لاExternal font/CDN requests فيRuntime.

**Layout:** Shell بثلاثمناطق: Navigation جانبية (تنتقلإلىDrawer/Mobile navigation)، Topbar للسياقوالتفضيلات، ومنطقةصفحةواحدة. Authentication إطارتحريريمنقسم معمسارflow هندسيبسيط، وليسLanding Page أوMetric cards مزيفة. Home دليلعملللصلاحياتوالسياقالمتحققمنme؛ لاBusiness metrics مختلقة.

```text
Desktop (logical order follows document direction)
┌ Navigation ┬ Workspace context · Preferences · Account ┐
│ Work areas │ Breadcrumb / Page heading                 │
│            │ One routed page                           │
└────────────┴───────────────────────────────────────────┘
Mobile
┌ Menu · Brand · Account ┐
│ Heading / Page content │
│ Drawer when requested  │
└ Primary destinations ──┘
```

**Critique:** استُبعداقتراحمهارةUI للـHero/Features/CTA وPink/Wellness typography لأنهلايلائممنتجالحوكمةأوالهويةالمعتمدة. الشخصيةفيوضوحTypography وشكلflow وسياقالمؤسسة؛ لاGradient cards أوأرقامزائفةأوMotion زخرفية. لايُضافScope إلىB/C تحتغطاءالتصميم.

## Tasks, Files & Quality Gates

- [x] **T3-1 — Dependencies & RED:** مراجعةمصادراصليةوMetadata للإصدارات/engines/peerDeps/licenses؛ تثبيتالمطلوبفقط معignore-scripts/no-audit/no-fund، دونترقيةالبقية. Tests قبلحساسيةRouting/preferences/i18n/formatters.
- [x] **T3-2 — Foundations RED→GREEN:** `src/localization/{index,resources,formatters}.ts` و`locales/{ar-SA,en}.json`؛ `src/preferences/`؛ `src/styles/{tokens,global}.css`. اختباراتDefault ar-SA،Lang/Dir،Preference failures،Key parity/usage وplural/date/number وcontrast.
- [x] **T3-3 — Routing RED→GREEN:** `src/app/{router,routes,AppProviders,ErrorBoundary}`، وتحديثruntime/safeRedirect/AuthRoot/main. Explicit route metadata وNested guards وlazy imports وsafe return، دونduplicated Auth fetching. Home و404/403/Recovery حالاتحقيقيةمترجمة.
- [x] **T3-4 — Design System & Shell:** `src/components/ui/` وnavigation و`src/layouts/`؛ Sidebar/Topbar/Mobile drawer/Breadcrumbs/User context/Theme/Language وnative dialogs/toasts/status/skeletons. Semantic colors وRisk text/icon وKeyboard/focus/reduced motion.
- [x] **T3-5 — Authentication & Adapter:** إعادةشكلوترجمةLogin/Invitation دونتغييرالعقد. App.tsx تغييراتمحدودةللـview/id/callback فقط، وCSS القديمةمعزولةومرتبطةبالثيم؛ التفاصيلالعميقةتحميلID فعليمعScope guard. لاFeature extraction أوميزاتجديدةT4.
- [x] **T3-6 — Real Browser QA:** توسيعHarness المعزولةفيfrontend/e2e وbackend/tests فقط؛ حفظاختباراتT2 وجولاتRouting/Preferences/A11y/viewport إضافية. Widths360/390/768/1366/1440،RTL/LTR وLight/Dark،Keyboard/Focus/Escape/Back/Forward وDeep link/404/403/Recovery/Invitation/Tenant switch. Screenshots بياناتاصطناعيةفقط خارجGit للفحصالمرئي.
- [x] **T3-7 — Final gates:** Frontend tests/typecheck/build/lint،Browser integration،Relevant Backend إذاعقودالتكاملتأثرت،Gitleaks Metadata-only وdiffcheck. Bundle/initial render/lazy evidence وAA claims محدودةبالقياسات. تحديثMaster وهذاالتقرير وManifest ثمStop.

## Planned boundaries for A5-T4

تفكيكApp.tsx إلىFeatures/Pages، ترجمةصفحاتالأعمالكاملة، DTO validation وتفصيلLoading/Error لكلBusiness view،Filters/Page URL persistence وخياراتعرض/تفاصيلCatalog الأوسع. T3 تبنيسقالاتالتنقلوالتصميموتحافظعلىالسلوكالقائم. B risk isolation وC CAB enforcement وD session revocation/email والفحصالإنتاجيخارجالنطاق.

## Verification log

Baseline a89468f…، branch/origin مطابقان، Working Tree نظيفةقبلبدءالوثيقة؛ لاAGENTS.md داخلالمستودعكمافيالفحصالسابق. لاDB أو.env قرئتأواتصلبها.

**Current status:** التنفيذ المحلي محفوظ؛ توثيق التحقق النهائي أدناه. لا Commit/Push أوA5-T4.

## سجل التنفيذ والاستئناف المحلي — A5-T3

### 1. الخط الأساس وجرد العمل

المستودع والـorigin مطابقان: `bigest11/ChangeFlow-Governance`؛ الفرع `feature/phase2-batch-a-tenant-security`؛ HEAD `a89468f82c3edbb0d252dd2788e243e162358524`. هذه التغييرات تراكمية من التنفيذ المتوقف واستُكملت في مواضعها. لا Reset/Clean/Checkout/Stash أوإعادة إنشاء شاملة أوحفظ في Git. T1/T2 محفوظتان في Git؛ تقاريرهما أدلة تاريخية وليست نتائج T3 جديدة.

| المجال | المنجز وحدوده |
|---|---|
| Router | React Router Data Mode، Nested layouts، مسارات صريحة، protected boundary، grants، safe internal returns، lazy chunks، 403/404 وأخطاء عامة آمنة |
| Application Shell | Sidebar وTopbar وسياق العضوية الفعلي، Breadcrumbs، Home دليل عمل من grants، Account/Verify dialogs، Mobile drawer وBottom navigation |
| Obsidian & Sage | Tokens دلالية، خط عربي/لاتيني محلي، عناصر قابلة لإعادة الاستخدام، CSS قديمة معزولة؛ لا metrics أوميزات أعمال وهمية |
| ar-SA / en | موارد common/auth/shell/states محلية، العربية افتراضيًا، ترجمة الهوية وShell والحالات وARIA والتحقق؛ محتوى الأعمال القديم معلن بالإنجليزية إلى T4 |
| RTL / LTR | اتجاه الجذر، logical properties، Sidebar/Drawer، رموز اتجاهية فقط، bdi للبريد والرموز، اختبارات اللغة والاتجاه |
| Light / Dark | ثيمان مستقلان وحفظ التفضيل غير السري؛ لا قراءة أوكتابة JWT بواسطة مخزن التفضيلات |
| Responsive | دخول وShell عبر 360/390/768/1366/1440؛ مكونات الهاتف تشمل كلمة ChangeFlow، وDrawer للتفضيلات عند ضيق Topbar |
| إتاحة وحركة | Labels وlandmarks وfocus-visible وskip link وnative dialog وEscape؛ CSS reduced motion؛ تدقيق axe ولوحة مفاتيح موثق بنتائج منفصلة أدناه |

### 2. Architecture والعقود المحفوظة

`main` ينشئ AuthRuntime أولًا لإزالة Invitation Fragment قبل React/Router، ثم يهيئ اللغة والثيم محليًا، ثم Data Router تحت AuthProvider الوحيد. لا Auth fetch في loaders ولا مخزن جلسة بديل. البنية: RootFrame → AuthRoot → AppLayout → Home أوLegacyWorkspaceAdapter → App القديمة.

AuthStore وAuthProvider وAPI Client وJWT v2 وPermission Matrix لم تتغير سياساتها. AuthRoot لا يعرض بيانات حتى اكتمال me، ويعيد تركيب حدود Toast/الأعمال عند تغير binding. SessionStorage مؤقتة، وmemory=1 محفوظة عند فشل التخزين؛ Logout محلي، ولا يعني إبطال JWT على الخادم. لا Refresh Tokens أوServer revocation ضمن هذه المرحلة.

المحوّل يتحقق من route/grant قبل تحميل App القديمة. بيانات تفاصيل رقم مختلف لا تُعرض حتى تحميل ذلك الرقم، وتُلغى طلبات route السابقة عبر AbortSignal. صلاحيات Backend وعزل tenant هما المرجع النهائي؛ إخفاء الروابط ليس Authorization. لم تتغير Models/Migrations أوRuntime Backend أوSetup/Bootstrap.

### 3. Routes

| Route | الحماية / الوظيفة |
|---|---|
| `/login` | Public، Workspace Login بعقد A2 نفسه؛ عودة داخلية محدودة بعد me |
| `/invitations/accept` | Public، fragment في الذاكرة فقط، إزالة مبكرة، قبول A3 ثم Login صريح |
| `/` | Protected، تحويل إلى `/workspace` |
| `/workspace` | هوية me وسياق العضوية وروابط grants، بلا Business API أوأرقام مختلقة |
| `/changes` | changes.read؛ المحوّل إلى القائمة القائمة |
| `/changes/new` | changes.create؛ نموذج الأعمال القائم |
| `/changes/:id` | رقم موجب آمن وchanges.read؛ استعادة تفاصيل حقيقية |
| `/changes/:id/revise` | changes.revise؛ السلوك القائم دون تغيير السياسة |
| `/foundation` | foundation.write؛ صفحات الإدارة القائمة |
| `/users` | users.read؛ إدارة الأعضاء القائمة |
| `/notifications` | notifications.own؛ الإشعارات القائمة |
| `/forbidden` | Protected؛ حالة عامة مترجمة |
| مسار آخر أوID غير صالح | 404 آمنة؛ لا redirect خارج origin أوRaw Error |

React Router يوفر History؛ روابط وصفحات فعلية بدل state view وحدها. Redirect allowlist ترفض URL خارجية/مشفرة وquery/hash غير معتمدة. Preview المحلي يثبت SPA fallback عند Refresh؛ إعداد الاستضافة الإنتاجية يبقى S9 ولم يحدث نشر.

### 4. Design System وLocalization

الألوان المرجعية: Obsidian `#151A18`، Forest `#28352F`، Sage `#B8F28B`، Sand `#D9C8A9`، Ivory `#F4F1E8`. Tokens مستقلة للنص والسطح والحدود وfocus وdanger/success، وألوان Critical/High/Medium/Low/Unknown بنص وأيقونة. Dark وLight لهما تباين محسوب في الاختبارات، دون الاعتماد على Sage كلون خطر.

Readex Pro Variable محلي، `font-display: swap`، حجم أساس 16px، scale للعناوين والنص والجداول والهاتف؛ IDs والبريد والأرقام دون ترجمة قيم النقل. Spacing/radii/shadow/motion tokens في tokens.css. Buttons وTextField وSelectField وNotice وStateCard وSkeleton وRiskBadge وTableFrame وDialog وToast وNavigation تُستخدم ضمن الواجهة؛ لا UI/Motion framework إضافية.

لا Translation backend أوCDN أوAnalytics جديدة. i18next بموارد محلية ثابتة دون debug/saveMissing؛ المفاتيح منظمة، مع parity وAST usage checks وplural عربي كامل. Intl يستخدم Gregorian و24h؛ UTC ذات offset تُعرض بتوقيت Asia/Riyadh، وorganization-local تحفظ wall time دون اختلاق instant. التاريخ الغامض أوغير الصالح يعرض شرطة. حفظ اللغة والثيم فقط في localStorage؛ defaults ar-SA/dark عند الفشل أوالقيم التالفة، مع تحذير مفهوم عند تعذر التخزين.

CSS القديمة محصورة داخل layer و`.legacy-workspace`، مع overrides توافقية. عُزلت قواعد @page للطباعة خارج nesting لأنها غير صالحة داخله؛ لا إزالة لسلوك الطباعة أوتفكيك كامل للميزات. ترجمة/فصل صفحات الأعمال وتحسين DTO/loading التفصيلي ومرشحات URL تؤجل إلى A5-T4 بإذن منفصل.

### 5. Dependencies ومراجعة التثبيت

| الحزمة | الإصدار المثبت | الحاجة والترخيص |
|---|---|---|
| react-router | 7.18.5 | Data Router؛ MIT؛ Node≥20 وReact≥18 |
| i18next | 26.6.0 | محرك موارد/plural/Intl؛ MIT |
| react-i18next | 17.1.9 | React bindings؛ MIT؛ i18next≥26.2 وReact≥16.8 |
| @fontsource-variable/readex-pro | 5.3.0 | خط عربي ولاتيني محلي؛ OFL-1.1؛ نسخة الترخيص في public/licenses |
| axe-core (dev فقط) | 4.14.0 | تدقيق متصفح محلي؛ MPL-2.0؛ لا import داخل build التطبيق |

فُحصت metadata والتوافق مع Node24.17.0/React19.2.7/TypeScript6 والإصدارات المثبتة، وlicenses وengines/peers وLockfile integrity. التثبيت من npm الرسمية بإصدارات exact وignore-scripts/no-audit/no-fund؛ 10 packages مضافة إجمالًا دون تغيير أي إصدار سابق في lockfile. لم تُضف مكتبات أخرى أوخدمات دائمة. هذه مراجعة تثبيت وتوافق وليست ادعاء فحص CVEs كامل.

المراجع الأصلية: [React Router Data Mode](https://reactrouter.com/start/data/installation)، [React i18next](https://react.i18next.com/latest/using-with-hooks)، [Readex Pro](https://fontsource.org/fonts/readex-pro/about). اختيار v7 المثبت مقصود ومتوافق، ولا يعني ترقية إلى أحدث major المعروض في الوثائق.

### 6. Verification Results

| Gate | النتيجة الفعلية |
|---|---|
| Frontend unit/contract/presentation | 44 Passed، 0 Failed، 0 Skipped؛ منها 9 اختبارات Presentation جديدة، مع بقاء 35 اختبارًا سابقة |
| Typecheck | ناجح: app/test/node configs عبر verify runner |
| Production Build | ناجح، 96 modules؛ build محلي مؤقت، envDir=false، لا نشر |
| Lint | 0 Errors، 0 Warnings بعد إصلاح اقتباس في اختبار المتصفح |
| Relevant Backend Regression | 304 Passed، 0 Failed، 1 Skipped، 2 Deselected؛ 613.89s |
| PostgreSQL داخل المجموعة | 196 Passed، 0 Failed، 0 Skipped |
| Unit / in-memory داخل المجموعة | 108 Passed، 0 Failed، 1 Skipped؛ ليست بديلًا عن اختبارات PostgreSQL |
| Browser T2 regression | 13 سيناريوًا ناجحًا، ضمن جولة مشتركة من 2 pytest Passed /0 Failed /0 Skipped /0 Deselected، 92.93s |
| Browser T3 | 52 سيناريوًا ناجحًا في الجولة المشتركة؛ إعادة T3 لتوثيق contrast review: 1 Passed /0 Failed /0 Skipped، 33.19s؛ ليست اختبارًا إضافيًا غير متداخل |
| Gitleaks 8.30.1 | 57 ملفًا معدلًا/جديدًا، 0 Findings و0 matches للقيم التاريخية المعروفة؛ أُعيد فحص النسخة النهائية بعد تثبيت التوثيق والاختبارات: 57 ملفًا، 0 Findings |
| git diff --check | ناجح بعد إزالة trailing whitespace في CSS المعدلة |
| إكمال المستبعدتين بالاسم | 2 Passed /0 Failed /0 Skipped /134 Deselected، 18.38s؛ PostgreSQL واحدة وin-memory واحدة، دون تشغيل Bootstrap |

Skip الوحيدة: `test_postgres_email_comparison_uses_database_collation` في نسخة in-memory؛ تتطلب PostgreSQL، ولا تُعد نجاحًا. نسختها PostgreSQL ضمن 196 الناجحة. الاستبعادان الأوليان بسبب `-k not bootstrap` هما نسختا sqlite/postgresql من `test_confirmed_memberships_can_authenticate[source=bootstrap]`. بمراجعة الكود اتضح أنهما يختبران membership_source اصطناعية ولا يستدعيان أداة Bootstrap؛ أُكملا منفصلين بنجاح داخل الحواجز. الـ134 Deselected في جولة الإكمال هي حالات خارج الفلتر سبق تنفيذها في الجولة الأساسية، وليست 134 فجوة جديدة. الحصيلة غير المتداخلة للمجموعة المختارة: **306 Passed /0 Failed /1 Skipped**، منها **197 PostgreSQL +109 unit/in-memory**؛ لا Bootstrap أوLegacy invocation. لا جمع لأعداد RED أوالجولات المتكررة أواختبارات Browser مع Backend بشكل يوهم أنها حالات غير متداخلة.

أُضيف اختبار لحفظ artifacts خارج checkout مع عدم لمس ملفات موجودة: RED ثم GREEN، وهو ضمن 304. بدايات اختبارات presentation كانت RED قبل التطبيق ثم GREEN. فشل build أولي بسبب @page nesting أُصلح قبل الاعتماد؛ وفشل CORS counter كان يحتسب OPTIONS بدل GET، وفشل مقارنة عربية كان في encoding اختبار فقط. عولجت أسباب harness ولم تُفسر على أنها فشل مصادقة. فتح القائمة بـEnter كشف غياب text في CDP فصُحح، ثم أثبت اختبار Shift+Tab خروج التركيز إلى browser chrome؛ أُضيف boundary wrap داخل native dialog بعد RED. كل فشل نهائي غير مغلق سيمنع توصية Ready.

### 7. PostgreSQL Isolation Evidence

تشغيل الاختبارات عبر `a5_isolated_runner.py` فقط: child environment allowlist وJWT اصطناعية وDATABASE_URL اختبارية؛ تعطيل dotenv discovery/load وحظر فتح .env قبل استيراد التطبيق. لا قراءة/وراثة للأسرار الحقيقية. initdb ينشئ cluster جديدة تحت جذر هذه الجولة، loopback ومنفذ محجوز، ويتحقق الحاجز من postmaster identity/data path/user/password الاختباري وDB المسموح بها؛ يُرفض أي هدف غير مسجل. Schema migrations تخص fixture الجديدة فقط، ولم تتغير ملفات migration ولم تُنفذ على قاعدة قائمة.

FastAPI حقيقية عبر Uvicorn test wrapper بلا startup lifespan وبلا access logs، synthetic tenants/users/mailbox، وHTTP محلية. Node/Vite env allowlist وenvDir=false، مع public API origins محلية صريحة. لا SMTP/analytics/خدمات تحقق خارجية. التنظيف يخص socket/PID/cluster والجذر المملوكة للجولة؛ screenshots وmetadata الاصطناعية محفوظة خارج Git فقط. Browser artifacts ترفض fragment أوحقول password المملوءة قبل الالتقاط، حتى عند عرض password كنص.

### 8. Browser Evidence وحدود الإتاحة

المتصفح: Microsoft Edge headless 156.0.4314.50 على Windows، بروتوكول CDP محلي وحسابات اصطناعية. الصفحة المبنية production تُختبر محليًا، وليست نشرًا. لا mocking لاستجابات Auth/Business الناجحة؛ محاكاة الأعطال محدودة لحظر الشبكة أوstorage أوchunk كما يعلن اسم السيناريو.

اجتازت المصفوفة 40 حالة تخطيط: Login وWorkspace Shell × لغتان × ثيمان × المقاسات الخمسة. لكل حالة: لا overflow أفقي، targets≥44px، lang/dir/theme صحيح، font محلي وform labels؛ أسماء عربية طويلة وبريد/slug مختلط الاتجاه. axe عند 390 و1440 في مصفوفتي اللغة والثيم، وdialogs و403/404 وinvitation؛ النتائج النهائية موثقة هنا. فحص contrast tokens يحسب نسبة ≥4.5 للنصوص و≥3 للفوكس في الثيمين. فحوص axe العشرون: **0 Violations**؛ بقي Incomplete آلي واحد لـcolor-contrast على عنوان النافذة. لم يُخفَ أويسجل نجاحًا آليًا: تحقق إضافي من الألوان المحسوبة الفعلية (نص rgb(21,26,24) على rgb(255,254,250)) أثبت **17.445:1** وopacity=1، وأنه داخل viewport وغير محجوب. فُحصت لقطة Drawer بصريًا، واجتازت Tab/Shift+Tab وEscape وعودة التركيز. لا استثناء allowlist لعنصر التباين. لا ادعاء امتثال WCAG شامل أوفحص screen reader يدوي أوSafari/Firefox/iOS.

### 9. Performance

App الأعمال lazy منفصلة (~93.18 kB JS، ~18 kB gzip، و~54.97 kB CSS، ~7.76 kB gzip)؛ أثبت المتصفح عدم طلبها في Login أوWorkspace Home، وعدم طلب Business APIs في Home، وGET /auth/me واحدة دون تكرار عند تبديل اللغة والثيم. Entry JS ~220.1 kB/~70.1 kB gzip؛ ليست هذه مجموع initial import graph، إذ توجد shared chunks للـRouter/i18n/React. لا وصف مضلل لحجم bundle الكلي. ملفات الخط emitted حسب subsets العربية/اللاتينية وغيرها عبر unicode-range؛ لا CDN.

توقيت FCP المحلي المسجل في إحدى جولات production كان 144ms وDOMContentLoaded≈56.8ms على fixture محلية؛ هذا قياس جهاز واحد بلا throttling وليس Core Web Vitals أوضمان أداء إنتاجي. لا source maps أوملفات build تدخل Manifest.

### 10. Security Review وRemaining Risks

- JWT v2 وAuthStore/API Client وPermission Matrix وModels/Migrations وLegacy stubs/Bootstrap لم تتغير. التغيير في runtime يربط التنقل بالـRouter ويحافظ على capture/strip ومحو الدعوة عند المغادرة.
- لا Token في Router state أوPreference storage أوURL بعد capture؛ الاستثناء الأصلي fragment عند وصول الدعوة يزول قبل React. لا ErrorBoundary تعرض Error/Request/Location أوlog لها. Password clears on submit، ودعوة جديدة داخل الوثيقة تعيد ضبط النموذج.
- Deep links ممنوعة grants قبل App load؛ foreign record لا يعرض بيانات قديمة أوأجنبية. اختبارات T2 تبقى أساس generation/late response/401/recovery/tenant-switch.
- Legacy Demo retirement ما زال Unresolved، وExposure للأسرار المحلية وتوزيع backups غير محسومين تاريخيًا؛ لا إعادة تصنيف بلا دليل، ولا Rotation أوHash/reset أوتغيير حساب فعلي. التطوير على موارد جديدة معزولة فقط.
- F2 وTenant risk rules في B وCAB في C وlast-admin races/rate limits/bcrypt/session revocation/email في D وباقي production security review باقية. نجاح T3 لا يغلقها ولا يجيز مؤسسات فعلية.
- Business feature extraction والترجمة الكاملة وDTO validation/loading التفصيلي إلى T4؛ لا بدء لها ضمن هذه المهمة.

### 11. أوامر إعادة التحقق

من frontend: `node scripts/verify.mjs all`؛ يُنشئ build وtsbuildinfo في مجلد مملوك مؤقت خارج Git وينظفه.

من backend، paths تمر كمدخلات دون مسارات جهاز hardcoded داخل الاختبارات:

```powershell
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' tests/test_a5_runner_configuration.py tests/test_a5_isolation_gate.py tests/test_a5_identity.py tests/test_a2_authentication.py tests/test_a2_security_corrections.py tests/test_a3_invitations.py tests/test_a4_authorization.py tests/test_a4_isolation.py tests/test_a4_notifications.py tests/test_a4_regressions.py -k 'not bootstrap'
.\venv\Scripts\python.exe -B tests/a5_isolated_runner.py --postgres-bin '<PG_BIN>' --browser-bin '<EDGE_BIN>' --node-bin '<NODE_BIN>' --artifacts-root '<EXISTING_DIRECTORY_OUTSIDE_CHECKOUT>' tests/test_a5_t2_browser.py tests/test_a5_t3_browser.py
```

### 12. Checkpoint Manifest

طابقت القائمة الدقيقة أدناه Git بعد تحديث الوثيقتين؛ لا Git staging/commit ضمن هذه المهمة. الملفات المستبعدة دائمًا: .env وكلSecrets/Backups/ZIP/Dependencies/Builds/Temporary DBs/Scanner tools/reports ولقطات المتصفح المحلية. لا حذف للملفات المحلية المستبعدة.

**النسخة النهائية بعد Visual Review: 19 Modified +39 New =58 ملفًا.** العدد يختلف عن T2 لأنها مرحلة جديدة؛ لا ملفات T2 uncommitted باقية من baseline. Staging فارغة.

#### Modified Files

| File | النطاق |
|---|---|
| `backend/docs/development_master_plan.md` | Documentation |
| `backend/tests/a5_isolated_runner.py` | Tests / isolated tooling |
| `backend/tests/test_a5_runner_configuration.py` | Tests / isolated tooling |
| `backend/tests/test_a5_t2_browser.py` | Tests / isolated tooling |
| `frontend/e2e/auth.mjs` | Tests / isolated tooling |
| `frontend/index.html` | Dependency manifest / config |
| `frontend/package-lock.json` | Dependency manifest / config |
| `frontend/package.json` | Dependency manifest / config |
| `frontend/scripts/verify.mjs` | Tests / isolated tooling |
| `frontend/src/App.css` | Frontend A5-T3 |
| `frontend/src/App.tsx` | Frontend A5-T3 |
| `frontend/src/features/auth/AuthRoot.tsx` | Frontend A5-T3 |
| `frontend/src/features/auth/runtime.ts` | Frontend A5-T3 |
| `frontend/src/features/auth/safeRedirect.ts` | Frontend A5-T3 |
| `frontend/src/index.css` | Frontend A5-T3 |
| `frontend/src/main.tsx` | Frontend A5-T3 |
| `frontend/src/pages/InvitationAcceptancePage.tsx` | Frontend A5-T3 |
| `frontend/src/pages/WorkspaceLoginPage.tsx` | Frontend A5-T3 |
| `frontend/tsconfig.app.json` | Dependency manifest / config |

#### New Files

| File | النطاق |
|---|---|
| `backend/docs/phase2_a5_t3.md` | Documentation |
| `backend/tests/test_a5_t3_browser.py` | Tests / isolated tooling |
| `frontend/e2e/browser.mjs` | Tests / isolated tooling |
| `frontend/e2e/presentation.mjs` | Tests / isolated tooling |
| `frontend/public/licenses/readex-pro-OFL.txt` | License |
| `frontend/src/app/AppProviders.tsx` | Frontend A5-T3 |
| `frontend/src/app/ErrorBoundary.tsx` | Frontend A5-T3 |
| `frontend/src/app/LegacyWorkspaceAdapter.tsx` | Frontend A5-T3 |
| `frontend/src/app/RootFrame.tsx` | Frontend A5-T3 |
| `frontend/src/app/RouteFrames.tsx` | Frontend A5-T3 |
| `frontend/src/app/routePolicy.ts` | Frontend A5-T3 |
| `frontend/src/app/router.tsx` | Frontend A5-T3 |
| `frontend/src/components/navigation/Brand.tsx` | Frontend A5-T3 |
| `frontend/src/components/navigation/Breadcrumbs.tsx` | Frontend A5-T3 |
| `frontend/src/components/navigation/MobileNavigation.tsx` | Frontend A5-T3 |
| `frontend/src/components/navigation/PreferenceControls.tsx` | Frontend A5-T3 |
| `frontend/src/components/navigation/Sidebar.tsx` | Frontend A5-T3 |
| `frontend/src/components/ui/Dialog.tsx` | Frontend A5-T3 |
| `frontend/src/components/ui/Icon.tsx` | Frontend A5-T3 |
| `frontend/src/components/ui/Primitives.tsx` | Frontend A5-T3 |
| `frontend/src/components/ui/RouteSurface.tsx` | Frontend A5-T3 |
| `frontend/src/components/ui/ToastContext.ts` | Frontend A5-T3 |
| `frontend/src/components/ui/ToastProvider.tsx` | Frontend A5-T3 |
| `frontend/src/features/auth/SessionState.tsx` | Frontend A5-T3 |
| `frontend/src/layouts/AppLayout.tsx` | Frontend A5-T3 |
| `frontend/src/layouts/AuthLayout.tsx` | Frontend A5-T3 |
| `frontend/src/localization/formatters.ts` | Frontend A5-T3 |
| `frontend/src/localization/index.ts` | Frontend A5-T3 |
| `frontend/src/localization/locales/ar-SA.json` | Frontend A5-T3 |
| `frontend/src/localization/locales/en.json` | Frontend A5-T3 |
| `frontend/src/pages/StatePage.tsx` | Frontend A5-T3 |
| `frontend/src/pages/WorkspaceHomePage.tsx` | Frontend A5-T3 |
| `frontend/src/preferences/bootstrap.ts` | Frontend A5-T3 |
| `frontend/src/preferences/context.ts` | Frontend A5-T3 |
| `frontend/src/preferences/store.ts` | Frontend A5-T3 |
| `frontend/src/styles/global.css` | Frontend A5-T3 |
| `frontend/src/styles/legacy.css` | Frontend A5-T3 |
| `frontend/src/styles/tokens.css` | Frontend A5-T3 |
| `frontend/tests/presentation.test.ts` | Tests / isolated tooling |

### 13. Browser scenario inventory والأدلة المحلية

| المجموعة | Assertions الفعلية |
|---|---|
| T3 default + preferences | ar-SA/dark افتراضيًا؛ persistence بعد Reload؛ storage فاشلة لا تعطل Auth؛ تبديل اللغة والثيم دون تكرار me أوBusiness requests |
| T3 responsive matrix (40) | Login/Shell × ar-SA/en × dark/light ×360/390/768/1366/1440، font/labels/lang/dir/theme/44px/overflow |
| T3 real login | Login وme فعلية، GET me واحدة و0 business requests، App chunk غير محملة في Home |
| T3 keyboard/motion | Enter يفتح؛ Tab/Shift+Tab داخل modal؛ Escape يغلق ويعيد التركيز؛ outline مرئي وreduced-motion فعلي |
| T3 routes | تفاصيل100 مباشرة وبعد Refresh؛ Back/Forward/تركيز Main؛360px للـLegacy notifications؛foreign200 يعرض opaque error دونLocal/Foreign fixture data |
| T3 grants/errors | users ممنوعة للـRequester ورابطها مخفي؛404 لمشروع غير موجود؛App lazy chunk محظورة شبكيًا تعرض fallback ثم تتعافى |
| T3 invitation | Fragment محذوفة؛ رفض screenshot بعد تعبئةpassword؛Fragment جديدة في نفس الوثيقة تمسح الحقول؛لاToken فيhistory.state؛قبول حقيقي دونautologin |
| T2 retained (13) | Workspace login،refresh recovery،network vs401،grants/role recovery،disabled membership،tenant-switch/logout،طلبTenant معلق لا يعيد بياناته،invitation accept/replay،expiry،safe redirects،blocked storage |

دعوات Expired/Revoked لا تزال مغطاة بـBackend/Unit، وليستا browser flows منفصلتين. لا Multi-tab أوScreen Reader يدوي أومتصفحات/أجهزة فعلية أخرى؛ ليست ضمن نتائج ناجحة ضمنيًا. Component/business extraction وbusiness i18n الشاملة ليست مكتملة قبل T4.

الدليل النهائي للمتصفح الإنتاجي المحلي خارج المستودع: `changeflow-a5-t3-visual-_otj3hav` للجولة المشتركة، و`changeflow-a5-t3-visual-snnkg2ji` لمراجعة التباين النهائية. كلاهما تحت مجلد Visualizations الخاص بهذه المحادثة؛ measurements.json لا يتضمن Tokens أوPasswords أوRaw errors، وPNG بيانات اصطناعية فقط. عُرضت وفُحصت لقطات Login العربية للهاتف وWorkspace dark390/light1440 وDrawer الإنجليزية الفاتحة. مواقع الدليل خارج Git، ولا تعتمد الاختبارات على أسماء هذه المسارات.

### 14. Final security disposition

Gitleaks الرسمية المثبتة سابقًا v8.30.1: أعيدت مطابقة SHA-256 للـZIP وملف Checksums مع الإثبات السابق، وexe مطابقة bytes الحزمة. Detection/100% redaction/template جُربت أولًا على قيمة اصطناعية. القواعد الافتراضية، ignore فارغة وignore-gitleaks-allow، stdin محلي، reports محصورة في rule_id/line مع ربط المسار في metadata؛ stdout/stderr للأداة محجوزة ولا تُطبع. لم تحفظ Raw matches أوتُرفع ملفات. مقارنة في الذاكرة بالقيم الثابتة من blobs التاريخية الثلاث المعروفة: 0 matches في ملفات T3، دون طباعة القيم أوأجزائها أوHash لها.

**حدود النتيجة:** نطاق T3 الحالي فقط؛ ليست إعادة فحص شاملة لكل Git History/archives ولا إثبات تقاعد Demo. النتائج التاريخية والتصنيفات السابقة محفوظة بلا إعادة تصنيف. لا ملفات .env أوBackups أوأسرار فعلية قُرئت أوغيّرت، ولاRotation. مخاطر Legacy/F2/B/C/D باقية.

### 15. قرار التسليم المحلي

**Ready for Development Checkpoint** ضمن التطوير الاصطناعي المعزول فقط، بعد نجاح التحقق النهائي من تطابق Manifest والفحص الأمني للنسخة المسلّمة. لا فشل اختبار نهائي؛ Skip واحدة مفسرة وIncomplete آلي للتباين مع قياس إضافي موثق، وحدود screen-reader/browser/business QA معلنة. لا Production readiness. لا Stage/Commit/Push/PR/Merge/Deployment أوتغيير master؛ انتظار اعتماد المالك على Development Checkpoint ثم إذن Git الصريح. لا بدء A5-T4.

**Delivery verification:** تطابق Manifest=57، Staging=0، وgit diff --check وUTF-8/Python AST ناجحة. أُعيد Gitleaks على جميع الملفات الـ57 بعد آخر تعديل للاختبارات والتوثيق: 0 Findings؛ ثم أُعيد فحص وثيقتي التسليم بعد تثبيت هذه الخلاصة. جرى التحقق من زوال جذور جولات الاختبار النهائية المملوكة فقط؛ لقطات وmetadata الاصطناعية خارج المستودع محفوظة للمراجعة. HEAD والفرع وorigin وmaster دون تغيير.

## 16. Final Visual Review & Premium Motion — خطة التنفيذ المعتمدة

**Spec:** طلب المالك المرفق 4c516dc0-5042-4036-8bd5-e59b61e2ee56، تحسين T3 القائمة فقط. الهوية والخط والأعمدة الأساسية محفوظة، بلا مكتبات جديدة أوBackend/Policies/Models/Migrations أوGit mutations.

- [x] **VR-1 — Startup وFocus RED→GREEN:** اختبار Browser مع حظر حزمة التطبيق وPreferences light/en يثبت العرض الصحيح قبل React، واختبار تحميل Login بلا تركيز تلقائي على Main، مع بقاء Skip link وفوكس التنقل ولوحة المفاتيح. الملفات: index.html،RootFrame.tsx،tests/presentation.test.ts،e2e/browser.mjs وpresentation.mjs. لا قراءة Storage سوى مفتاحي Presentation في التهيئة المبكرة.
- [x] **VR-2 — Entry motion وFeedback:** إنشاء RouteSurface صغيرة عند الحاجة، بلا key remount أولقطات Exit أوتأخير Navigation. تتفاعل مع pathname/language فقط، تستخدم motion tokens وOpacity/Transform، وتلغي الحركة عند reduced-motion أوالمغادرة. CSS للأزرار والبطاقات والروابط ومؤشر active وDrawer وTheme control؛ لا animating width/height أوتلاشي شامل لألوان النص عند تغيير الثيم. الملفات: layouts/AuthLayout.tsx وAppLayout.tsx،components/ui/RouteSurface.tsx،styles/tokens.css وglobal.css،navigation/PreferenceControls.tsx. اختبار Browser يثبت تقدم الحركة وإلغاءها واستقرار Layout، والـReduced Motion.
- [x] **VR-3 — Visual & regression gate:** المصفوفة الحالية 40 layout cases +مراجعات Invitation/Business/403/404/Dialogs/Loading/Empty/Error باللغتين والثيمين، screenshots اصطناعية فقط، axe/Keyboard،T2 tenant-switch pending requests،unit/typecheck/build/lint،Gitleaks metadata-only وdiff check. Backend HTTP/PostgreSQL بموارد اختبار جديدة فقط؛ لا إعادة المجموعة الواسعة بلا عيب Backend. توثيق نتائج هذه الجولة منفصلة عن نتائج T3 السابقة وتحديث Manifest ثم توقف للاعتماد.

**Review focus:** منع theme flash قبل deferred module؛تمييز focus ring عن border زخرفي؛عدم بقاء DOM/بيانات جلسة سابقة في Exit transition؛تبديل اللغة/الثيم بسرعة مع طلب معلق؛إغلاق Dialog لا يبقي top-layer خلفية inert بعد اختفاء modal. الاختبارات تفحص هذه السلوكيات قبل اعتمادها.

**Design refinement:** الألوان الخمسة وReadex Pro الحاليان ثابتان. الحركة صغيرة ومرتبطة بالفعل، 160ms للتغذية الراجعة و200ms للدخول و240ms للـDrawer، دون مؤثرات موسمية أوتغيير التصميم المعتمد. Native selects تبقى Dropdowns فعلية، بلا قوائم وهمية أوإعادة تنفيذ سلوك المتصفح. التحقق البصري يحدد أي تغيير إضافي قبل تطبيقه.

## 17. Final Visual Review & Premium Motion — النتائج النهائية المحلية

**تاريخ الإغلاق:** 2026-11-02، Asia/Riyadh. هذا القسم هو نتيجة المراجعة الأحدث؛ الأرقام في الأقسام 6–15 أدلة الجولة السابقة ولا تُجمع معها. Git baseline ما زال a89468f82c3edbb0d252dd2788e243e162358524 على الفرع المعتمد. اتجاه Obsidian & Sage وReadex Pro وعمودا Workspace Login محفوظون؛ لم يُعَد التصميم من الصفر.

### 17.1 Motion System والتحسينات البصرية

- Tokens موحدة: feedback=160ms، page/dialog=200ms، drawer=240ms، skeleton pulse=1400ms؛ easing=`cubic-bezier(.22,1,.36,1)`. تقتصر الحركة القصيرة على Opacity/Transform/Feedback؛ pulse الهادئة استثناء لحالة Loading المستمرة.
- RouteSurface تضيف دخولًا خفيفًا (opacity .96→1 وtranslateY 4px→0) إلى DOM الحالية عند تغير pathname أواللغة. لا key remount أوExit snapshots أوتأخير Navigation أوPromise لإظهار المحتوى، ولا احتفاظ بمحتوى جلسة سابقة. Animation تلغى عند Unmount أوتفعيل reduced-motion، ولا يبدأ دخول عند طلب reduced-motion.
- CSS هي الأساس للأزرار وHover/Pressed والبطاقات ومؤشر Navigation الدلالي والأيقونات وDialogs وDrawer. استُخدمت native Element.animate للدخول فقط لتجنب إعادة تركيب Outlet أوفرض reflow لإعادة تشغيل CSS. لا Motion library جديدة. مرجع الآلية: [MDN Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate).
- Active indicators تتبع RTL/LTR بخصائص logical؛ Drawer تدخل من الطرف المنطقي. الضغط يغيّر Transform فقط، وWork-area icon تتحرك قليلًا دون تحريك أبعاد البطاقة. Native Language Select تبقى Dropdown نظامية، وAccount/Verify يبقيان Dialogs حقيقية؛ لا قوائم زائفة.
- Theme تتبدل ذريًا للمحافظة على التباين، مع Feedback قصيرة لأيقونة الثيم؛ لا تلاشي شامل بين لون النص والخلفية قد يخفض contrast في الإطارات الوسطية. Language تبدّل lang/dir والنصوص مع دخول خفيف للسطح الحالي، دون Reload أوAuth requests جديدة.

### 17.2 العيوب المثبتة وإغلاقها

| Finding | دليل RED / المشكلة | الإصلاح وGREEN |
|---|---|---|
| VR-F1 — إطار نموذج الدخول | Browser أثبت Main focused تلقائيًا؛ form border=0px. الإطار Focus Indicator، لا Border زخرفية | إلغاء التركيز التلقائي عند التحميل الأول فقط. اختبار Skip Link بلوحة المفاتيح يثبت Main focus وoutline مرئية دون إضافة hash؛ جميع مؤشرات الحقول والأزرار باقية |
| VR-F2 — عرض الثيم الافتراضي قبل React | Unit: dark بدل light عندما حزمة التطبيق لم تُنفّذ | تهيئة Presentation متزامنة صغيرة في head، تقرأ مفتاحي اللغة والثيم فقط مع allowlist وdefault آمن؛ Browser يحظر Entry JS ويثبت light/en/ltr والخلفية الصحيحة وRoot فارغة قبل تشغيل التطبيق. لا قراءة JWT أوURL أوAuth data. [مرجع توقيت scripts](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script) |
| VR-F3 — زمن حركة CSS في الإنتاج | أثناء التطوير الجديد أعاد minifier مدة200ms على هيئة .2s؛ parseFloat وحدها أنتجت .2ms، وفشل اختبار تقدم الحركة | التحويل من s/ms إلى milliseconds قبل Element.animate؛ الاختبار الفعلي يثبت مدة200ms وتقدم currentTime ووجود النموذج فورًا، opacity≥.96 |
| VR-F4 — Legacy CSS override | زر ترقيم فعلي بعرض42px بدل44، وبقي بعد محاولة حد اللمس؛ لقطة Browser أظهرت هيدرًا قديمًا مكررًا | تحميل App.css المؤجل كان يتجاوز overrides من layer نفسها. طبقة compatibility بعد legacy وقبل components/layout؛ حد button44×44 وتلوين الأزرار وقاعدة إخفاء هيدر Dashboard تعمل. لا Business logic أوتقسيم ميزات T4 |
| VR-F5 — Scroll بعد التنقل | Browser على الهاتف: قبل1764px، بعد الانتقال إلى Home بقي499px | PUSH/REPLACE لمسار جديد تعيدان scroll إلى0 قبل Paint؛ POP لا يفرض صفرًا. لا Scroll Positions في Storage ولا تغيير Session policy. GREEN: after=0، وBack/Forward وFocus ناجحة |

لم يُصلح اختلاف Password/Token أويُغيّر Auth contract ضمن هذه المراجعة. تعديلات RootFrame تتعلق بتوقيت Focus وScroll فقط.

### 17.3 Browser وResponsive وLocalization

- الجولة المشتركة النهائية بعد آخر تعديل Runtime: **2 pytest Passed /0 Failed /0 Skipped /0 Deselected، 62.85s**. Auth T2=13 سيناريوًا، Presentation T3=62. الجولات المشتركة/المستهدفة السابقة متداخلة ولا تُضاف لهذه الأعداد.
- **80 حالة تخطيط:** Login وWorkspace Shell وDashboard الانتقالية وInvitation × ar-SA/en × dark/light ×360/390/768/1366/1440. تحققت lang/dir/theme، عدم overflow أفقي، targets≥44px، الخط المحلي، وlabels لحقول الهوية. Body الأعمال القديمة lang=en/dir=ltr مقصودة ومعلنة؛ ليست ترجمة كاملة للأعمال.
- Drawer باللغتين والثيمين، Sidebar/Topbar/Breadcrumbs/Mobile active states، 403 و404، قبول Invitation وSuccess، وفشل Lazy chunk والتعافي منه راجعت في Browser. Existing auth recovery تعرض Loading قبل الهوية، وUnavailable عند حظر me، وEmpty حقيقية من Workspace الاختبار الثانية.
- T2 تحتفظ بتوقف استجابة HTTP حقيقية من Tenant الأولى؛ بعد Logout يثبت أول requestAnimationFrame أن Shell السابقة انفصلت عن DOM وأنه لا يوجد سطح قديم. ثم دخول Workspace الثانية وإطلاق الاستجابة القديمة لا يعيدان بيانات الأولى. لا mocking لنتائج Auth/Business الناجحة.
- الاختبار البصري لا ينقر تفضيلًا داخل Dialog مغلقة أثناء exit transition؛ على الهاتف يفتح Drawer الفعلية ويغير التفضيل ثم يغلقها. تصحيح Test locator موثق، وليس عيبًا في Session policy.

### 17.4 Accessibility والحدود اليدوية

**36 فحص axe: 0 Violations** للقواعد wcag2a/aa وwcag21aa وwcag22aa المستخدمة. أبقيت **3 Incomplete occurrences** لـcolor-contrast على عنوان Drawer الإنجليزي الملتف؛ لم تُخفَ ولم تُسجل آليًا كأنها نتيجة محسومة. تحقق إضافي من computed foreground/background مع opacity=1 وvisible/unobscured أثبت **13.759:1 للـDark** و**17.445:1 للـLight**. أي Incomplete غير متوقعة أوقياس غير ناجح يفشل الـGate؛ لا allowlist عامة.

اختُبرت Tab/Shift+Tab وEscape وعودة التركيز وSkip Link وfocus-visible، وReduced Motion تلغي دخول الصفحة وتخفض CSS motion. حُفظ native dialog/inertness، ولم تُلغَ مؤشرات التركيز. أُجريت مراجعة مرئية للقطات الحقيقية ذات البيانات الاصطناعية، بما فيها Login وDashboard وInvitation وDrawer وحالات Session؛ صور الملء بكلمة مرور ممنوعة حتى عند عرضها كنص.

لم يُجر تدقيق يدوي شامل باستخدام NVDA/VoiceOver أوSafari/Firefox/iOS/Android فعلية أوقائمة Select النظامية على أجهزة فعلية؛ لا ادعاء WCAG شامل. أربع عمليات axe في Dashboard تستثني `[data-legacy-body]` صراحة: Shell مدققة، وBusiness legacy خضعت لمراجعة بصرية/overflow/hit-targets، لا تدقيق AA كامل؛ استكمال business accessibility/i18n إلى A5-T4.

### 17.5 Performance وVerification

| Gate في هذه المراجعة | Passed | Failed | Skipped | Deselected / حدود |
|---|---:|---:|---:|---|
| Frontend unit/contract/presentation | 46 | 0 | 0 | 0؛ منها اختبارا startup/prefs جديدان، لا جمع مع44 السابقة |
| Final Browser HTTP/PostgreSQL | 2 | 0 | 0 | 0؛13Auth+62Presentation named scenarios |
| TypeScript app/test/node | ناجح | 0 | — | verify runner، بلا تثبيت Dependencies |
| Production Build | ناجح | 0 | — | 98 modules، build محلية مؤقتة، envDir=false |
| Lint | ناجح | 0 | — | 0 Errors /0 Warnings |
| Gitleaks v8.30.1 | 58 ملفًا، 0 Findings | 0 | — | binary integrity وsynthetic redaction/template ناجحة؛ إعادة فحص وثيقتي التسليم بعد تثبيت النتيجة |
| Manifest / diff / UTF-8 / Python AST | ناجحة | 0 | — | 19 Modified +39 New، Staging فارغة، جميع الموارد النهائية المملوكة منظفة |

الـBackend Regression الواسعة **306 Passed /1 Skipped** الواردة سابقًا لم تُعد في هذه المراجعة لعدم تغيير Backend runtime أوAuth policies أوModels/Migrations؛ ليست نتائج جديدة. تكامل HTTP/PostgreSQL الحالي فعلي ومعزول، بحواجز T1/T2 نفسها، ولا SQLite بديل عنه. الجذور وports وPIDs تخص الجولة فقط، وdotenv/الأسرار التشغيلية محظورة.

في Browser الإنتاجية المحلية: GET me واحدة عند الدخول، و0 business requests وApp chunk غير محملة في Home. تبديل الثيم ثماني مرات أعطى **Layout Shift=0** وبقي حجم/موضع Control ثابتًا؛ تبديل اللغة بسرعة ترك سطحًا واحدًا وAnimation دخول واحدة كحد أقصى. العينة المحلية rAF في إحدى الجولات النهائية تراوحت تقريبًا6.4–17.5ms؛ ليست ضمان60fps أوCore Web Vitals أوprofiling أجهزة ضعيفة. لا width/height animations ولا مؤثرات scroll ثقيلة.

أحجام build الأخيرة: Entry JS≈220.27kB/70.18kB gzip، RouteSurface shared chunk≈2.72kB/1.24kB gzip، Main CSS≈25.35kB/6.47kB gzip. Entry ليست مجموع import graph. App الأعمال بقيت≈93.18kB JS و54.97kB CSS مؤجلتين. الخط self-hosted بلا CDN؛ لم تضف هذه المراجعة Dependencies أوتغير Lockfile أوترخيص OFL.

### 17.6 Browser Evidence وFiles Changed

الأدلة خارج Git تحت Visualizations الخاصة بالمحادثة:

- `changeflow-a5-t3-visual-oe3i_h4x`: الجولة المشتركة النهائية بعد إصلاح Scroll، Auth13 وPresentation62،80layout و36axe؛ الدليل الرئيسي.
- `changeflow-a5-t3-visual-rulet_65`: تحقق التباين المستهدف بالثيمين،61سيناريوًا قبل إضافة اختبارScroll؛ تاريخي متداخل.
- `changeflow-a5-t3-visual-xnwyncsw`: Empty/Loading/Unavailable وصحة مصادقة13 قبل إصلاحScroll؛ الدليل النهائي المقابل موجود في جولةoe3i_h4x.
- لقطات Login/Workspace/Invitation/Dashboard/403/404/Drawer/Accepted وSession/Empty، وmeasurements.json تحتوي Metadata فقط. لا ملفات مصوّرة/Build/DB/Scanner أوSecrets تدخل Manifest.

ملفات التحسين في هذه المراجعة فقط: `frontend/index.html`،`src/app/RootFrame.tsx`،`src/components/ui/RouteSurface.tsx` (الجديد الوحيد فوق57)،`src/layouts/{AuthLayout,AppLayout}.tsx`،`src/components/navigation/PreferenceControls.tsx`،`src/styles/{tokens,global,legacy}.css`،`tests/presentation.test.ts`،`e2e/{auth,browser,presentation}.mjs`،ووثيقتا docs. ملفات T3 السابقة الأخرى محفوظة. ملفات Backend business/Models/Migrations/Bootstrap/Legacy stubs وAuthStore/Provider/Client/Matrix دون تغيير.

Manifest القسم12 هي القائمة الحالية الكاملة: **19 Modified +39 New =58**؛ فرق العدد عن57 هو RouteSurface.tsx فقط. Staging فارغة. لا Commit/Push/PR/Merge/Deployment أوتغييرmaster.

### 17.7 Remaining Risks وقرار الإغلاق

**التوصية النهائية: Ready for Development Checkpoint** ضمن التطوير المعزول فقط، بعد نجاح Gitleaks النهائية ومطابقة Manifest58 وGit baseline. Legacy Demo retirement ما زال Unresolved؛ الأسرار المحلية لم تُقرأ أوتتغير، ولا Rotation أوPassword Reset. F2 وB Risk Rules وC CAB وD/session revocation/rate limits/email وباقيProduction gates مفتوحة. Logout محلي وSessionStorage مؤقتة كما في T2، وBusiness extraction والترجمة/AA الكاملة وDTO states إلى A5-T4 بإذن منفصل.

لا تبدأ A5-T4 أوGit checkpoint تلقائيًا. توقف بعد التقرير وانتظار اعتماد المالك الصريح. النتيجة المحلية لا تجيز مؤسسات فعلية أوProduction readiness.

**Final delivery gate:** Gitleaks8.30.1 فحصت آخر نسخة من الملفات58 بعد التوثيق:0Findings و0Known historical literal matches؛أعيد التحقق من الأداة وRedaction/Template اصطناعيًا قبل المشروع، ثم فحص وثيقتي الخلاصة. هذه نتيجة محدودة بالنطاق، لا إثبات تقاعدDemo أوفحصCVE شامل. لم تتغير Dependencies/Lockfile في هذه المراجعة. HEAD/branch/master محفوظة؛المستودع يحوي19Modified+39New غيرstaged. لا Git write أوDeployment أوA5-T4؛انتظار الاعتماد.
