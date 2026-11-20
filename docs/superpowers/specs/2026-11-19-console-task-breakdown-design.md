# sotercare-console: SerenEdge task breakdown (design)

Status: draft for the Project Head, 19 Nov 2026.
Product spec (approved 19 Nov, unchanged by this document): [`docs/spec.md`](../../spec.md). Implementation plan (approved 19 Nov): [`docs/plan.md`](../../plan.md), Tasks 0–24.

## 1. Purpose
This document turns the approved console plan into SerenEdge tasks for project `sotercare-console` (key `SCCON`). It does not change what the console does: the product rules live in `docs/spec.md`, and `b2b-plan/19` wins when docs disagree. It adds three things the SerenEdge workflow needs that the original plan doesn't have:
1. a **CI foundation** task (the repo has no CI yet, and `npm run build` currently fails because `prebuild` calls a `scripts/check-copy.mjs` that was removed with the marketing site);
2. **test tasks** that verify the build tasks end to end (the spec §15 Playwright flows, split per checkpoint);
3. the **security and manual work** each task carries (§5).

## 2. Starting point (repo on `dev`, 19 Nov)
- Task 0 is done: the dashboard is imported with history and the marketing site is removed (`46cfed8`, `a9bf856`).
- Still from the old site: `package.json` named `web-dev-v2`, marketing dependencies (`gsap`, `lenis`, `resend`, `styled-components`, `@react-email/*`, `@vercel/analytics`, `@portabletext/react`, `pdfjs-dist`, `react-image-crop`), tests on `node --test` (`tests/*.test.mjs`), the old `src/app/api/*` proxy routes and `src/app/dashboard/*` pages, `src/proxy.ts` reading an `accessToken` cookie (to be replaced by the BFF).
- No `.github/`, no `.serenedge/`, no `typecheck` script.

## 3. Approach
- **One plan task → one SerenEdge task**, as the backend did ([[sotercare-backend:backend-task-breakdown]]). Tasks over 800 changed lines are kept whole with `allowLarge` rather than split into halves that don't work alone.
- **Changes to plan Task 1:** its CI part moves into the CI foundation task, and its `Dockerfile` moves into a new deploy task with the deploy workflow.
- **Plan Task 24 (E2E) becomes four `test` tasks**, one per checkpoint group, so each build task names the test task that verifies it (`testedBy`). Unit and component tests stay inside each build task (TDD as in the plan).
- **Milestones** follow the checkpoints: CP2 (21 Nov), CP3 (23 Nov), CP5 (24 Nov), CP7 (26 Nov), Acceptance (28 Nov), INT (1 Dec, staff ARIA).
- **Lanes** W1 (live ops) and W2 (admin + records) stay as skill tags, so two developers can work in parallel. `dependsOn` only where the order is real (everything waits on CI foundation → skeleton → BFF).
- **CI** follows the SoterCare convention ([[sotercare-contracts:how-ci-is-run-and-when-it-may-change]], [[sotercare-firmware:ci-on-prs-into-main-only]]): `serenedge ci` locally on every task branch; the GitHub workflow runs the same steps only on PRs into `main`.
- **Contracts** pinned exactly at `@sotercare/contracts@1.1.0` from GitHub Packages ([[sotercare-contracts:contracts-v1-0-0-released-install-pin-and-what-changes-for-c]]); the mock is `ghcr.io/sotercare/contracts-mock:v1.1.0`.
- **Deploy** uses the infra reusable workflow `deploy-service.yml` (infra spec §11): ARM64 image → ECR `console` → ECS service `console`. The OIDC role `sc-ci-deploy-sotercare-console` accepts only `refs/heads/main` or a GitHub environment, so the console deploys from `main` (release points), never from `dev`.

## 4. Task list (summary)
| # | Task | Plan task | Type | Milestone |
|---|---|---|---|---|
| t0 | CI foundation | (new) | deploy | CP2 |
| t1 | Skeleton on tokens, i18n, lint rules, Vitest | 1 | ui | CP2 |
| t2 | BFF: login, MFA, sessions, proxy, CSRF | 2 | dev | CP2 |
| t3 | Facility switching and role gates | 3 | dev | CP2 |
| t4 | Shared chart components (`@sotercare/charts`) | 4 | ui | CP3 |
| t5 | Realtime: ticketed socket, live reload | 5 | dev | CP2 |
| t6 | Live floor | 6 | ui | CP3 |
| t7 | Banners and escalation sound | 7 | ui | CP3 |
| t8 | Alert board and alert page | 8 | ui | CP3 |
| t9 | Residents: list, admission, overview, alert settings | 9 | ui | CP3 |
| t10 | Resident timeline, trends, read-only band tab | 10 | ui | CP5 |
| t11 | Shifts | 11 | ui | CP5 |
| t12 | Devices admin (read-only pairing) | 12 | ui | CP5 |
| t13 | Accounts: staff, org admins, family | 13 | ui | CP5 |
| t14 | Layout and settings | 14 | ui | CP5 |
| t15 | Discharge, transfer, family choices | 15 | ui | CP5 |
| t16 | Alert policy sign-off | 16 | ui | CP5 |
| t17 | Medication records | 17 | ui | CP5 |
| t18 | Medical records tab | 18 | ui | CP5 |
| t19 | Rounds, overdue, MAR | 19 | ui | CP7 |
| t20 | Support access, audit, data, legal hold | 20 | ui | CP7 |
| t21 | Billing | 21 | ui | CP7 |
| t22 | Updates, review queue, why view, metrics | 22 | ui | CP7 |
| t23 | Staff ARIA and notifications | 23 | dev | INT |
| t24 | Container image and deploy workflow | 1 (Dockerfile), spec §15 | deploy | CP7 |
| t25 | E2E harness + platform flows (CP2) | 24 | test | CP2 |
| t26 | E2E live ops flows (CP3) | 24 | test | CP3 |
| t27 | E2E records and admin flows (CP5) | 24 | test | CP5 |
| t28 | E2E billing, agents, accessibility, acceptance record | 24 | test | Acceptance |

## 5. Security and manual work
### 5.1 What touches security-sensitive areas
| Area | Where | What the reviewer checks |
|---|---|---|
| **Auth** | t2 (Cognito SRP, MFA, Redis sessions, CSRF), t3 (facility switch), t5 (WS ticket), t13 (temporary passwords, MFA reset), t16 (sign-off needs MFA) | tokens never in a response body, browser JS, `localStorage` or a readable cookie; `sc_sid` `HttpOnly; Secure; SameSite=Strict`; 12 h / 30 min idle enforced server-side; CSRF on every non-GET; caregiver and family refused; logout revokes this session only |
| **Permissions** | t3 (role gates), t8, t9, t11–t17, t20, t22 | every route and action declares its roles from `04` §6; Critical off only for managers with a reason; shifts edited by managers only; per-caregiver metrics for managers / org admins only and never for rounds; the backend's 403 is final |
| **Tenancy / isolation** | t2, t3, t5 | `X-Facility-Id` only from the session; the proxy allow-list blocks `/v1/ops`, `/v1/family`, `/v1/auth`, `/v1/push-tokens`; switching facility clears the query cache, the socket and other tabs (scenario 6) |
| **Payments** | t21, t28 | the PayHere form is auto-submitted with exactly the backend's `checkout_session` fields; the return page never claims payment; no card data touches the console |
| **Secrets** | t0 (`NPM_TOKEN` CI secret), t14 (band Wi-Fi password entered in settings), t24 (deploy role) | no secret in git, images or logs; the Wi-Fi password is write-only in the UI (never echoed back); `.env*` stays ignored |
| **Personal data** | t9, t13, t15, t17–t20, t23 | residents shown by name + `residentNo`, never band IDs outside Devices (D-99); medical files only through short-lived presigned redirects with `no-store`; no family ARIA chat text anywhere (D-113); audit CSV exported by managers only |
| **Dependencies** | t0, t1, t2, t4, t25 | only the packages the approved spec §3 names (tanstack query, socket.io-client, ioredis, amazon-cognito-identity-js, i18next + react-i18next + ICU, recharts, @sotercare/contracts, Vitest, Testing Library, MSW, Playwright, axe); the old marketing packages removed; exact versions in the lockfile |
| **Infra** | t24 | the deploy workflow uses OIDC (no AWS keys), deploys only from `main` / a named environment, image has no secrets, runs as non-root |
| **Migrations** | none | the console owns no database |

### 5.2 Manual work (people must do this by hand)
| Step | Task | Owner | Account owner | Proof |
|---|---|---|---|---|
| Create a GitHub token with `read:packages` (org-owned machine user or fine-grained token) and add it as the repo Actions secret `NPM_TOKEN` | t0 | devops | SoterCare GitHub org | secret |
| Grant this repo **Read** under the `@sotercare/contracts` and `contracts-mock` packages' "Manage Actions access" | t0 | head | SoterCare GitHub org | link |
| Confirm the infra OIDC role `sc-ci-deploy-sotercare-console`, ECR repo `console` and ECS service `console` exist in the dev account; add the role ARN as the repo Actions variable `AWS_DEPLOY_ROLE_ARN` | t24 | devops | SoterCare AWS (dev account) | env |
| Set the console task definition's runtime variables in infra (`BACKEND_API_URL`, `WS_URL`, `REDIS_URL`, `COGNITO_REGION`) for `dev` | t24 | devops | SoterCare AWS (dev account) | env |
| Confirm PayHere sandbox is configured on the `dev` backend and share the sandbox test card with the tester | t28 | head | SoterCare PayHere sandbox merchant | note |

Not in this plan: the URW Geometric licence check (WC-7, owned by `sotercare-contracts`; the console uses the system fallback until the fonts ship there), and branch protection on `main` / `dev` (needs a paid GitHub plan; noted in the repo's CLAUDE.md).

### 5.3 Review lanes
Every task with a security flag, manual step or CI change goes to a **human reviewer**. In this plan that is almost every task: the console is mostly auth, permissions and personal data. Only t6, t7, t10 and the E2E tasks t26, t27 have no flag and may take the automatic lane.

## 6. KB concept map (seeded by the tasks)
Core concepts, each seeded by the task that builds it: **BFF session**, **BFF proxy allow-list**, **Facility context**, **WS ticket**, **Role gates**, **Design tokens in the console**, **Shared charts**, **Alert board reducer**, **Live floor**, **Escalation banner**, **Alert settings**, **Read-only band mirror**, **Shifts planner**, **Login slip**, **Discharge family choice**, **Alert policy draft**, **Medication record**, **Doctor's recommendation**, **Medical record upload**, **MAR**, **Support access**, **PayHere checkout form**, **Review queue**, **Staff ARIA stream**, **Deploy workflow**, **Running CI locally**. One `decision` entry summarises this breakdown; conventions carry the project-wide rules (branches, CI, tokens only, no band IDs, no hard-coded strings, BFF holds tokens).
