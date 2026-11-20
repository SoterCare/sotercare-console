# sotercare-console Task Breakdown Implementation Plan

> **For agentic workers:** this plan is built through SerenEdge tasks (project `sotercare-console`, key `SCCON`), one task per section below. Pick a task with `/serenedge:next`; each task's `agentPrompt` links back to its section here. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The whole facility console from `docs/spec.md`, delivered as 29 reviewable SerenEdge tasks with CI, a deploy path and end-to-end tests per checkpoint.

**Architecture:** Next.js 16 App Router container with a BFF (Cognito tokens in Redis sessions behind the httpOnly `sc_sid` cookie), Socket.IO with a single-use backend ticket (contracts C-33), Tailwind 4 on the generated contracts tokens, shared charts published as `@sotercare/charts`.

**Tech Stack:** TypeScript 5, Next.js 16, React 19.2, Tailwind CSS 4, `@tanstack/react-query`, `socket.io-client` 4, `amazon-cognito-identity-js` (server only), `ioredis`, `i18next` + `react-i18next` + ICU, `recharts` 3, `@sotercare/contracts@1.1.0`; Vitest + Testing Library, MSW / Prism mock, Playwright + `@axe-core/playwright`.

**Spec:** [`docs/superpowers/specs/2026-11-19-console-task-breakdown-design.md`](../specs/2026-11-19-console-task-breakdown-design.md), which builds on the product spec [`docs/spec.md`](../../spec.md). The build tasks t1–t23 carry out [`docs/plan.md`](../../plan.md) Tasks 1–23 step for step; this document gives only their changes and fully details the new tasks (t0, t24–t28).

## Global Constraints
- Everything in `docs/plan.md` § Global Constraints applies to every task (tokens never reach the browser, facility only from the session, no band IDs outside Devices, no assign / unassign / swap, medications need a clean recommendation, no family ARIA chat view, tokens-only design, i18n with no raw JSX strings, presigned files with `no-store`).
- Branch `task/SCCON-<n>-<slug>` or `issue/SCCON-<n>-<slug>` off `dev`; PR into `dev`; commits `SCCON-<n>: short imperative summary`; no `Co-Authored-By`, "Generated with" or any AI / agent attribution anywhere; never push to `dev` or `main`; no secrets or `.env` in git.
- `serenedge ci` passes on the task branch before submit (`--quick` while iterating); paste its step markers into the PR.
- Contracts pinned exactly: `@sotercare/contracts@1.1.0` (`--save-exact`), mock `ghcr.io/sotercare/contracts-mock:v1.1.0`.
- New dependencies only those named in `docs/spec.md` §3 and the Tech Stack line above; anything else needs the Head's yes first.
- CI files (`.serenedge/*`, `tools/ci/*`, `.github/workflows/*`) change only in a task marked as a CI change (t0, t4, t24).
- Node `>=22.18` (current `engines`), npm with `package-lock.json`.

## Review Focus
1. **A fresh clone with no `NPM_TOKEN` runs `npm ci`.** Expected: a clear failure naming the missing token, not a hang or a 404 page dump. Test: `ci run fails fast without npm token` (t0).
2. **An E2E run starts before the contracts mock is ready (it takes about 20 s).** Expected: the harness waits for `GET /v1/auth/tenant/demo` to answer before the first test. Test: `global setup waits for mock health` (t25).
3. **The container starts without `REDIS_URL` or `BACKEND_API_URL`.** Expected: it exits at start with a message naming the variable, never serves pages that fail later. Test: `server refuses to start without required env` (t24).
4. **A page renders in the pseudo-locale with long strings.** Expected: no clipped buttons or overflow on main pages (scenario 10). Test: `pseudo locale main pages have no overflow` (t25).
5. **An axe check meets a known third-party violation (PayHere form page).** Expected: the console's own pages are checked; the PayHere-hosted page is out of scope and excluded by URL, not by disabling rules. Test: `axe runs on every console page and skips external origins` (t28).

---

### t0: CI foundation (SCCON-1)
<a id="t0-ci-foundation"></a>
New task (SerenEdge CI foundation). Every other task depends on it.

**Files:**
- Create: `.serenedge/ci.json`, `tools/ci/run.mjs`, `.github/workflows/ci.yml`, `.serenedge/review.json`, `.npmrc`, `tests/ci.test.mjs`
- Modify: `package.json` (remove `prebuild` / `check:copy`, add `typecheck`, rename to `sotercare-console`), `CLAUDE.md` (CI convention line)

**Interfaces:**
- Produces: `node tools/ci/run.mjs [--quick]` printing `::serenedge-step name=<step> status=start|pass|fail::` around each step; steps `lint`, `typecheck`, `test`, `build` (quick: `lint`, `typecheck`). Later tasks add steps by adding npm scripts and listing them here only in a CI-change task.

- [ ] **Step 1: Write the failing test** `tests/ci.test.mjs` (node:test, the current runner):
  - `ci run prints a start and pass marker per step`: spawn `node tools/ci/run.mjs --dry-run`, assert the output lists `name=lint`, `name=typecheck`, `name=test`, `name=build` in that order.
  - `ci run fails fast without npm token`: with `NPM_TOKEN` unset and `CI=true`, `--dry-run` exits non-zero with `NPM_TOKEN is not set` in stderr.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (`tools/ci/run.mjs` missing).
- [ ] **Step 3: Implement** `tools/ci/run.mjs` in the contracts pattern (`spawnSync('npm', ['run', name])`, marker lines, exit on first failure; `--dry-run` prints markers without running). `.serenedge/ci.json`: `{"command": "node tools/ci/run.mjs", "quickCommand": "node tools/ci/run.mjs --quick", "files": [".serenedge/ci.json", "tools/ci/run.mjs", ".github/workflows/ci.yml"], "timeoutMinutes": 30}`. `.npmrc`: `@sotercare:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}`. `package.json`: drop `prebuild` and `check:copy` (the script was deleted with the marketing site, so `npm run build` fails today), add `"typecheck": "tsc --noEmit"`, set `"name": "sotercare-console"`.
- [ ] **Step 4: Workflow** `.github/workflows/ci.yml`: `on: pull_request: branches: [main]` only; Node 22, `npm ci` with `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`, then `node tools/ci/run.mjs`. No push or `dev` triggers.
- [ ] **Step 5:** `.serenedge/review.json` with `sensitivePaths`: `src/lib/bff/**`, `src/app/bff/**`, `src/proxy.ts`, `src/lib/roles.ts`, `src/lib/realtime/**`, `src/app/(console)/billing/**`, `src/components/billing/**`, `src/app/(console)/admin/**`, `.github/workflows/**`, `.serenedge/**`, `Dockerfile`.
- [ ] **Step 6: Fix** whatever `lint` / `typecheck` / `build` report on the current code with the smallest change (no restyling; that's t1).
- [ ] **Step 7: Run** `serenedge ci`. Expected: four `status=pass` markers.
- [ ] **Step 8:** Add to `CLAUDE.md` (Git and commits): "Run `serenedge ci` before every submit; the GitHub workflow runs only on PRs into `main`; CI files change only in a CI-change task." Seed the `environment` KB entry **Running CI locally**.
- [ ] **Step 9: Commit** `SCCON-<n>: add CI foundation and fix the build`.

### t1: Skeleton on tokens, i18n, lint rules, Vitest (SCCON-2)
<a id="t1-skeleton"></a>
`docs/plan.md` Task 1, with these changes:
- **Not here:** `.github/workflows/ci.yml` (t0) and `Dockerfile` (t24).
- **Also here:** install `@sotercare/contracts@1.1.0 --save-exact`; remove the marketing dependencies (`@gsap/react`, `gsap`, `lenis`, `@portabletext/react`, `@react-email/*`, `resend`, `@vercel/analytics`, `styled-components`, `pdfjs-dist`, `react-image-crop`, `src/types/news.ts`) and the matching `overrides`; move the existing `tests/*.test.mjs` to Vitest (`tests/**/*.test.ts`) and point `npm test` at `vitest run`.
- **Produces:** `t(key, values)` via `src/lib/i18n`, `formatFacilityTime(date, tz)` in `src/lib/format/time.ts`, the `(console)` layout with `Sidebar` / `Header` slots, the ESLint rules `sotercare/no-raw-colour` and `sotercare/no-raw-jsx-string`.
- Commit `SCCON-<n>: skeleton on design tokens, i18n, lint rules and Vitest`.

### t2: BFF: login, MFA, sessions, proxy, CSRF (SCCON-3)
<a id="t2-bff"></a>
`docs/plan.md` Task 2, unchanged. Replaces `src/lib/auth.ts`, `src/app/api/*`, `src/proxy.ts`'s `accessToken` cookie check and `src/app/dashboard/login`. Env vars read at start: `BACKEND_API_URL`, `REDIS_URL`, `COGNITO_REGION`. Produces `getSession`, `bffFetch`, `requireRole` exactly as in `docs/plan.md`. Commit `SCCON-<n>: Cognito login with MFA, Redis sessions, proxy and CSRF`.

### t3: Facility switching and role gates (SCCON-4)
<a id="t3-facility-roles"></a>
`docs/plan.md` Task 3, unchanged. Produces `ROLES`, `can(session, action)` in `src/lib/roles.ts`. Commit `SCCON-<n>: org-admin facility switching and role gates`.

### t4: Shared chart components (SCCON-5)
<a id="t4-charts"></a>
`docs/plan.md` Task 4, plus: npm workspaces (`"workspaces": ["packages/*"]`), and `.github/workflows/publish-charts.yml` (on tag `charts-v*`, `npm publish -w packages/charts` with `GITHUB_TOKEN`, `packages: write`). That workflow makes this a CI-change task. Commit `SCCON-<n>: shared chart set on design tokens`.

### t5: Realtime: tickets, socket, live reload (SCCON-6)
<a id="t5-realtime"></a>
`docs/plan.md` Task 5, unchanged. Env var `WS_URL`. Produces `useRealtime(event, handler)` and `RealtimeProvider` in `src/lib/realtime`. Commit `SCCON-<n>: ticketed socket with live reload`.

### t6: Live floor (SCCON-7)
<a id="t6-live-floor"></a>
`docs/plan.md` Task 6. Commit `SCCON-<n>: live floor with tiles, queue and status strip`.

### t7: Banners and escalation sound (SCCON-8)
<a id="t7-banners"></a>
`docs/plan.md` Task 7. Commit `SCCON-<n>: escalation, gateway, readiness, service and announcement banners`.

### t8: Alert board and alert page (SCCON-9)
<a id="t8-alerts"></a>
`docs/plan.md` Task 8. Commit `SCCON-<n>: alert board and alert page with timeline and actions`.

### t9: Residents: list, admission, overview, alert settings (SCCON-10)
<a id="t9-residents"></a>
`docs/plan.md` Task 9. Commit `SCCON-<n>: residents, admission, overview and alert settings`.

### t10: Resident timeline, trends and band tab (SCCON-11)
<a id="t10-resident-tabs"></a>
`docs/plan.md` Task 10 (needs t4 charts). Commit `SCCON-<n>: timeline, trends and read-only band tab`.

### t11: Shifts (SCCON-12)
<a id="t11-shifts"></a>
`docs/plan.md` Task 11. Commit `SCCON-<n>: planner, now, availability, upcoming, templates, coverage`.

### t12: Devices admin (SCCON-13)
<a id="t12-devices"></a>
`docs/plan.md` Task 12. Commit `SCCON-<n>: bands, pool and gateway views (read-only pairing)`.

### t13: Accounts: staff, org admins, family (SCCON-14)
<a id="t13-accounts"></a>
`docs/plan.md` Task 13. Commit `SCCON-<n>: staff, org admin and family accounts with login slips`.

### t14: Layout and settings (SCCON-15)
<a id="t14-settings"></a>
`docs/plan.md` Task 14, plus the test `band wifi password is write only` (the form never shows a stored password; it shows "Set" and a Change button). Commit `SCCON-<n>: layout and facility settings`.

### t15: Discharge, transfer and family choices (SCCON-16)
<a id="t15-discharge"></a>
`docs/plan.md` Task 15 (needs t9). Commit `SCCON-<n>: discharge with per-account family choices and transfer`.

### t16: Alert policy sign-off (SCCON-17)
<a id="t16-policy"></a>
`docs/plan.md` Task 16. Commit `SCCON-<n>: alert policy drafts with safety limits and sign-off`.

### t17: Medication records (SCCON-18)
<a id="t17-medications"></a>
`docs/plan.md` Task 17 (needs t18's upload panel; build t18 first). Commit `SCCON-<n>: medication records from doctor's recommendations and the log`.

### t18: Medical records tab (SCCON-19)
<a id="t18-medical-records"></a>
`docs/plan.md` Task 18. Produces `<UploadForm residentId category onClean(itemId)>` used by t17. Commit `SCCON-<n>: Medical records tab with uploads and versions`.

### t19: Rounds, overdue and MAR (SCCON-20)
<a id="t19-mar"></a>
`docs/plan.md` Task 19 (needs t17). Commit `SCCON-<n>: rounds, overdue list and MAR with PDF`.

### t20: Support access, audit, data and legal hold (SCCON-21)
<a id="t20-admin-data"></a>
`docs/plan.md` Task 20. Commit `SCCON-<n>: support access, audit, data requests and legal hold`.

### t21: Billing (SCCON-22)
<a id="t21-billing"></a>
`docs/plan.md` Task 21. The PayHere sandbox payment is checked end to end in t28. Commit `SCCON-<n>: overview, invoices, pay now, saved card, bank transfer`.

### t22: Updates, review queue, why view, metrics (SCCON-23)
<a id="t22-outputs"></a>
`docs/plan.md` Task 22 (needs t4 charts for metrics). Commit `SCCON-<n>: updates, review queue, why view and metrics`.

### t23: Staff ARIA and notifications (SCCON-24)
<a id="t23-aria"></a>
`docs/plan.md` Task 23 (INT). Commit `SCCON-<n>: staff ARIA and notifications inbox`.

### t24: Container image and deploy workflow (SCCON-25)
<a id="t24-deploy"></a>
New task (from `docs/plan.md` Task 1's `Dockerfile` and spec §15 release). CI change.

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `src/lib/env.ts`, `src/instrumentation.ts` (calls `assertEnv()` in `register()`), `tests/env.test.ts`, `.github/workflows/deploy.yml`
- Modify: `next.config.ts` (`output: 'standalone'`)

**Interfaces:**
- Produces: `assertEnv(env = process.env): ConsoleEnv` in `src/lib/env.ts`, `ConsoleEnv = { BACKEND_API_URL: string; WS_URL: string; REDIS_URL: string; COGNITO_REGION: string }`; throws `Missing required environment variable: <NAME>`.

- [ ] **Step 1: Write the failing test** `tests/env.test.ts`: `server refuses to start without required env` (each of the four names removed in turn → throws naming it); `accepts a complete env`.
- [ ] **Step 2: Run** `npm test -- env`. Expected: FAIL.
- [ ] **Step 3: Implement** `assertEnv`; `Dockerfile` multi-stage on `node:22-alpine`, `npm ci` with `NPM_TOKEN` as a BuildKit secret (`--mount=type=secret,id=npm_token`, never an `ARG`), copy `.next/standalone` + `.next/static` + `public`, `USER node`, `EXPOSE 3000`, `CMD ["node", "server.js"]`.
- [ ] **Step 4: Workflow** `.github/workflows/deploy.yml`: `on: push: branches: [main]` → deploy `dev`; `workflow_dispatch` with input `environment` (`staging` | `prod`); `permissions: id-token: write, contents: read`; calls `SoterCare/sotercare-infra/.github/workflows/deploy-service.yml@main` for ECR repo `console`, ECS service `console`, ARM64, role `${{ vars.AWS_DEPLOY_ROLE_ARN }}`, secret `NPM_TOKEN`. Use the input names that workflow declares (read it in `sotercare-infra`; if it isn't merged yet, flag the task blocked rather than inventing inputs).
- [ ] **Step 5: Run** `npm test -- env && docker build --secret id=npm_token,env=NPM_TOKEN .` and `docker run --rm <image>` with no env. Expected: tests pass; the container exits 1 with `Missing required environment variable: BACKEND_API_URL`.
- [ ] **Step 6:** Seed the KB entry **Deploy workflow** (`setup`). Commit `SCCON-<n>: container image and deploy workflow`.

### t25: E2E harness and platform flows (CP2) (SCCON-26)
<a id="t25-e2e-platform"></a>
New test task (part 1 of `docs/plan.md` Task 24).

**Files:**
- Create: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/fixtures.ts` (`loginAs(role)`), `e2e/platform.spec.ts`, `e2e/axe.ts` (`checkA11y(page)`)
- Modify: `package.json` (`"e2e": "playwright test"`)

**Interfaces:**
- Produces: `loginAs(page, role: 'ward_head' | 'facility_manager' | 'org_admin')`, `checkA11y(page)` (fails on serious / critical violations, excludes other origins), `E2E_BASE_URL` (default `http://localhost:3000`), `E2E_MOCK_URL` (default `http://localhost:4000`).

- [ ] **Step 1: Write the flows** in `e2e/platform.spec.ts`: `login with mfa as manager`, `caregiver refused`, `idle timeout signs out with reason` (clock fast-forward 31 min), `org admin switches facility and other tab reloads` (scenario 6), `pseudo locale main pages have no overflow` (scenario 10), `global setup waits for mock health`.
- [ ] **Step 2: Run** `npm run e2e -- platform` against the local app + `contracts-mock:v1.1.0`. Expected: FAIL until test IDs are in place.
- [ ] **Step 3:** Add the missing `data-testid`s in t1–t5 code only (no behaviour change).
- [ ] **Step 4: Run** again. Expected: PASS. Commit `SCCON-<n>: e2e harness and platform flows`.

### t26: E2E live ops flows (CP3) (SCCON-27)
<a id="t26-e2e-live-ops"></a>
New test task (part 2 of `docs/plan.md` Task 24). Uses t25's `loginAs` and `checkA11y`.

- [ ] **Step 1: Write** `e2e/live-ops.spec.ts`: `live floor updates on a gw-sim alert`, `escalation banner and sound until claimed` (scenario 3), `alert settings change shows applied on gateway` (scenario 5), `moved resident alert shows current room` (16), `nobody on shift red` (13), `devices pool read only with pair at station note` (25), `trends chart shows usual range`, and `checkA11y` on `/live`, `/alerts`, `/residents`, `/shifts/now`, `/devices/bands`.
- [ ] **Step 2: Run** `npm run e2e -- live-ops` with the mock scenario player. Expected: FAIL until wired.
- [ ] **Step 3:** Add test IDs in t6–t12 code only.
- [ ] **Step 4: Run.** Expected: PASS. Commit `SCCON-<n>: e2e live ops flows`.

### t27: E2E records and admin flows (CP5) (SCCON-28)
<a id="t27-e2e-records-admin"></a>
New test task (part 3 of `docs/plan.md` Task 24).

- [ ] **Step 1: Write** `e2e/records-admin.spec.ts`: `create staff shows login slip once` (scenario 9), `settings save and family live view default on`, `discharge with one choice per family account`, `policy sign off needs mfa`, `medication refused without recommendation then saved with one` (30), `medical record upload reaches clean` (31), `mar pdf link opens`, `support access grant and audit row`, and `checkA11y` on each admin page.
- [ ] **Step 2–4:** as t26, with test IDs in t13–t20 code only. Commit `SCCON-<n>: e2e records and admin flows`.

### t28: E2E billing, agents, accessibility and acceptance record (SCCON-29)
<a id="t28-e2e-acceptance"></a>
New test task (part 4 of `docs/plan.md` Task 24).

**Files:** `e2e/billing-agents.spec.ts`, `docs/acceptance.md`.

- [ ] **Step 1: Write** `pay now on payhere sandbox then invoice paid` (23), `suspended keeps safety and billing editable and ai read only` (24), `review queue approve band reassignment shows pair at station`, `aria streams an answer with sources`, `axe runs on every console page and skips external origins`.
- [ ] **Step 2: Run** on `dev` (after a release) with the PayHere sandbox card. Expected: FAIL until wired; then PASS.
- [ ] **Step 3:** `docs/acceptance.md`: the console side of scenarios 3, 5, 6, 9, 10, 13, 16, 23, 24, 25, 30, 31 with the run date, environment and result per scenario.
- [ ] **Step 4: Commit** `SCCON-<n>: e2e billing and agents, accessibility, acceptance record`.

---

## Task analysis

Six checks per task: manual work, security flags, review lane, hours, the test task that verifies it, KB seeds. "Human" lane = a task with manual work, a CI change or any security flag. Auto Mode never claims a task with manual steps.

### Summary table
| Task | Manual work | Security flags | Lane (why) | Hours | Tested by | KB seeds |
|---|---|---|---|---|---|---|
| t0 CI foundation (SCCON-1) | M1, M2 | secrets | human (CI change, manual, secret) | 5 (4 code + 1 manual) | none (verified by `serenedge ci` itself) | environment **Running CI locally**; setup **GitHub Packages access for CI**; decision **Console task breakdown** |
| t1 Skeleton (SCCON-2) | none | dependencies | human (deps) | 6 | none (flows run in t25) | ui_system **Design tokens in the console**; glossary **Console i18n** |
| t2 BFF (SCCON-3) | none (local Redis from `sotercare-infra/local`) | auth, personal_data, dependencies | human | 8 | t25 | glossary **BFF session**; interface **BFF proxy allow-list** |
| t3 Facility + roles (SCCON-4) | none | auth, permissions | human | 4 | none (flows run in t25) | glossary **Facility context**; glossary **Role gates** |
| t4 Charts (SCCON-5) | none | dependencies | human (CI change: publish workflow) | 6 | none (flows run in t26) | ui_system **Shared charts** |
| t5 Realtime (SCCON-6) | none | auth | human | 4 | none (flows run in t25) | interface **WS ticket** |
| t6 Live floor (SCCON-7) | none | none | auto | 5 | t26 | glossary **Live floor** |
| t7 Banners (SCCON-8) | none | none | auto | 4 | none (flows run in t26) | glossary **Escalation banner** |
| t8 Alerts (SCCON-9) | none | permissions | human | 5 | none (flows run in t26) | glossary **Alert board reducer** |
| t9 Residents (SCCON-10) | none | permissions, personal_data | human | 6 | none (flows run in t26) | glossary **Alert settings** |
| t10 Resident tabs (SCCON-11) | none | none | auto | 4 | none (flows run in t26) | glossary **Read-only band mirror** |
| t11 Shifts (SCCON-12) | none | permissions | human | 8 | none (flows run in t26) | glossary **Shifts planner** |
| t12 Devices (SCCON-13) | none | permissions | human | 4 | none (flows run in t26) | glossary **Devices admin** |
| t13 Accounts (SCCON-14) | none | auth, permissions, personal_data | human | 6 | none (flows run in t27) | glossary **Login slip** |
| t14 Settings (SCCON-15) | none | permissions, secrets | human | 6 | none (flows run in t27) | glossary **Facility settings** |
| t15 Discharge (SCCON-16) | none | permissions, personal_data | human | 4 | none (flows run in t27) | glossary **Discharge family choice** |
| t16 Policy (SCCON-17) | none | auth, permissions | human | 5 | none (flows run in t27) | glossary **Alert policy draft** |
| t17 Medications (SCCON-18) | none | permissions, personal_data | human | 6 | t27 | glossary **Medication record** |
| t18 Medical records (SCCON-19) | none | personal_data | human | 6 | none (flows run in t27) | glossary **Doctor's recommendation**; glossary **Medical record upload** |
| t19 MAR (SCCON-20) | none | personal_data | human | 6 | none (flows run in t27) | glossary **MAR** |
| t20 Support/audit/data (SCCON-21) | none | permissions, personal_data | human | 6 | none (flows run in t27) | glossary **Support access** |
| t21 Billing (SCCON-22) | none | payments | human | 6 | t28 | glossary **PayHere checkout form** |
| t22 Outputs (SCCON-23) | none | permissions | human | 6 | none (flows run in t28) | glossary **Review queue** |
| t23 ARIA (SCCON-24) | none | personal_data | human | 5 | none (flows run in t28) | interface **Staff ARIA stream** |
| t24 Deploy (SCCON-25) | M3, M4 | infra, secrets | human (CI change, manual) | 5 (4 code + 1 manual) | none (flows run in t28) | setup **Deploy workflow** |
| t25 E2E platform (SCCON-26) | none | dependencies | human (deps: Playwright, axe) | 5 | n/a (test task) | environment **Running E2E locally** |
| t26 E2E live ops (SCCON-27) | none | none | auto | 6 | n/a | none |
| t27 E2E records/admin (SCCON-28) | none | none | auto | 6 | n/a | none |
| t28 E2E acceptance (SCCON-29) | M5 | payments | human (manual) | 6.5 (6 code + 0.5 manual) | n/a | setup **PayHere sandbox for E2E** |

**Totals:** 29 tasks, 159.5 hours; 5 manual steps (2.5 h) on 3 tasks; 24 human-lane, 5 auto-lane (t6, t7, t10, t26, t27); Each test task can verify only one task, so t25 verifies t2, t26 t6, t27 t17 and t28 t21; the other 19 build tasks have no linked test task (their unit and component tests are inside each task, and the grouped E2E runs their flows; Head decision 20 Nov).

### Manual steps (exact values)
- **M1 (t0) GitHub Packages read token.** Owner `devops`, account owner: SoterCare GitHub org, proof `secret`, env var `NPM_TOKEN`, 0.75 h. Create a fine-grained token (or org machine-user classic token) with `read:packages` on the SoterCare org; add it as the repository Actions secret `NPM_TOKEN` in `SoterCare/sotercare-console` (Settings → Secrets and variables → Actions). Developers use their own token locally in their shell, never in a file in the repo. Review check: the CI workflow's `npm ci` step installs `@sotercare/contracts@1.1.0` on a PR into `main`.
- **M2 (t0) Package access.** Owner `head`, account owner: SoterCare GitHub org, proof `link`, 0.25 h. On the `@sotercare/contracts` and `contracts-mock` package pages → Package settings → Manage Actions access → add `sotercare-console` with role **Read**. Review check: the links to both settings pages show the repo with Read.
- **M3 (t24) Deploy role.** Owner `devops`, account owner: SoterCare AWS dev account, proof `env`, env var `AWS_DEPLOY_ROLE_ARN`, 0.5 h. Confirm `sc-ci-deploy-sotercare-console`, ECR `console` and ECS service `console` exist in `dev` (infra spec §7.3, §11); add the role ARN as the repository Actions **variable** `AWS_DEPLOY_ROLE_ARN`. Review check: a manual run of `deploy.yml` reaches "update ECS service" on `dev`.
- **M4 (t24) Runtime variables.** Owner `devops`, account owner: SoterCare AWS dev account, proof `env`, env var `BACKEND_API_URL`, 0.5 h. In the infra console task definition for `dev`: `BACKEND_API_URL=https://api.dev.sotercare.com`, `WS_URL=wss://api.dev.sotercare.com`, `REDIS_URL` from the shared ElastiCache endpoint (secret by ARN), `COGNITO_REGION=ap-south-1` (use the actual `dev` hostnames from infra if they differ). Review check: the `dev` console's `/login` loads and `GET /bff/auth/session` answers 401 (not 500).
- **M5 (t28) PayHere sandbox.** Owner `head`, account owner: SoterCare PayHere sandbox merchant, proof `note`, 0.5 h. Confirm the `dev` backend has the PayHere sandbox merchant configured and give the tester the sandbox test card (outside git). Review check: the note names the sandbox merchant ID and the date confirmed; t28's pay-now flow passes.

### Security notes per area
Reviewers check what spec §5.1 lists for each flag. Specific to tasks: t2 `tokens never in any response body` and the cookie flags; t3 `x-facility-id only from session`; t5 the ticket is fetched server-side and is single use; t13 the temporary password appears only on the slip, once; t14 the Wi-Fi password is write-only; t17 no dose suggestion text; t18 files only by presigned redirect with `no-store`; t20 family ARIA rows show metadata only; t21 checkout fields passed through exactly, the return page never says "paid"; t24 OIDC only, `NPM_TOKEN` as a BuildKit secret, non-root image.

### Dependencies between tasks
t0 → t1 → {t2, t4}; t2 → {t3, t5, t23, t24}; t3 → {t9, t13, t14, t20, t21}; t5 → {t7}; {t3, t5} → {t6, t8, t11, t12}; {t4, t9} → t10; t9 → t18 → t17 → t19 (t19 also t5); {t9, t13} → t15; t14 → t16; {t4, t5} → t22; {t3, t5} → t25; t25 + t6–t12 → t26; t25 + t13–t20 → t27; t25 + t21–t24 → t28.
