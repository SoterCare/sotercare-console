# sotercare-console Implementation Plan (full spec)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task is sized for one SerenEdge task; lanes per `b2b-plan/18` §5.1 (W1 live ops: live floor, alerts, residents, shifts, Devices, agent views, metrics, tokens + charts; W2 admin + records: accounts, station PIN, layout, settings, policy, support access, audit, medications, Medical records, MAR, rounds, billing).

**Goal:** The facility console for ward heads, facility managers and org admins: live floor and alerts, residents and alert bars, shifts, Devices (read-only pairing), medications and the MAR, Medical records, accounts, settings and policy sign-off, support access, audit and PDPA, billing, agent outputs, review queue, ARIA and metrics.

**Architecture:** Next.js 16 App Router running as a container. A BFF in the same app holds Cognito tokens in Redis sessions behind an httpOnly cookie and proxies `/v1` with the facility from the session only. Realtime by Socket.IO with a single-use backend ticket (contracts C-33). Tailwind 4 on the generated design tokens; a shared chart set published for the ops console.

**Tech Stack:** TypeScript 5, Next.js 16, React 19.2, Tailwind CSS 4, `@tanstack/react-query`, `socket.io-client`, `amazon-cognito-identity-js` (server only), `ioredis`, `i18next` + ICU, `recharts` 3, `@sotercare/contracts`; Vitest + Testing Library, MSW / Prism mock, Playwright + axe.

**Spec:** [`docs/spec.md`](spec.md) (rev 1). Read the sections each task names.

## Global Constraints
- **Tokens never reach the browser:** only the httpOnly `sc_sid` cookie; sessions in Redis, 12 h absolute, 30 min idle; CSRF header on every non-GET.
- **The facility comes only from the session** (`X-Facility-Id` set by the BFF for org admins); the proxy allow-list excludes `/v1/ops`, `/v1/family`, `/v1/push-tokens`.
- **No band IDs outside Devices admin; no assign / unassign / swap action anywhere** (D-99, D-132).
- **Medications:** never saved without a linked, clean doctor's recommendation; no dose suggestion; no per-caregiver figure for rounds.
- **No family ARIA chat view** for any role (D-113).
- **Design:** tokens only (lint fails on raw hex, default Tailwind palettes, arbitrary colours); colour + icon + word for priorities; WCAG AA; light mode only.
- **i18n:** no raw JSX strings, no missing keys (CI); times in the facility time zone.
- Files (Medical records, PDFs) only by presigned redirect; `no-store`; no service worker caching.
- Run: `npm test`, `npm run lint`, `npm run typecheck`, `npm run e2e` (Playwright, needs the `dev` URL + seed).
- **Commits have no `Co-Authored-By` or AI-attribution lines. Never force-push.**

## Review Focus
1. **An org admin has two tabs open on different facilities.** Expected: both tabs act on the session's single selected facility; switching in one tab makes the other reload with a "Facility changed" notice; no request ever goes out with the old facility. Test: `facility switch invalidates other tabs and never sends stale facility` (Task 3).
2. **The session goes idle for 31 minutes while the live floor's socket is still connected.** Expected: the next BFF call 401s, the socket is closed, the login page explains why. Test: `idle timeout closes socket and redirects with reason` (Task 2).
3. **A manager discharges a resident whose family account was linked a minute ago in another tab.** Expected: the backend's 422 `family_access_choice_required` reopens the dialog with that account added. Test: `discharge dialog adds account from 422 details` (Task 15).
4. **A medication edit changes the dose but keeps the old recommendation.** Expected: the form explains "A new or updated doctor's recommendation is needed" and opens the upload panel; nothing is saved. Test: `dose change requires new recommendation` (Task 17).
5. **The escalation sound can't play because the user never clicked the page.** Expected: a visible "Enable sound" control; the banner still shows; once enabled the sound plays on the next escalation. Test: `escalation banner without audio permission shows enable sound` (Task 7).

---

### Task 0: Import the dashboard with history and remove the marketing site (Thu 19 Nov, W1)
Spec §5.1.

- [ ] **Step 1:** Temp clone, merge and reduce history.
  ```bash
  mkdir -p D:/SoterCare/tmp && cd D:/SoterCare/tmp
  git clone --no-local D:/SoterCare/Github/web-dev-v2 old-console && cd old-console
  git checkout -b console 4837021
  git merge --no-edit origin/phase-1/alert-reliability      # resolve in favour of the phase-1 dashboard code
  python -m git_filter_repo --force --refs console --invert-paths --path graphify-out/ --path .scratch/ --path .superpowers/ --path .vscode/ --path dev-err.txt --path dev-out.txt --path test-api.js --message-callback "import re; return re.sub(rb'(?im)^co-authored-by:.*\n?', b'', message)"
  git log console --format=%B | grep -ci co-authored     # expect 0
  ```
  The local `web-dev-v2` folder and the `sotercare-website` repo are not modified.
- [ ] **Step 2:** `cd D:/SoterCare/Github-B2B/sotercare-console && git checkout -b import-old && git pull D:/SoterCare/tmp/old-console console --allow-unrelated-histories --no-edit`; keep this repo's `README.md`, `CLAUDE.md`, `docs/`.
- [ ] **Step 3:** Delete the marketing site per spec §5.1 step 4 in one commit; `npm ci && npm run build` passes with the dashboard routes.
- [ ] **Step 4:** `gitleaks detect` and the co-author count. Expected: no leaks, 0.
- [ ] **Step 5:** Commit `chore: import dashboard with history, remove marketing site`; `git checkout main && git merge --ff-only import-old && git push origin main`.

### Task 1: Skeleton, tokens, i18n, lint rules, CI (Fri 20 Nov, W1)
Spec §3, §5.2, §8 (tokens), §14 (i18n).

**Files:**
- Create: the `src/app` route groups (placeholders), `src/lib/i18n/*`, `locales/en/*.json`, `eslint` rules (no raw hex / default palettes / raw JSX strings), `.github/workflows/ci.yml`, `Dockerfile` (standalone).
- Modify: `tailwind` setup to import `@sotercare/contracts/design/tokens.css`; `Sidebar`, `Header`, `DashboardLayoutClient` restyled to tokens.

- [ ] **Step 1:** Write the tests: `lint rejects raw hex and emerald classes`, `lint rejects raw jsx strings`, `missing key fails`, `pseudo locale build`, `layout renders sidebar 256 px with active pill`.
- [ ] **Step 2:** Run `npm test && npm run lint`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run lint && npm run typecheck && docker build .`. Expected: PASS.
- [ ] **Step 5:** Commit `chore: skeleton on design tokens, i18n, lint rules, CI and container`.

### Task 2: BFF: login, MFA, sessions, proxy, CSRF (Fri 20 – Sat 21 Nov, W1; CP2)
Spec §6.1–§6.3.

**Files:**
- Create: `src/lib/bff/{session,cognito,proxy,csrf,allowlist}.ts`, `src/app/bff/auth/{login,new-password,mfa,mfa-setup,logout,session}/route.ts`, `src/app/bff/[...path]/route.ts`, `src/app/(auth)/*`, `tests/bff/*.test.ts`.

**Interfaces:**
- Produces: `getSession(req) -> Session | null`, `bffFetch(session, path, init)` (used by server components and the proxy route), `requireRole(session, roles)`.

- [ ] **Step 1:** Write the tests: `login resolves tenant pool and srp signs in`, `new password and mfa challenges`, `mfa enrolment for manager without mfa`, `caregiver and family refused`, `session cookie httpOnly secure strict`, `tokens never in any response body`, `idle timeout closes socket and redirects with reason`, `absolute 12 h`, `refresh before expiry`, `csrf required on non get`, `allow-list blocks ops family push paths`, `presigned redirect passes through`.
- [ ] **Step 2:** Run `npm test -- bff`. Expected: FAIL.
- [ ] **Step 3:** Implement (Redis via `ioredis`; local Redis from `sotercare-infra/local`).
- [ ] **Step 4:** Run `npm test -- bff`. Expected: PASS. `admin@demo` logs in on `dev` (**CP2**).
- [ ] **Step 5:** Commit `feat(bff): Cognito login with MFA, Redis sessions, proxy and CSRF`.

### Task 3: Org-admin facility switching and role gates (Sat 21 Nov, W1)
Spec §6.4–§6.5.

**Files:**
- Create: `src/app/bff/auth/facility/route.ts`, `src/components/FacilitySwitcher.tsx`, `src/lib/roles.ts`, tests.

- [ ] **Step 1:** Write the tests: `facility switch invalidates other tabs and never sends stale facility`, `x-facility-id only from session`, `each route declares roles and hides actions`, `403 shows you cannot do this`.
- [ ] **Step 2:** Run `npm test -- roles`. Expected: FAIL.
- [ ] **Step 3:** Implement (BroadcastChannel for other tabs).
- [ ] **Step 4:** Run `npm test -- roles`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: org-admin facility switching and role gates`.

### Task 4: Shared chart components (Fri 20 – Sun 22 Nov, W1)
Spec §8 (charts).

**Files:**
- Create: `packages/charts/src/{LineAreaChart,StackedBars,GaitRing,BandChart,Sparkline,tokens,EmptyState}.tsx`, `packages/charts/package.json` (`@sotercare/charts`), stories / tests.

- [ ] **Step 1:** Write the tests: `line area uses 2.5 px and 22 to 2 percent gradient`, `usual range band dashed edges and legend`, `device off spans break the line`, `tooltip shows exact value and date`, `gait ring 24h clockwise from top with state colours`, `incident category colours and labels`, `empty state explains why`.
- [ ] **Step 2:** Run `npm test -w packages/charts`. Expected: FAIL.
- [ ] **Step 3:** Implement on `recharts`; publish to GitHub Packages on tag.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(charts): shared chart set on design tokens`.

### Task 5: Realtime: tickets, socket, live reload (Sat 21 – Sun 22 Nov, W1)
Spec §7.

**Files:**
- Create: `src/app/bff/auth/ws-ticket/route.ts`, `src/lib/realtime/{socket,events}.ts`; adapt `components/dashboard/WebSocketContext.tsx`; tests.

- [ ] **Step 1:** Write the tests: `socket connects with single use ticket`, `reconnect fetches new ticket then live before events`, `stale shows last update`, `facility switch reconnects`, `connection lost banner`.
- [ ] **Step 2:** Run `npm test -- realtime`. Expected: FAIL.
- [ ] **Step 3:** Implement against the backend's `POST /v1/ws-tickets` (C-33).
- [ ] **Step 4:** Run `npm test -- realtime`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(realtime): ticketed socket with live reload`.

### Task 6: Live floor (Sun 22 Nov, W1; CP3)
Spec §9.1.

**Files:**
- Create: `src/app/(console)/live/page.tsx`, `src/components/live/{Tile,Queue,StatusStrip}.tsx`, tests.

- [ ] **Step 1:** Write the tests: `tiles show name residentNo room and states with icon and word`, `queue newest and most severe first`, `status strip gateway and on shift and nobody on shift red`, `resident.status updates tile`, `no band id anywhere`.
- [ ] **Step 2:** Run `npm test -- live`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- live`. Expected: PASS. band-sim → gateway → backend → live floor (**CP3**).
- [ ] **Step 5:** Commit `feat(live): live floor with tiles, queue and status strip`.

### Task 7: Banners and escalation sound (Sun 22 – Mon 23 Nov, W1)
Spec §9.1 (banners).

**Files:**
- Create: `src/components/banners/{Escalation,GatewayOffline,StaffNotReady,Service,Announcement}.tsx`, `src/lib/sound.ts`, tests.

- [ ] **Step 1:** Write the tests: `escalation banner and sound repeat until claimed`, `escalation banner without audio permission shows enable sound`, `gateway offline banner`, `staff not ready lists on shift staff`, `overdue and suspended texts`, `announcement until time`.
- [ ] **Step 2:** Run `npm test -- banners`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- banners`. Expected: PASS. Scenario 3 (console side).
- [ ] **Step 5:** Commit `feat: escalation, gateway, readiness, service and announcement banners`.

### Task 8: Alert board and alert page (Mon 23 Nov, W1)
Spec §9.2.

**Files:**
- Create: `src/app/(console)/alerts/{page,[id]/page}.tsx`, `src/components/alerts/*` (from `AlertsPanel`, `useAlerts`, `alertEvents`), tests.

- [ ] **Step 1:** Write the tests: `filters`, `highest seq wins`, `unassigned band label`, `timeline lists every action with via`, `manager resolve any and ward head take over`, `provisional confirming`, `moved resident shows current room`.
- [ ] **Step 2:** Run `npm test -- alerts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- alerts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(alerts): alert board and alert page with timeline and actions`.

### Task 9: Residents: list, admission, overview, alert settings (Mon 23 Nov, W1)
Spec §9.3 (list, admission, overview, alert settings).

**Files:**
- Create: `src/app/(console)/residents/{page,critical-off,left,[id]/overview,[id]/alert-settings}/page.tsx`, `src/components/residents/*`, tests.

- [ ] **Step 1:** Write the tests: `critical off only manager with reason`, `ward head cannot see critical off control`, `until options`, `applied on gateway or waiting`, `pause needs reason and until`, `critical off list`, `admission shows residentNo after save`, `consent and legal hold manager only`.
- [ ] **Step 2:** Run `npm test -- residents`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- residents`. Expected: PASS. Scenario 5 (console side).
- [ ] **Step 5:** Commit `feat(residents): residents, admission, overview and alert settings`.

### Task 10: Resident timeline, trends and band tab (Tue 24 Nov, W1)
Spec §9.3 (timeline, trends, band).

**Files:**
- Create: `src/app/(console)/residents/[id]/{timeline,trends,band}/page.tsx` (from `StatsTimeline`, `TemperatureStatistics`, `ActivityTimeline`), tests.

- [ ] **Step 1:** Write the tests: `trends use shared charts with usual range`, `band tab read only with sync time and pair at station note`, `no assign button exists`.
- [ ] **Step 2:** Run `npm test -- resident-tabs`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- resident-tabs`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(residents): timeline, trends and read-only band tab`.

### Task 11: Shifts (Tue 24 – Wed 25 Nov, W1)
Spec §9.4.

**Files:**
- Create: `src/app/(console)/shifts/*/page.tsx`, `src/components/shifts/{Planner,NowBoard,AvailabilityTimeline,Upcoming,Templates,CoverageRules}.tsx`, tests.

- [ ] **Step 1:** Write the tests: `planner drag creates draft`, `publish sends range`, `conflict and coverage warnings`, `ward head read only`, `now nobody on shift red`, `availability display only`, `facility time zone used for times`.
- [ ] **Step 2:** Run `npm test -- shifts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- shifts`. Expected: PASS. Scenario 13 (console side).
- [ ] **Step 5:** Commit `feat(shifts): planner, now, availability, upcoming, templates, coverage`.

### Task 12: Devices admin (Tue 24 Nov, W1)
Spec §9.5.

**Files:**
- Create: `src/app/(console)/devices/{bands,pool,gateway}/page.tsx`, tests.

- [ ] **Step 1:** Write the tests: `band ids only on devices pages`, `identify provisional`, `studio only for unassigned`, `pool live from band.assignment`, `gateway desired vs applied shadow versions`, `no pairing actions`.
- [ ] **Step 2:** Run `npm test -- devices`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- devices`. Expected: PASS. Scenario 25 (console side: read-only).
- [ ] **Step 5:** Commit `feat(devices): bands, pool and gateway views (read-only pairing)`.

### Task 13: Accounts: staff, org admins, family (Sun 22 – Mon 23 Nov, W2; CP5)
Spec §11.1 (accounts).

**Files:**
- Create: `src/app/(console)/admin/{staff,family}/page.tsx`, `src/components/admin/{LoginSlip,StaffForm,FamilyForm}.tsx`, tests.

- [ ] **Step 1:** Write the tests: `login slip shown once and printable`, `username rules shown`, `last manager error explained`, `reset password new slip`, `org admin tab only for org admins`, `family link unlink per account per resident`, `family email and weekly opt in`.
- [ ] **Step 2:** Run `npm test -- accounts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- accounts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): staff, org admin and family accounts with login slips`.

### Task 14: Layout and settings (Mon 23 Nov, W2)
Spec §11.2 (layout, settings).

**Files:**
- Create: `src/app/(console)/admin/{layout,settings/[group]}/page.tsx`, tests.

- [ ] **Step 1:** Write the tests: `each group form validates`, `time zone change leads to policy draft`, `quiet hours warning`, `wifi rollout progress`, `family live view switch default on`.
- [ ] **Step 2:** Run `npm test -- settings`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- settings`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): layout and facility settings`.

### Task 15: Discharge, transfer and family choices (Tue 24 Nov, W2)
Spec §9.3 (transfer), §11.1 (discharge dialog).

**Files:**
- Create: `src/components/residents/{DischargeDialog,TransferDialog}.tsx`, `src/app/(console)/residents/[id]/family/page.tsx`, tests.

- [ ] **Step 1:** Write the tests: `one choice per linked account required`, `discharge dialog adds account from 422 details`, `open alerts block with links`, `transfer bed picker shows free beds only`.
- [ ] **Step 2:** Run `npm test -- discharge`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- discharge`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(residents): discharge with per-account family choices and transfer`.

### Task 16: Alert policy sign-off (Mon 23 – Tue 24 Nov, W2; CP5)
Spec §11.2 (alert policy).

**Files:**
- Create: `src/app/(console)/admin/policy/page.tsx`, `src/components/admin/PolicyForm.tsx`, `src/lib/policyLimits.ts` (from the contracts schema bounds), tests.

- [ ] **Step 1:** Write the tests: `every field shows its safety limits`, `out of range refused before submit`, `reminder must be before step in`, `compare draft and active`, `sign off requires mfa manager`, `gateway applied version shown`.
- [ ] **Step 2:** Run `npm test -- policy`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- policy`. Expected: PASS. Policy signed off in the console (**CP5**).
- [ ] **Step 5:** Commit `feat(admin): alert policy drafts with safety limits and sign-off`.

### Task 17: Medication records (Tue 24 Nov, W2; CP5, scenario 30)
Spec §10.1.

**Files:**
- Create: `src/app/(console)/residents/[id]/medications/page.tsx`, `src/components/medications/{MedicationForm,ScheduleEditor,RecommendationPicker,MedicationLog}.tsx`, tests.

- [ ] **Step 1:** Write the tests: `cannot save without clean recommendation`, `upload recommendation in side panel then save`, `dose change requires new recommendation`, `prn interval text shown never enforced`, `pause resume stop need reason`, `log lists every change with recommendation`, `no dose suggestion anywhere`.
- [ ] **Step 2:** Run `npm test -- medications`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- medications`. Expected: PASS. Saved with a recommendation, refused without (**CP5**).
- [ ] **Step 5:** Commit `feat(medications): medication records from doctor's recommendations and the log`.

### Task 18: Medical records tab (Tue 24 Nov, W2; CP5, scenario 31)
Spec §10.3.

**Files:**
- Create: `src/app/(console)/residents/[id]/records/page.tsx`, `src/components/records/{UploadForm,Viewer,VersionHistory}.tsx`, `src/lib/sha256.ts`, tests.

- [ ] **Step 1:** Write the tests: `hashes each file and puts to grant then completes`, `scanning until clean and rejected when infected`, `type and size limits`, `reference needs number or link`, `new version keeps history`, `moving linked recommendation explains medications`, `viewer uses presigned redirect with no store`.
- [ ] **Step 2:** Run `npm test -- records`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- records`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(records): Medical records tab with uploads and versions`.

### Task 19: Rounds, overdue and MAR (Wed 25 – Thu 26 Nov, W2)
Spec §10.2.

**Files:**
- Create: `src/app/(console)/medications/{rounds,overdue,mar}/page.tsx`, tests.

- [ ] **Step 1:** Write the tests: `rounds per ward with counts`, `correction and undo need reason`, `overdue live from dose.updated`, `mar grid and prn entries`, `mar pdf link`, `on time percent per ward never per caregiver`.
- [ ] **Step 2:** Run `npm test -- mar`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- mar`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(medications): rounds, overdue list and MAR with PDF`.

### Task 20: Support access, audit, data and legal hold (Wed 25 – Thu 26 Nov, W2)
Spec §11.3.

**Files:**
- Create: `src/app/(console)/admin/{support-access,audit,data,legal-hold}/page.tsx`, tests.

- [ ] **Step 1:** Write the tests: `grant 1 h to 7 days with reason`, `audit filters and csv`, `family aria rows show metadata only`, `exports progress and download`, `data request actions`, `erase confirms and explains what is kept`.
- [ ] **Step 2:** Run `npm test -- admin-data`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- admin-data`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): support access, audit, data requests and legal hold`.

### Task 21: Billing (Thu 26 Nov, W2; CP7)
Spec §12.

**Files:**
- Create: `src/app/(console)/billing/*/page.tsx`, `src/components/billing/{CheckoutForm,BankTransferForm}.tsx`, tests.

- [ ] **Step 1:** Write the tests: `overview states and banner texts`, `pay now auto submits payhere form`, `return page polls and never claims paid`, `saved card and remove`, `bank transfer report`, `suspended keeps billing working`.
- [ ] **Step 2:** Run `npm test -- billing`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- billing`. Expected: PASS. PayHere sandbox payment (**CP7**, with B3).
- [ ] **Step 5:** Commit `feat(billing): overview, invoices, pay now, saved card, bank transfer`.

### Task 22: Updates, review queue, why view, metrics (Wed 25 – Thu 26 Nov, W1)
Spec §9.6, §13 (outputs, review, why).

**Files:**
- Create: `src/app/(console)/{updates,review,cases/[id]/trace,metrics}/page.tsx`, `src/components/outputs/*`, tests.

- [ ] **Step 1:** Write the tests: `outputs by role with degraded and translated labels`, `family weekly brief has no hold control`, `proposal edit payload form per type`, `band reassignment approval shows pair at station`, `trace view for ward head and manager`, `caregiver metrics only for managers with policy note`.
- [ ] **Step 2:** Run `npm test -- outputs`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- outputs`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: updates, review queue, why view and metrics`.

### Task 23: Staff ARIA and notifications (INT: Mon 30 Nov – Tue 1 Dec, W1)
Spec §13 (ARIA).

**Files:**
- Create: `src/app/(console)/{aria,notifications}/page.tsx`, `src/app/bff/aria/route.ts` (streaming passthrough), tests.

- [ ] **Step 1:** Write the tests: `aria streams through bff and final answer replaces`, `sources listed`, `limit and suspended states`, `notifications inbox marks read`.
- [ ] **Step 2:** Run `npm test -- aria`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -- aria`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: staff ARIA and notifications inbox`.

### Task 24: E2E, accessibility and acceptance (Fri 27 – Sat 28 Nov, W1 + W2)
Spec §15.

**Files:**
- Create: `e2e/*.spec.ts` (the flows in spec §15), `docs/acceptance.md`.

- [ ] **Step 1:** Write the Playwright flows and an axe check per main page.
- [ ] **Step 2:** Run `npm run e2e` against `dev`. Expected: FAIL until wired.
- [ ] **Step 3:** Fix test IDs and flows.
- [ ] **Step 4:** Run `npm run e2e` on `staging`. Expected: PASS. Record the console side of scenarios 3, 5, 6, 9, 10, 13, 16, 23, 24, 25, 30, 31.
- [ ] **Step 5:** Commit `test(e2e): console flows, accessibility and acceptance record`.
