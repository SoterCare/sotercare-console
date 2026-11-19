# CLAUDE.md: sotercare-console

## How work lands here
Work on this repo now comes from **SerenEdge**: this repo is one SerenEdge project (D-103), and each change starts as a SerenEdge task (or issue) with a key such as `PROJ-42`. The existing history on `main` stays as it is; from here on, every change lands through this branch structure:

- **`main`**: release branch only. It moves forward only when `dev` is merged into it at a release point (release PR `dev` → `main`, O-23).
- **`dev`**: the integration branch where day-to-day work comes together.
- **One short-lived branch per task or issue**, cut from `dev` and merged back into `dev` by pull request, then deleted.

Rules for every agent and contributor:
1. **Work only on a branch off `dev`:**
   - a task: `task/<KEY>-<short-slug>`, for example `task/PROJ-42-add-due-dates`;
   - a bug or issue: `issue/<KEY>-<short-slug>`, for example `issue/PROJ-57-login-error`.
2. **Open a pull request into `dev`.** Never commit or push straight to `main` (or straight to `dev`).
3. **Commit messages are `<KEY>: short imperative summary`**, for example `PROJ-42: add due dates`.
4. **No attribution of any kind:** never add a `Co-Authored-By` trailer, a "Generated with" line, or any AI or agent attribution to commits, pull requests, code comments or docs.
5. **Never commit secrets or a `.env` file.**
6. **Don't add new frameworks or dependencies without asking first.**
7. **Keep changes small and tied to one task;** unrelated fixes get their own task or issue and branch.

## What this repo is
The **facility console** (Next.js App Router + BFF) for `facility_manager`, `org_admin` (switches between its facilities, one per request) and `ward_head`. Permissions per `b2b-plan/04` §6: **ward heads edit alert bars (not Critical) and resident settings** and can Pause a resident; managers also run shifts, accounts, settings, billing and support access, and may resolve any alert (D-95).

Views:
- live floor, alert board and timelines, manager escalation banner + sound, "gateway offline" / "staff not ready" banners;
- resident page (name + **`residentNo`** everywhere, never band IDs, D-99): alert bar ("Applied on the gateway hh:mm"), bedtime / wake, pad type, Pause, **band: shown read-only** (the resident's band as mirrored from the gateway, "Synced hh:mm"; **no assign button**: pairing happens only at the nurse station or in the staff app on the facility Wi-Fi, D-132), admission / transfer / **discharge** (refused while an alert is open, O-31; a **per-family-account choice**: read-only period or deactivate now, D-101); the **"Critical off" list**;
- **medications** (D-98, D-111, `21`): resident medication records (add / edit / pause / stop, ward heads, managers, org admins), **each typed from an uploaded doctor's recommendation and linked to it** (can't save without one), the per-resident **medication log**, today's rounds per ward, live overdue list, the **medication record view (MAR)** with PDF export, on-time % per ward and week (no per-caregiver ranking);
- **Medical records tab** on the resident page (D-112, `21` §10): pictures, PDFs, references and text with categories, dates, sources and versions; upload / new version for ward heads, managers and org admins, view for staff; shows which medications a recommendation supports; "Scanning…" until the virus scan is clean;
- shifts (`08` §5): roster planner, Now ("Nobody on shift"), today's availability, upcoming, **roster-gap warnings**;
- Devices admin (the only place band IDs appear, D-99): provisioning status (provisioning itself is BLE in the staff app), the **band pool and assignments, read-only** (available / assigned, from the gateway's mirrored assignment records, live via WS `band.assignment`; **no assign / unassign / swap action**, D-132), identify (find a band), lost, Studio, the gateway with its **`gatewayId`** (D-100);
- Admin: **staff and family accounts with temporary passwords and login slips** (family: unlink or deactivate **each account individually**, D-101), manager resets, station-PIN clear, layout, **settings + alert-policy sign-off** (safety limits `09` §2.1), **support access** grants, audit, **data requests** (export / correct / erase / consent withdrawal) and **legal hold** (`15` §3–4), Studio mode for unassigned bands;
- **Billing** (`12` §2): overview, invoices, pay now (PayHere), saved card, bank-transfer report, billing details; overdue / suspended banners, read-only history while suspended;
- agent views: outputs, review queue, "why" view; staff **ARIA**; metrics (per-caregiver figures managers only). The family weekly brief has **no hold** (D-51). **No view of family ARIA chats** for any role, managers and org admins included (D-113); the audit shows chat metadata only;
- Admin → Settings → Family app: the **"Family live view"** switch (default on, D-114).

It also owns the **shared design tokens and chart style** used by mobile, ops console and the nurse station (`10` §5; home O-22).

Plan docs (`16` §3): 03 §3, 04, 05 §2–4, 07, 08, 09, 10 §5, 11 §4 + §9, 12, 14 §5–6, 15, 21, 22, and `17` §3.7.

## Current stage / next work
**Full spec and plan approved (19 Nov):** [`docs/spec.md`](docs/spec.md) (Part A: platform + operational views; Part B: records, admin, billing, agents, testing) and [`docs/plan.md`](docs/plan.md) (Tasks 0–24, lanes W1 / W2). The console runs as a **container** (BFF + Redis sessions; infra updated) and its socket uses a **single-use ticket** (contracts C-33).
1. **19 Nov:** Task 0 import from `sotercare-website` at `4837021` + `phase-1/alert-reliability` (`19aec37`) in a temp clone (filter-repo drops junk and 97 co-author lines), then delete the marketing site in one commit.
2. **20–21 Nov:** skeleton on tokens, BFF login + MFA + sessions (CP2: `admin@demo` logs in), facility switching, shared charts, ticketed socket.
3. **22–23 Nov (CP3):** live floor, banners + escalation sound, alert board, residents + alert settings; accounts, layout, settings (W2).
4. **24 Nov (CP5):** policy sign-off, medication records from recommendations, Medical records tab, discharge choices, timeline / trends / band (read-only), Devices, shifts.
5. **25–26 Nov (CP7):** rounds / overdue / MAR, support access / audit / data, billing, updates / review / why / metrics. **27–28 Nov:** E2E + accessibility + acceptance. **INT:** staff ARIA.

## Connections
| Direction | Repo | Via | What |
|---|---|---|---|
| in/out | `sotercare-backend` | REST `/v1` through the BFF, Socket.IO | everything shown and every admin, billing and ARIA action |
| in | PayHere | hosted checkout (started by the backend) | invoice payments, saved card |
| uses | `sotercare-contracts` | npm (GitHub Packages) | API and WebSocket types; mock server before the backend exists |
| shows output of | `sotercare-agents` | via backend | outputs, review queue, case traces, ARIA |
| design tokens for | `sotercare-mobile`, `sotercare-ops-console`, `sotercare-edge-gateway` | shared package (O-22) | colours, chart style |
| deployed by | `sotercare-infra` | Amplify / CloudFront + WAF | — |

## Rules
- BFF with httpOnly cookies; tokens never reach browser JavaScript; the socket uses a short-lived ticket. Session 12 h, idle timeout 30 min; MFA for managers and org admins (D-61).
- Accounts only by managers / org admins, temporary password, no e-mail invites (D-28). The last active manager can't be deactivated (D-60).
- Critical off only by a manager with a reason; a ward head can't switch Critical off (`07` §3).
- Shifts set and changed only by managers. **No attendance reports**; availability is display only (D-17).
- While suspended, safety and access screens stay editable (D-64); AI views and history are read-only.
- Show "last update hh:mm" when data is stale; the nurse station is the live source during an internet outage.
- No hard-coded strings (i18next, ICU); per-caregiver metrics for managers only (never for medication rounds).
- Staff views identify residents by name + `residentNo`, never band IDs (D-99); band IDs only in Devices admin.
- **The console never assigns bands** (D-132): band ↔ resident pairing is done on the gateway (nurse station or staff app over the local connection), which is authoritative. Show the mirror read-only with its sync time; the backend refuses any write with 409 `assign_via_gateway`. Where users look for it, say "Pair bands at the nurse station".
- Medications are records only: no dose suggestions or checks; a medication can't be saved without a linked doctor's recommendation (D-111); medication and medical-records screens keep working while suspended (D-64).
- Medical records files: uploaded straight to S3 by presigned URL, shown only through short-lived URLs after the scan; never to family.

## Design
The look and its rules are in `b2b-plan/22-Design-System.md`. Tokens, fonts and logos are in `sotercare-contracts/design/` (`tokens.json`, `assets/`), the proposed O-22 home. This repo builds the **shared chart components** on those tokens (`22` §8.9) for mobile and the ops console.
- Keep the old dashboard look (`4837021`): `#FAFAFA` page + dot grid, `.depth-card` (`#F8F8F8`, `shadow-m`, radius 16) header and 256 px sidebar, active nav = dark pill, inline brand-blue logo 36–40 px, URW Geometric 400 / 500 / 700 (600 renders as Bold).
- Replace the dashboard's Tailwind default colours (emerald / amber / red / sky / indigo) with tokens. No raw hex.
- Live floor and alert board use the priority colours and tile states (`22` §3): critical `#DC2626`, urgent `#C2410C`, normal `#FFAB66` with dark text, low = grey icon, gateway offline = `#B91C1C` banner + sound. **Colour + icon + word**, never colour alone.
- Brand text and links are ink `#3D7E93`; cyan and logo blue are never text. Light mode only.

## How the SoterCare B2B platform fits together

**Plan:** `D:\SoterCare\Github-B2B\b2b-plan\` (v2: docs 01–22, one topic per file; 22 = design system, tokens in `sotercare-contracts/design/`).
- Start with `README.md`, `01-Product-and-Scope.md` and `02-System-Architecture.md`.
- Which docs this repo needs: `16-Repos-and-Ownership.md` §3.
- `D-xx` / `O-x` refer to `19-Decisions-and-Open-Items.md`, the decision log. **When docs disagree, 19 wins.**
- Old code to start from: `17-Old-Code-Carry-Over.md`.
- Build order and checkpoints: `18-Build-Plan-2-Weeks.md` ("Build Plan to 28 Nov"):
  - **Day 0 gate 18–19 Nov** (every repo's spec + plan, SerenEdge projects, cut-over), then dated daily checkpoints CP1–CP8 (20–27 Nov);
  - **development complete on 28 Nov 2026** (D-115): the acceptance scenarios for its tier green (18 §0, §9; priorities D-133) on simulators, ESP32-C6 dev kits / Rev A boards and a Pi 5 gateway;
  - if a checkpoint slips, the **cut order** in 18 §10.2 applies (D-116); the safety core is never cut.

**SerenEdge (D-103):** no new repos. **Each repo is one SerenEdge project**, and projects are connected through SerenEdge's **linked knowledge bases**, so any project can ask another's.
- The **`sotercare-contracts` project is the hub:** its knowledge base holds the full b2b-plan, which is committed into `sotercare-contracts/docs/b2b-plan/` at the Day 0 gate.
- Every other project links the hub's knowledge base (and the projects it talks to), instead of copying plan text.

```
sotercare-pcb ── Rev A board (Rev B = pilot band, D-102) ──► sotercare-firmware (thigh band)
band ── UDP + AES-CCM over facility Wi-Fi (06) ──► sotercare-edge-gateway (= nurse station, 1 per home)
staff phones ◄── local MQTT over WSS (alerts, claims, presence) ── gateway
gateway ── MQTT/TLS to AWS IoT Core → SQS (Wi-Fi or LTE) ──► sotercare-backend
backend ── record_ack, shadows (roster / bands / residents / policy / keys / service), cmd/claim ──► gateway
backend ── one RDS database per tenant (silo) + control DB
backend ── REST + Socket.IO ──► sotercare-console (facility), sotercare-mobile (Care staff / Family)
backend ── medication records, dose rounds, marks, MAR (21; not alerts, never via the gateway) ──► console, mobile
backend ── SNS → APNs / FCM push (alerts; medication round reminders) ──► sotercare-mobile
backend ── REST /v1/ops ──► sotercare-ops-console (SoterCare staff)
backend ── outbox → SQS events, S3 Parquet, internal API (medication: counts only) ──► sotercare-agents (agents + ARIA; GitHub `sotercare-iit`, D-125)
sotercare-contracts ── schemas + generated types; SerenEdge hub (b2b-plan) ──► firmware, gateway, backend, agents, consoles, mobile
sotercare-infra ── provisions AWS + per-tenant resources ──► all cloud parts
sotercare-studio ── records ──► sotercare-iot-dataset (data + model training) ── gait model ──► gateway
sotercare-website (sotercare.com), sotercare-links (links.sotercare.com): standalone
```

**Platform rules (every repo):**
- **The gateway is the only real-time safety rule engine and claim arbiter** (D-08).
  - The cloud never derives alerts from telemetry.
  - Agents never create or change alerts.
- **Wellness wording** (D-06): no "medical", "diagnosis", "fever" or clinical thresholds.
- **Medications are records and reminders only** (D-98, `21`): never advice; no agent, ARIA output or push text names a medication (D-49).
- **Staff screens show the resident's name + resident number (`residentNo`), never band IDs** (D-99); band IDs only in Devices admin.
- **Every cross-repo message is defined in `sotercare-contracts`.** Pin a version and run contract tests; never copy schemas.
- **Silo tenancy** (D-31): one tenant per request / case; never hold two tenants' data in one operation.
- **AWS `ap-south-1`**; **Bedrock** is the only LLM provider (D-07).
- **Translation-ready UI** (D-26): no hard-coded user-facing strings.
- **Build from the old repos' work** (D-20), keeping git history, **except `sotercare-iit`**: competition rule, original work only, no old code (D-125).

**Git and commits:** see [How work lands here](#how-work-lands-here) at the top of this file; those rules apply to every change in this repo. PRs run CI (lint, typecheck, tests, contract tests against the pinned contracts version). Secrets live in AWS Secrets Manager in the cloud, never in git.
