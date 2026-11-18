# sotercare-console

The care home's **facility console** (Next.js App Router with a BFF), used by `facility_manager`, `org_admin` and `ward_head`. What each role can do is in `../b2b-plan/04-Identity-and-Access.md` §6: ward heads edit alert bars (except Critical) and resident settings; managers and org admins also manage shifts, accounts, settings, billing and support access.

Plan: `../b2b-plan/07-Alerting.md`, `08-Staff-and-Shifts.md`, `09-Facility-Settings.md`, `12-Billing-and-Suspension.md`, `14-Contracts.md` §5–6; full list in `16-Repos-and-Ownership.md` §3.

## Views
- **Live floor:** ward → room → resident tiles (alert state with timer, claimed by, moisture, band offline / low battery / charging, alert-bar icons).
- **Alert board and timeline:** open / claimed / resolved; raised → re-push rounds → claimed → arrived → escalations → resolved with verdict and outcome.
- **Banners:** manager escalation (banner + sound), gateway offline, staff not ready, nobody on shift, overdue / suspended billing, account-recovery notice.
- **Residents:** shown by name + **resident number** (`R-0012`), never band IDs (D-99); band assign / unassign / swap from the pool or by QR (applied on the gateway in seconds); alert bar with "Applied on the gateway hh:mm", bedtime / wake time, pad type, temperature sensitivity, haptic nudge, temporary "until" changes, **Pause**, admission, transfer, **discharge** (refused while an alert is open; choose per linked family account: read-only period or deactivate now, D-101); a list of every resident with **Critical off**.
- **Shifts** (managers): roster planner, shift editor, Now, today's availability (display only), upcoming coverage, **roster-gap** warnings, templates and rules. No attendance reports.
- **Admin:**
  - staff and family accounts (`name@tenantId`, **temporary password**, printable **login slip**, password reset, deactivate, link family to residents, clear station PIN);
  - wards, rooms, beds; devices (gateway with its `gatewayId`, one-time band provisioning, the **band pool**, identify, assignments, charging dock, Studio mode for unassigned bands): the only place band IDs appear;
  - family accounts unlinked or deactivated **per person** (D-101);
  - **facility settings** and **alert-policy sign-off** within the safety limits;
  - **support access** grants (1 h – 7 days, read-only, revocable);
  - audit view and export (family ARIA chats appear as metadata only; no role can read or export them, D-113);
  - the **Family live view** switch (default on, D-114);
  - **data requests** (export, correct, erase, consent withdrawal) and **legal hold**.
- **Medical records tab (D-112, `21` §10):** per resident, pictures, PDFs, references and text with categories and versions; ward heads, managers and org admins upload, staff view; never shown to family.
- **Medications (D-98, D-111, `21`):** medication records per resident, each typed from an uploaded **doctor's recommendation** and linked to it (versioned, audited, with the **medication log**), today's rounds per ward, overdue list, the medication record view (MAR) with PDF export, on-time % per ward and week. Records and reminders only, never advice.
- **Billing:** plan, billable beds, invoices + PDFs, pay now and saved card (PayHere), "I paid by bank transfer", credit notes, billing details.
- **Agent outputs:** handovers, care logs, insights, morning brief, device tasks (the family weekly brief auto-publishes Monday 08:00 with no hold, D-51); **review queue** (approve / edit / reject, uncertain items with both views); **"why" view** (case trace); staff **ARIA**.
- **Metrics:** time to claim / arrival / resolve, false-alarm rate per bed per week, escalations, step-ins. Per-caregiver figures for managers only.

## Rules
- BFF with httpOnly cookies; **tokens are never exposed to browser JavaScript**; the socket uses a short-lived ticket. Session 12 h, idle timeout 30 min; MFA for managers and org admins.
- Environment-based API URLs; unlimited socket reconnect with a snapshot re-fetch; error boundaries; "last update hh:mm" when data is stale.
- Translation-ready (i18next, ICU); no hard-coded strings.
- Owns the shared design tokens and chart style (`10` §5, O-22).

## Stack
Next.js App Router · React · TypeScript · Tailwind · TanStack Query · Socket.IO client · i18next · charts (shared style) · Playwright e2e · `@sotercare/contracts`

## Origin: built from the `web-dev-v2` dashboard (D-20)
- **Created from** `SoterCare/sotercare-website` (formerly `web-dev-v2`) at **`4837021`**, the last commit before the dashboard was removed (`e88ba1e`), with `phase-1/alert-reliability` (`19aec37`) merged in. The marketing pages are then deleted (they stay in `sotercare-website`).
- **Keep:** BFF proxy (`server-proxy.ts`, `proxyHeaders.ts`), `alertEvents.ts` + tests, `WebSocketContext.tsx` (reconnect + snapshot), Next.js / Tailwind setup.
- **Adapt:**
  - `AlertsPanel`, `useAlerts`, `StatsTimeline`, `TemperatureStatistics`, `VitalsDisplay`, `latestVitals` → alert board, timelines and resident charts;
  - `NoPhoneBanner` / `notificationStatus` → staff-readiness and gateway-offline banners;
  - the recycle bin → admin restore.
- **Replace:** `auth.ts`, `useDeviceId.ts` and `mockData.ts` → Cognito through the BFF with facility / ward / resident navigation.
- Full list: `../b2b-plan/17-Old-Code-Carry-Over.md` §3.7.
