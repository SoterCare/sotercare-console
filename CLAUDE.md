# CLAUDE.md: sotercare-console

## What this repo is
The **care-home web console** (Next.js App Router), used by `org_admin`, `facility_manager` and `ward_head` (read-only). It covers:
- the live floor view;
- the alert board and timelines;
- manager escalation banners;
- the **shifts dashboard** (roster planner, Now, today's availability);
- staff, devices, metrics, the resident page;
- **family account management**;
- agent outputs: review queue, insights, "why" view, handovers, morning brief.

Specs: `b2b-plan/02`, `05`, `06` §13.

## Current stage
Only the starter README is here. Next, in order:
1. Bring in history from **`sotercare-website` (formerly `web-dev-v2`) at `4837021`**, the last commit before the dashboard was removed in `e88ba1e`. Merge in its `phase-1/alert-reliability` (`19aec37`). Then delete the marketing pages, which stay in `sotercare-website`.
2. Keep the BFF proxy (`server-proxy.ts`, `proxyHeaders.ts`), `alertEvents.ts` + tests and `WebSocketContext.tsx`. Adapt the alerts / vitals components to the new APIs.
3. Cognito via the BFF (httpOnly cookies; the token never reaches browser JavaScript; socket via a short-lived ticket).
4. Live floor + alert board (Phase 1–2); shifts, family and admin (Phase 3); agent views (Phase 4).

## Connections
| Direction | Repo | Via | What |
|---|---|---|---|
| in/out | `sotercare-backend` | REST `/v1` through the BFF, Socket.IO | everything shown and every admin action |
| uses | `sotercare-contracts` | npm | API and WebSocket types |
| shows output of | `sotercare-agents` | via backend | review queue, insights, case traces |
| deployed by | `sotercare-infra` | Amplify / CloudFront + ECS | — |
| separate from | `sotercare-website` | — | marketing stays there |

## Rules
- Shifts are set and changed **only by managers**. **No attendance reports**; availability is display only (D-17)
- Show "last update hh:mm" when data is stale. During a facility internet outage the gateway kiosk is the live source
- Per-caregiver metrics are visible to managers only
- Environment-based API URLs, unlimited socket reconnect with a snapshot re-fetch, error boundaries

## How the SoterCare B2B platform fits together

**Plan:** `D:\SoterCare\Github-B2B\b2b-plan\` (v2: docs 01–20, one topic per file; not in a repo yet).
- Start with `README.md`, `01-Product-and-Scope.md` and `02-System-Architecture.md`.
- Which docs this repo needs: `16-Repos-and-Ownership.md` §3.
- `D-xx` / `O-x` refer to `19-Decisions-and-Open-Items.md`.
- Old code to start from: `17-Old-Code-Carry-Over.md`.
- Build order and checkpoints: `18-Build-Plan-2-Weeks.md`.

```
sotercare-pcb-designs ── Rev A board ──► sotercare-firmware (thigh band)
band ── UDP + AES-CCM over facility Wi-Fi (06) ──► sotercare-edge-gateway (= nurse station, 1 per home)
staff phones ◄── local MQTT over WSS (alerts, claims, presence) ── gateway
gateway ── MQTT/TLS to AWS IoT Core → SQS (Wi-Fi or LTE) ──► sotercare-backend
backend ── record_ack, shadows (roster / bands / residents / policy / keys / service), cmd/claim ──► gateway
backend ── one RDS database per tenant (silo) + control DB
backend ── REST + Socket.IO ──► sotercare-console (facility), sotercare-mobile (Care staff / Family)
backend ── REST /v1/ops ──► sotercare-ops-console (SoterCare staff)
backend ── SNS → APNs / FCM push ──► sotercare-mobile
backend ── outbox → SQS events, S3 Parquet, internal API ──► sotercare-agents (agents + ARIA)
sotercare-contracts ── schemas + generated types ──► firmware, gateway, backend, agents, consoles, mobile
sotercare-infra ── provisions AWS + per-tenant resources ──► all cloud parts
sotercare-studio ── records ──► sotercare-iot-dataset (data + model training) ── gait model ──► gateway
sotercare-website (sotercare.com), sotercare-links (links.sotercare.com): standalone
```

**Platform rules (every repo):**
- **The gateway is the only real-time safety rule engine and claim arbiter** (D-08).
  - The cloud never derives alerts from telemetry.
  - Agents never create or change alerts.
- **Wellness wording** (D-06): no "medical", "diagnosis", "fever" or clinical thresholds.
- **Every cross-repo message is defined in `sotercare-contracts`.** Pin a version and run contract tests; never copy schemas.
- **Silo tenancy** (D-31): one tenant per request / case; never hold two tenants' data in one operation.
- **AWS `ap-south-1`**; **Bedrock** is the only LLM provider (D-07).
- **Translation-ready UI** (D-26): no hard-coded user-facing strings.
- **Build from the old repos' work** (D-20), keeping git history.

**Git and commits:**
- Trunk-based, protected `main`, PRs with CI (lint, typecheck, tests, contract tests).
- Conventional commits (`feat:`, `fix:`, `docs:`…).
- **Never add `Co-Authored-By:` or any AI-attribution trailer to commits.**
- No secrets in git; AWS Secrets Manager in the cloud.
