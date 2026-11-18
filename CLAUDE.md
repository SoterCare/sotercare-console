# CLAUDE.md: sotercare-console

## What this repo is
The **facility console** (Next.js App Router + BFF) for `facility_manager`, `org_admin` (switches between its facilities, one per request) and `ward_head`. Permissions per `b2b-plan/04` §6: **ward heads edit alert bars (not Critical) and resident settings** and can Pause a resident; managers also run shifts, accounts, settings, billing and support access, and may resolve any alert (D-95).

Views:
- live floor, alert board and timelines, manager escalation banner + sound, "gateway offline" / "staff not ready" banners;
- resident page (name + **`residentNo`** everywhere, never band IDs, D-99): alert bar ("Applied on the gateway hh:mm"), bedtime / wake, pad type, Pause, **band: assign / unassign / swap** from the pool or by QR, admission / transfer / **discharge** (refused while an alert is open, O-31; a **per-family-account choice**: read-only period or deactivate now, D-101); the **"Critical off" list**;
- **medications** (D-98, D-111, `21`): resident medication records (add / edit / pause / stop, ward heads, managers, org admins), **each typed from an uploaded doctor's recommendation and linked to it** (can't save without one), the per-resident **medication log**, today's rounds per ward, live overdue list, the **medication record view (MAR)** with PDF export, on-time % per ward and week (no per-caregiver ranking);
- **Medical records tab** on the resident page (D-112, `21` §10): pictures, PDFs, references and text with categories, dates, sources and versions; upload / new version for ward heads, managers and org admins, view for staff; shows which medications a recommendation supports; "Scanning…" until the virus scan is clean;
- shifts (`08` §5): roster planner, Now ("Nobody on shift"), today's availability, upcoming, **roster-gap warnings**;
- Devices admin (the only place band IDs appear, D-99): one-time provisioning, the **band pool** (available / assigned), identify, lost, Studio, the gateway with its **`gatewayId`** (D-100);
- Admin: **staff and family accounts with temporary passwords and login slips** (family: unlink or deactivate **each account individually**, D-101), manager resets, station-PIN clear, layout, **settings + alert-policy sign-off** (safety limits `09` §2.1), **support access** grants, audit, **data requests** (export / correct / erase / consent withdrawal) and **legal hold** (`15` §3–4), Studio mode for unassigned bands;
- **Billing** (`12` §2): overview, invoices, pay now (PayHere), saved card, bank-transfer report, billing details; overdue / suspended banners, read-only history while suspended;
- agent views: outputs, review queue, "why" view; staff **ARIA**; metrics (per-caregiver figures managers only). The family weekly brief has **no hold** (D-51). **No view of family ARIA chats** for any role, managers and org admins included (D-113); the audit shows chat metadata only;
- Admin → Settings → Family app: the **"Family live view"** switch (default on, D-114).

It also owns the **shared design tokens and chart style** used by mobile, ops console and the nurse station (`10` §5; home O-22).

Plan docs (`16` §3): 03 §3, 04, 05 §2–4, 07, 08, 09, 10 §5, 11 §4 + §9, 12, 14 §5–6, 15, 21, 22, and `17` §3.7.

## Current stage / next work
Only the starter README and this file are here. Track **W** (`18` §5.1):
1. **Day 0:** cut-over (`17` §3.7): from `sotercare-website` at **`4837021`**, merge its `phase-1/alert-reliability` (`19aec37`), delete the marketing pages. Write `docs/spec.md` + `docs/plan.md`.
2. **Days 1–2:** skeleton, BFF auth (tenant pool from `name@tenantId`), i18n, chart components + design tokens (tokens by Day 4).
3. **Days 3–7:** live floor, alert board / timelines, residents + alert bar, shifts. Checkpoints Day 3 (`admin@demo` logs in) and Day 5 (live floor).
4. **Days 8–12:** admin (staff, family incl. per-account unlink / deactivate, station PIN, layout, settings, policy sign-off, support access, audit), **band pool + assign / swap** and the discharge family choice, **Medical records tab** (upload, versions), **medications** (records from a doctor's recommendation, log, rounds, overdue list, MAR + PDF), billing, agent views (review queue, why view), metrics. Checkpoints Days 10 and 12.
5. **Days 13–14:** polish, Playwright e2e.

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
  - **development complete on 28 Nov 2026** (D-115): all 37 acceptance scenarios green on simulators, ESP32-C6 dev kits / Rev A boards and a Pi 5 gateway;
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
- **Build from the old repos' work** (D-20), keeping git history.

**Git and commits:**
- Protected `main`, PRs with CI (lint, typecheck, tests, contract tests against the pinned contracts version). SerenEdge tasks merge to `dev`; a release PR moves `dev` → `main` (O-23).
- Conventional commits (`feat:`, `fix:`, `docs:`…).
- **Never add `Co-Authored-By:` or any AI-attribution trailer to commits.**
- No secrets in git; AWS Secrets Manager in the cloud.
