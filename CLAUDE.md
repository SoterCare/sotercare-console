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

**Plan:** `D:\SoterCare\Github-B2B\b2b-plan\` (docs 01–07; not in a repo yet).
- `D-xx` refers to its decision log and `O-x` to its open items (`04-Repos-and-Roadmap.md` §5).
- `07-Old-Repo-Mapping.md` says which old code each repo starts from.

```
sotercare-pcb-designs ── board for ──► sotercare-firmware (thigh band, ~60 per facility)
band ── facility Wi-Fi, local link (transport: open item O-5) ──► sotercare-edge-gateway (1 per facility)
staff phones ◄── local MQTT over WSS (alerts, claims, presence) ── gateway
gateway ── AWS IoT Core → SQS (alert-record, telemetry, heartbeat) ──► sotercare-backend
backend ── record_ack, shadows (roster / bands / policy / keys), cmd/claim ──► gateway
backend ── REST + Socket.IO ──► sotercare-console, sotercare-mobile
backend ── SNS → APNs / FCM push ──► sotercare-mobile
backend ── outbox → SQS events, S3 Parquet export, internal API ──► sotercare-agents
agents ── outputs / proposals / case traces (internal API) ──► backend
sotercare-contracts ── schemas + generated types ──► firmware, gateway, backend, agents, console, mobile
sotercare-infra ── provisions and deploys ──► AWS (IoT Core, ECS, RDS, Cognito, SNS, S3, Bedrock)
sotercare-studio ── records ──► sotercare-iot-dataset ── trains ──► sotercare-ml ── models ──► firmware, gateway
sotercare-website (sotercare.com), sotercare-links (links.sotercare.com): standalone
```

**Platform rules (every repo):**
- **The gateway is the only real-time safety rule engine and claim arbiter** (D-08).
  - The cloud never derives fall / SOS / moisture alerts from telemetry.
  - Agents never create or change alerts.
- **Wellness product** (D-06): no "medical", "diagnosis" or clinical-threshold wording in code, UI or docs.
- **Every cross-repo message is defined in `sotercare-contracts`.** Pin a version and run contract tests. Never keep a local copy of a schema.
- **Tenancy:** every record carries `org_id` (and `facility_id` where relevant). The backend enforces row-level security.
- **AWS `ap-south-1`** (Mumbai). **Amazon Bedrock** is the only LLM provider (D-07).
- **Build from the old repos' work** (D-20). Keep git history when moving code in. Rewrite only what the B2B design changes.

**Git and commits:**
- Trunk-based, protected `main`, PRs with CI (lint, typecheck, tests, contract tests).
- Conventional commits (`feat:`, `fix:`, `docs:`…).
- **Never add `Co-Authored-By:` or any AI-attribution trailer to commits.**
- No secrets in git. Use env files that are git-ignored locally, and AWS Secrets Manager in the cloud.

