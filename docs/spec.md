# sotercare-console: full spec

Status: **approved scope, 19 Nov 2026** (rev 1): the whole facility console in one spec. Plan: [`plan.md`](plan.md) (Tasks 0–24).

**Sources** (when they disagree, `b2b-plan/19` wins):
- `b2b-plan`: 03 §3 (routing), 04 (identity, roles, support access, audit), 05 §2–§4 (Devices, pool), 07 (alerting, alert bar, metrics), 08 (shifts), 09 (settings, i18n), 10 §5 (chart style), 11 §4, §9, §11 (agent outputs, who sees what), 12 (billing), 15 (privacy, data requests), 21 (medications, Medical records), 22 (design system), 17 §3.7 (old code);
- `sotercare-contracts/docs/spec.md` §7.5 (WebSocket), §7.8 (policy + safety limits), §7.10 (outputs, proposals), §7.11 (`public.yaml`), §7.13 (errors), §7.16–§7.17;
- `sotercare-backend/docs/spec*.md` (what each endpoint does);
- this repo's `CLAUDE.md`: rules and design.

Two parts in this file: **Part A** (§1–§9) platform (import, stack, BFF, realtime, design, charts, i18n) and the operational views; **Part B** (§10–§16) records, admin, billing, agents, testing, release, open items.

---

## Part A: platform and operational views

## 1. Intent
The facility console is where a care home is **run**: the live floor and alert board during a shift, residents and their alert bars, shifts, medications and the medication record, Medical records, accounts and settings, billing and the agents' outputs. Users: facility managers, org admins (one facility per request) and ward heads, on desktop browsers at the office or nurse desk.

It is **never the safety path**: alerts are decided on the gateway and delivered to phones and the nurse station. The console shows them live, sounds the manager escalation, and lets managers act, but if the console is down nothing in the home stops.

## 2. Goals, non-goals, anti-goals
**Goals:** everything in §4–§14, and the console side of `18` §9 scenarios **3** (escalation banner + sound), **5** (alert bar rules), **6** (isolation: the BFF never mixes facilities), **9** (onboarding steps done in the console), **10** (pseudo-locale), **13** (Nobody on shift), **16** (moved resident's alert), **23** (billing states shown), **24** (edits while suspended), **25** (assignments read-only), **30** (medication needs a recommendation), **31** (Medical records upload); checkpoints **CP2** (21 Nov: `admin@demo` logs in), **CP3** (22 Nov: live floor), **CP5** (24 Nov: accounts, policy sign-off, medication with recommendation, Medical records), **CP7** (26 Nov: billing + suspension states).

**Non-goals:**
- band ↔ resident pairing (D-132): read-only views only, with "Pair bands at the nurse station";
- band provisioning over BLE (staff app); the ops console's functions (`sotercare-ops-console`);
- family screens (the app) and **any view of family ARIA chats** (D-113);
- dark mode; mobile-first layouts (the console is desktop-first, usable on a tablet ≥ 1024 px);
- languages other than English at launch.

**Anti-goals (a failure even if it works):**
- a token in browser JavaScript, `localStorage` or a non-httpOnly cookie;
- a request whose facility comes from anything but the server-side session (org admins: the selected facility, sent as `X-Facility-Id` by the BFF only);
- a band ID outside Devices admin (D-99);
- an assign / unassign / swap button anywhere (D-132);
- a medication saved without a doctor's recommendation, or any dose suggestion (D-111, `21`);
- per-caregiver figures shown to anyone but managers / org admins, or **ever** for medication rounds;
- colour as the only signal for a priority or state (`22` §3);
- a raw hex value or hard-coded user-facing string.

## 3. Constraints
- **Stack:** Next.js **16** (App Router, React 19.2, server components, `output: standalone`), TypeScript 5 strict, Tailwind CSS 4 with the generated `@theme` from `@sotercare/contracts/design` (`tokens.css`), `@tanstack/react-query` in client components, `socket.io-client` 4, `i18next` + `react-i18next` + ICU (the same stack as mobile, `09` §6), `recharts` 3 for the shared chart components, `ioredis` (BFF sessions), `amazon-cognito-identity-js` on the server only (SRP, `NEW_PASSWORD_REQUIRED`, TOTP), `@sotercare/contracts` (types, lenient validators).
- **Runs as a container** (`console` ECS service behind CloudFront + WAF, infra spec §7.3 / §7.5 as updated 19 Nov); static assets on CloudFront.
- **Backend:** `public.yaml` `/v1` only, always through the BFF.
- **Browsers:** current Chrome, Edge, Safari, Firefox; ≥ 1024 px wide.
- **Dates:** spec and plan 19 Nov; lanes W1 (live ops) and W2 (admin + records), `18` §5.1; CP2, CP3, CP5, CP7.

## 4. Approaches considered
| Question | Options | Chosen |
|---|---|---|
| Auth in the browser | Amplify in the browser (tokens in JS) · **a BFF in Next.js holding tokens server-side** | **BFF** (`CLAUDE.md` rule): tokens in a server-side session (Redis), the browser only has an httpOnly session cookie |
| Session storage | sealed cookie (iron-session) · **Redis session keyed by an opaque cookie** | **Redis**: three Cognito tokens don't fit a 4 KB cookie; idle timeout and global revoke are easy |
| WebSocket auth without exposing tokens | proxy Socket.IO through Next · give the access token to JS · **a single-use ticket from the backend** | **Ticket** (contracts C-33): the BFF gets a 60 s ticket for the session's user; the browser connects with it |
| Hosting | static S3 site · **container** | **Container**: the BFF needs a server (infra updated) |
| Charts | visx · **recharts** | **recharts**: enough control for the `22` §8.9 style (gradients, reference areas) at less cost |

## 5. Import and layout
### 5.1 The import (Task 0)
From `SoterCare/sotercare-website` (local `D:\SoterCare\Github\web-dev-v2`), with history (D-20), per `17` §3.7, **without touching that repo**:
1. Temp clone; `git checkout -b console 4837021` (the last commit with the dashboard); merge `origin/phase-1/alert-reliability` (`19aec37`; 1 commit past the merge base `976fb99`), resolving in favour of the phase-1 dashboard code.
2. `git filter-repo --invert-paths` for `graphify-out/`, `.scratch/`, `.superpowers/`, `.vscode/`, `dev-err.txt`, `dev-out.txt`, `test-api.js`; `--message-callback` strips every `Co-Authored-By` line (97 in this history) and AI-attribution trailer.
3. Pull into this repo on `import-old` (`--allow-unrelated-histories`), keep this repo's `README.md`, `CLAUDE.md`, `docs/`; fast-forward `main`. No force-push. `gitleaks` scan (none found 19 Nov).
4. A normal commit then **deletes the marketing site** (everything outside the dashboard: `src/app/{community,editnews,news,pitch,llms.txt}`, the home page, marketing components `Hero`, `Features`, `Pricing`, `Team`, popups, `src/lib/{news-*,seo,faqs,demoRequest,upload}.ts`, `data/`, the marketing `public/` assets), so the website history stays readable in the website repo and the console history keeps the dashboard.

**Kept / adapted / replaced** per `17` §3.7:
- **Kept:** `src/lib/server-proxy.ts` + `proxyHeaders.ts` (the BFF proxy pattern), `src/lib/alertEvents.ts` + tests, `components/dashboard/WebSocketContext.tsx` (reconnect + snapshot reload), the Next.js / Tailwind setup, `DashboardLayoutClient`, `Sidebar`, `Header` (restyled).
- **Adapted:** `AlertsPanel`, `useAlerts.ts` → the alert board; `StatsTimeline`, `TemperatureStatistics`, `VitalsDisplay`, `latestVitals.ts`, `ActivityTimeline` → resident timeline and trends charts; `NoPhoneBanner`, `notificationStatus.ts` → "Staff not ready" and "Gateway offline" banners; `recycle-bin` page → the lists of discharged residents and deactivated staff (view only; the backend has no undelete).
- **Replaced:** `src/lib/auth.ts`, `useDeviceId.ts`, `mockData.ts`, `src/app/api/*` (old proxy routes), `dashboardApi.ts` → the BFF (§6) and typed endpoint modules.

### 5.2 Layout
```
src/app/
  (auth)/login  (auth)/new-password  (auth)/mfa  (auth)/select-facility
  (console)/layout.tsx           sidebar, header, banners, socket provider, facility switcher (org admins)
  (console)/live                 live floor
  (console)/alerts  alerts/[id]
  (console)/residents  residents/[id]/{overview,alert-settings,timeline,trends,medications,records,band,family}  residents/critical-off  residents/left
  (console)/medications/{rounds,overdue,mar}
  (console)/shifts/{planner,now,availability,upcoming,templates,coverage}
  (console)/devices/{bands,pool,gateway}
  (console)/updates  review  cases/[id]/trace  aria  metrics  notifications
  (console)/admin/{staff,family,layout,settings/[group],policy,support-access,audit,data,legal-hold}
  (console)/billing/{overview,invoices,payments,method,details}
  bff/[...path]/route.ts         the BFF proxy (§6.3)
  bff/auth/*/route.ts            login, new password, MFA, logout, session, facility switch, ws-ticket
src/lib/      bff/ (session, cognito, proxy), api/ (typed endpoint modules), realtime/, i18n/, format/
src/components/ charts/ (shared chart set, §8), alerts/, residents/, medications/, records/, shifts/, admin/, billing/, ui/
packages/charts/  the chart components published as @sotercare/charts (web) for the ops console (§8)
locales/en/*.json
tests/ (Vitest), e2e/ (Playwright)
```

## 6. BFF, sessions and access
### 6.1 Login (`04` §3–§4)
- `name@tenantId` + password posted to `/bff/auth/login`. The BFF calls `GET /v1/auth/tenant/{tenantId}`, then Cognito SRP (`amazon-cognito-identity-js`) against that pool with the **console** client ID. `NEW_PASSWORD_REQUIRED` → `/new-password`; `SOFTWARE_TOKEN_MFA` → `/mfa`; MFA enrolment for managers / org admins who haven't enrolled (backend 403 `mfa_required`) → the TOTP setup page (QR from the secret).
- Then `GET /v1/me` (`X-Login-Type: staff`). **Only `ward_head`, `facility_manager` and `org_admin` may use the console**; a caregiver or family account → "This account can't use the facility console" and the session is destroyed.
- Lockout and errors per contracts codes (§14).

### 6.2 Session
- Redis `console:sess:{id}` (`{tenantId, userId, role, poolId, clientId, tokens, facilityId (org admins), createdAt, lastSeenAt}`), the cookie `sc_sid` (opaque 32 bytes, `HttpOnly; Secure; SameSite=Strict; Path=/`).
- **12 h absolute, 30 min idle** (`04` §4): `lastSeenAt` refreshed on every BFF call; expired → 401 → the login page with "You were signed out after 30 minutes without activity".
- Tokens refreshed server-side before expiry; a refresh failure or a backend 401 / 403 `account_deactivated` destroys the session.
- **Logout:** Cognito `globalSignOut` is **not** called (it would sign the user out of the app too); the BFF revokes the refresh token for this session and deletes the session.
- **CSRF:** `SameSite=Strict` plus an `X-SC-CSRF` header (double-submit token in a readable cookie) on every non-GET BFF call.

### 6.3 The proxy (`/bff/[...path]`)
- Forwards to the backend `/v1/{path}` with `Authorization: Bearer {access}`, `X-Login-Type: staff`, `X-Facility-Id` (org admins: the session's selected facility only), `Idempotency-Key` passed through, `X-Request-Id`. Response bodies pass through unchanged; `Set-Cookie` from upstream is dropped.
- A path allow-list: `/v1/**` except `/v1/ops/**`, `/v1/family/**`, `/v1/auth/**` (handled by `/bff/auth`) and `/v1/push-tokens/**`.
- Presigned redirects (files, PDFs) pass through as 302 so the browser fetches from S3 directly; never proxied.
- Server components call the same proxy function in-process (no HTTP hop).

### 6.4 Facility switching (org admins, `04` §1)
`GET /v1/me` → `orgFacilities[]`; the header switcher calls `/bff/auth/facility {facilityId}`, which updates the session and clears the client query cache and the socket (re-ticketed for the new facility). The current facility name is always in the header. Every audit row shows `name@primary (org admin)` (backend).

### 6.5 Roles in the UI
Each route and action declares its roles from `04` §6; hidden when not allowed, and the backend's answer is final (403 → "You can't do this"). Ward heads: alert bars (not Critical), resident settings, Pause, Medical records upload, medication records, MAR, review queue (resident items), digest. Managers / org admins: everything in this spec. Per-caregiver metrics: managers / org admins only.

## 7. Realtime
- `/bff/auth/ws-ticket` → `POST /v1/ws-tickets` (contracts C-33: single-use, 60 s, bound to the user and facility) → `io(wsUrl, {auth: {ticket}})`. The backend joins `facility:{tenantId}` and `user:{tenantId}:{userId}` server-side.
- Events used: `alert.event`, `alert.escalated`, `resident.status`, `band.status`, `band.assignment`, `staff.availability`, `gateway.status`, `gateway.shadow_applied`, `tenant.service`, `roster.updated`, `output.*`, `proposal.*`, `notification.created`, `announcement`, `dose.updated`.
- **Reconnect** (the kept `WebSocketContext`): new ticket, then `GET /v1/live` before applying events; stale data shows "Last update hh:mm" (`CLAUDE.md` rule); while the backend can't be reached: "Connection lost: the nurse station is the live source".

## 8. Design and the shared charts (`22`)
- Tailwind `@theme` from `tokens.css` (generated); a lint rule (and test) fails on raw hex, Tailwind default palette classes (`emerald-*`, `amber-*`, …) and arbitrary colour values.
- Look kept from the old dashboard (`4837021`): `#FAFAFA` page + dot grid, `.depth-card` header and the 256 px sidebar, active nav = dark pill, inline brand logo 36–40 px, URW Geometric 400 / 500 / 700 (self-hosted woff2 from `@sotercare/contracts/design` after the licence check, `22` §14; system fallback stack until then).
- Priority colours and tile states per `22` §3: critical `#DC2626`, urgent `#C2410C`, normal `#FFAB66` + dark text, low grey icon; gateway offline `#B91C1C` banner + sound; **colour + icon + word** everywhere; focus rings visible; WCAG AA contrast (`22` §4, §12).
- **Shared chart set** (`components/charts`, also published as `@sotercare/charts` for the ops console; the app implements the same style in `victory-native`): `LineAreaChart` (2.5 px line, 22 % → 2 % gradient, hover points, horizontal grid, exact-value tooltip, device-off bands, the **usual-range** band), `StackedBars` (incident categories, activity), `GaitRing` (24 h ring per `22` §8.9), `BandChart` (relative temperature), `Sparkline`; tokens for gait states and incident categories exactly as `22` §8.9; every chart has an empty state that says why.

## 9. Operational views (W1)
### 9.1 Live floor (`/live`; CP3)
- Wards → rooms → resident tiles (name + `residentNo` + room, gait state, moisture, worn, battery / charging, alert-bar icons, Paused, Critical off, No arrival), from `GET /v1/live` + `resident.status`. Open alerts on top as the queue (newest and most severe first, elapsed time, holder).
- Status strip: gateway (online / LTE / offline, last heartbeat, software / policy versions, outbox depth), on-shift count + phones connected, "Nobody on shift" (red), "Roster out of date".
- **Banners:** manager escalation (`alert.escalated`: banner + **sound**, repeated until claimed; an "Enable sound" button on first load because browsers need a user gesture), gateway offline (`gateway_offline` alert), "Staff not ready" (on-shift staff with incomplete readiness), suspended / overdue (`tenant.service`), announcements.

### 9.2 Alert board and alert page (`/alerts`)
- Filters: state, type, priority, ward, resident, date; open and recent alerts; columns per `alert` (contracts §7.11); unassigned-band alerts as "Unassigned band ··0234".
- Alert page: header, the **timeline** (every action with actor and `via`), deliveries (recipient × round × channel), escalation times, verdict / outcome / note, voice note playback, sensor window availability; actions for managers (resolve any alert, D-95; reassign) and ward heads (take over, reassign, resolve) through `POST /v1/alerts/{id}/{action}` with a `requestId`; 202 provisional → "Claimed, confirming…".

### 9.3 Residents (`/residents`)
- List with filters (ward, status, Critical off), search by name / `residentNo`; `residents/critical-off` (every resident with Critical off, reason, who, since); `residents/left` (discharged / deceased, read-only).
- **Admission** (ward head, manager): name, ward / room / bed, notes; `residentNo` shown after save.
- **Resident page tabs:**
  - **Overview:** status, open alerts, quick facts, consent (manager: record / change, training use tick), legal hold (manager), Pause (ward head, manager; reason + until);
  - **Alert settings** (`07` §3): the five switches with optional `until`, bedtime / wake, pad type, sensitivity, haptic nudge; **Critical off only for managers with a reason**; history (`setting_change[]`); "Applied on the gateway hh:mm" / "Waiting for the gateway";
  - **Timeline** and **Trends** (charts: activity, night stand-ups vs usual, wet-pad episodes, wear time, relative temperature);
  - **Medications** (§10.1), **Medical records** (§10.3);
  - **Band:** read-only `GET /v1/residents/{id}/band` ("Band ··0234 since 10:12 · synced 10:12:05"; ward heads and managers see the label code; the band ID only via a link to Devices admin), assignment history; the note "Pair bands at the nurse station or in the staff app on the facility Wi-Fi";
  - **Family accounts** (manager): linked accounts, unlink (read-only period / now), link a new account.
- **Transfer** (bed picker), **Discharge** (§11.1 dialog).

### 9.4 Shifts (`/shifts`, managers edit; `08` §5)
- **Planner:** week / month by ward and by staff, drag and drop, templates and patterns, copy last week, conflict and coverage warnings, draft → **publish** (`POST /shifts/publish`), change history; ward heads see read-only.
- **Now:** per ward, on shift, availability, open claims, next change; red "Nobody on shift".
- **Today's availability:** a timeline per staff member (display only, D-17; segments from `GET /staff/availability`).
- **Upcoming** (7 days, headcount vs coverage), **Templates**, **Coverage rules**, roster-gap warnings.
- No attendance reports (D-17).

### 9.5 Devices admin (`/devices`; the only place band IDs appear)
- **Bands:** every band (`band` schema): status (`allocated`, `available`, `assigned`, `lost`), resident (name + `residentNo`) from the mirror with `assignmentSyncedAt`, online, battery, charge, worn, firmware, RSSI, key generation, Wi-Fi generation, port, dropped frames; actions **Identify** (`POST /bands/{id}/identify`, 202 provisional), **Mark lost**, **Rekey**, **Studio** (unassigned bands only, ≤ 120 min). **No assign / unassign / swap** (D-132).
- **Pool:** available bands by label code; live via `band.assignment`.
- **Gateway:** `gateway_info` (`gatewayId`, role, online, link, battery, versions, applied shadow versions vs desired, Wi-Fi rollout progress, LTE).

### 9.6 Metrics (`/metrics`)
`GET /v1/metrics` series as charts and tables: time to claim / arrival / resolve (median, p90) by priority, shift, ward, hour; unclaimed escalations; step-ins; ward-head escalations; no-recipient alerts; false alarms per bed per week; alerts per resident; stand-up attempts. **By caregiver** only for managers / org admins, with the note that it's workplace monitoring under the facility's staff policy (`15` §1).

---

## Part B: records, admin, billing, agents, testing

## 10. Medications and Medical records (W2)
### 10.1 Medication records (`21` §1–§2, D-111)
- Resident → Medications: list (status, schedule summary, the linked recommendation "Dr Perera, 12 Nov") and history.
- **Add / edit** (ward head, manager, org admin): name and dose as written, form, route (+ "other"), instructions, schedule (regular times × days / every N days; or PRN with an "at most every N hours" text), start / end, and **the doctor's recommendation: pick an existing `doctor_recommendation` item of this resident or upload one now** (opens the §10.3 upload in a side panel; the medication can't be saved until the item is `clean`). Changing name, dose, form, route or schedule asks for a new or newer recommendation (the backend's 422 `new_recommendation_needed` explained in place).
- **Pause / resume / stop** with a reason; the **medication log** (append-only list of every change with the linked recommendation).
- No dose suggestion, check or calculation anywhere (`21`).

### 10.2 Rounds, overdue and MAR (`21` §3–§5)
- **Today's rounds** per ward (due / on time / overdue / not recorded), round detail with each dose and its mark; a ward head / manager can correct a `not_recorded` dose or undo a mark with a reason.
- **Overdue list** (live from `dose.updated`).
- **MAR:** ward or resident, date range ≤ 31 days, the days × doses grid with status cells and PRN entries, the log for the period; **PDF export** (`GET /v1/mar?format=pdf`, 302 to the file). **On-time % per ward and week; never per caregiver.**

### 10.3 Medical records tab (`21` §10, D-112)
- List by category, filters by category and type; each item: title, date, source, uploader, versions; which medications it supports (for `doctor_recommendation`).
- **Upload** (ward head, manager, org admin): picture (1–20 pages: drag and drop or file picker; JPEG / PNG / HEIC ≤ 20 MB), PDF (≤ 20 MB), reference (label + number and / or https link), or text (≤ 10,000 characters); category, title, date, source (required for `doctor_recommendation`). The browser computes SHA-256 (WebCrypto), PUTs to the presigned URLs, then calls `complete`; "Scanning…" until `clean`; "File rejected" for `infected`.
- **New version** with a note; old versions stay in the history. Edit details (title, category, date, source); moving a linked recommendation is refused (409 `medical_record_linked` shown with the medication names).
- Files open in a viewer through `GET /v1/medical-records/{id}/file` (302, never cached: `Cache-Control: no-store` honoured; no service worker caching).
- Everyone with console access can view; family never.

## 11. Admin (W2)
### 11.1 Accounts (`04` §2)
- **Staff:** list (role, wards, status, MFA, readiness, station PIN set, last login), create (`name` + display name + role + wards → the **login slip** shown once, printable: username, temporary password, app QR, facility name), edit (rename, role, wards), reset password (new slip), reset MFA, deactivate (confirm; "the last active manager can't be deactivated"), clear station PIN. Facility managers can't see org-admin accounts' actions; org admins manage org admins (`/admin/staff?tab=org-admins`).
- **Family:** list, create with linked residents (slip), link / unlink **per account and per resident** (read-only period / now), deactivate, optional e-mail + weekly e-mail opt-in (contracts C-31).
- **Discharge dialog** (from the resident page): reason and time, then **one choice per active linked family account** (read-only for the family access period / deactivate now), showing each account's other linked residents; refused while an alert is open (the open alerts are listed with links).
- Deactivated staff list (view only).

### 11.2 Layout and settings (`09`)
- **Layout:** wards, rooms, beds; named ward head per ward.
- **Settings** per group (`09` §2): facility (time zone change → creates a policy draft and sends the manager to sign it off), night, nurse station, escalation (managers' quiet hours with a warning for slots with no on-call manager), shifts, medication, sensors (pad types), haptic, devices and network (band Wi-Fi SSID + password, staff Wi-Fi SSIDs (C-32), gateway address override, LTE failover; the Wi-Fi rollout progress), family app (cards, **Family live view** switch, response-time target, access period, ARIA for families, weekly e-mail), agents (handover minutes, morning brief time, reviewers, outputs on / off), data (exports, consent).
- **Alert policy** (`07` §8, contracts §7.8): the active version, drafts, a form with every field and its **safety limits shown next to it** (`09` §2.1; values outside are refused before submit and by the backend), compare draft vs active, **sign off** (manager / org admin with MFA), discard; the version the gateway has applied.

### 11.3 Support access, audit, data (`04` §7–§8, `15`)
- **Support access:** grant (reason, 1 h – 7 days), list, revoke; every support view appears in the audit with the person's name.
- **Audit:** filters (date, action, actor, target), CSV export; family ARIA entries show metadata only (who, when, resident, message length); never chat text (D-113).
- **Data:** exports (facility full, resident, audit, alerts, medications) with progress and a download link; **data requests** register (received, due, status, outcome) with the actions export / correct / erase / consent withdrawal (discharge with `consent_withdrawn`); **legal hold** per resident (`15` §3).

## 12. Billing (W2, `12` §2)
- **Overview:** price per bed, billable beds this month so far, next invoice estimate, state (`active` / `overdue` / `suspended`) with the banner text of `12` §4.
- **Invoices:** list, status, balance, PDF (302); **Pay now** → `POST /billing/invoices/{id}/checkout` → an auto-submitted form to PayHere (`checkout_session.actionUrl` + `fields`); the return page says "Payment received: confirming" and polls the invoice (the return page is never proof of payment).
- **Payment method:** save a card (recurring preapproval, same checkout flow), remove; **I paid by bank transfer** (reference, amount, date); payments, credit notes; **billing details** (contact, company, address, tax ID).
- While suspended: billing works fully; AI views are read-only; safety and access screens stay editable (D-64).

## 13. Agent outputs and ARIA (W1)
- **Updates** (`/updates`): handovers, daily care logs, insights, digests, morning brief, ops notes, monthly report, charging rota, device tasks, family weekly briefs (ward heads / managers see them; **no hold**, D-51), by role (`11` §11); feedback (useful / not useful + comment); "Short version: AI unavailable" on degraded outputs; translated copies with "Show English".
- **Review queue** (`/review`): proposals for the user's role (ward head: resident items; manager: operations items), with uncertain flags, alternatives and evidence; approve / edit (payload form per type) / reject (reason); `band_reassignment` approval shows "Pair the band at the nurse station"; escalated incident reports from caregivers.
- **"Why" view** (`/cases/[id]/trace`, ward heads / managers): the case trace (messages, tool calls, gate result, models), never for family chats (none exist for staff).
- **Staff ARIA** (`/aria`): streamed answers through a BFF streaming route (`text/event-stream` passthrough), sources, the checked final answer; limits and suspended states.
- Cover requests: managers see their state; answers are in the app.

## 14. Errors, states, i18n
- Every contracts error `code` maps to a translated message; unknown codes show a generic message with the code; unknown enum values render generically (contracts §10).
- Empty, loading, stale ("Last update hh:mm") and offline states on every view.
- i18n per `09` §6: `locales/en/*.json`, ICU, CI fails on raw JSX strings and missing keys, `Intl` formatting in the facility time zone (all times shown in **facility time**, not the browser's), a pseudo-locale build for scenario 10.

## 15. Testing and release
- **Unit / component:** Vitest + Testing Library: role gates, the alert board reducer (highest `seq`), the discharge dialog's per-account rule, the policy form's safety limits, the medication form's recommendation rule, the upload hashing + complete flow, chart components (empty states, usual band), formatting in the facility time zone, no raw hex / strings (lint tests).
- **BFF:** session lifecycle (idle 30 min, 12 h, refresh, logout), CSRF, the proxy allow-list, `X-Facility-Id` only from the session, tokens never in responses.
- **Contract:** API calls typed and checked against the contracts mock (Prism) in CI.
- **E2E (Playwright)** against the `dev` seed and `gw-sim`: login + MFA, live floor updates on a gw-sim alert, escalation banner + sound, alert settings change → applied, discharge with family choices, medication with a recommendation (and refused without), Medical records upload to clean, policy sign-off, billing pay-now on the PayHere sandbox, suspended banners, org admin facility switch; an **axe** accessibility check on every main page.
- **Release:** a container image built by the reusable deploy workflow (`sotercare-infra`), `dev` on merge, `staging` / `prod` with approval; config by environment variables (API URL, WS URL, Redis URL, Cognito region); no secrets in the image.

## 16. Open items and calls (check while reading)
| # | Item | Call / status |
|---|---|---|
| WC-1 | BFF hosting | **container** (`console` ECS service); infra spec updated 19 Nov |
| WC-2 | WebSocket without tokens in the browser | **contracts C-33** (applied 19 Nov): `POST /v1/ws-tickets` → single-use 60 s ticket; handshake `auth.ticket` |
| WC-3 | Chart library | `recharts` 3; published as `@sotercare/charts` for the ops console |
| WC-4 | Session store | Redis (the shared ElastiCache), key prefix `console:sess:` |
| WC-5 | Old recycle-bin page | becomes read-only lists of discharged residents and deactivated staff (no undelete endpoint exists) |
| WC-6 | Logout scope | ends this console session only (not a Cognito global sign-out, which would also sign the user out of the app) |
| WC-7 | URW Geometric | self-hosted only after the licence check (`22` §14); system fallback stack until then |
