# sotercare-console

The care home's **facility console** (Next.js App Router with a BFF), used by `facility_manager`, `org_admin` and `ward_head`. What each role can do is in `../b2b-plan/04-Identity-and-Access.md` §6: ward heads edit alert bars (except Critical) and resident settings; managers and org admins also manage shifts, accounts, settings, billing and support access.

Plan: `../b2b-plan/07-Alerting.md`, `08-Staff-and-Shifts.md`, `09-Facility-Settings.md`, `12-Billing-and-Suspension.md`, `14-Contracts.md` §5–6; full list in `16-Repos-and-Ownership.md` §3.

## Views
- **Live floor:** ward → room → resident tiles (alert state with timer, claimed by, moisture, band offline / low battery / charging, alert-bar icons).
- **Alert board and timeline:** open / claimed / resolved; raised → re-push rounds → claimed → arrived → escalations → resolved with verdict and outcome.
- **Banners:** manager escalation (banner + sound), gateway offline, staff not ready, nobody on shift, overdue / suspended billing, account-recovery notice.
- **Residents:** alert bar with "Applied on the gateway hh:mm", bedtime / wake time, pad type, temperature sensitivity, haptic nudge, temporary "until" changes, **Pause**, admission, transfer, **discharge** (refused while an alert is open); a list of every resident with **Critical off**.
- **Shifts** (managers): roster planner, shift editor, Now, today's availability (display only), upcoming coverage, **roster-gap** warnings, templates and rules. No attendance reports.
- **Admin:**
  - staff and family accounts (`name@tenantId`, **temporary password**, printable **login slip**, password reset, deactivate, link family to residents, clear station PIN);
  - wards, rooms, beds; devices (gateway, bands, assignments, charging dock, Studio mode for unassigned bands);
  - **facility settings** and **alert-policy sign-off** within the safety limits;
  - **support access** grants (1 h – 7 days, read-only, revocable);
  - audit view and export;
  - **data requests** (export, correct, erase, consent withdrawal) and **legal hold**.
- **Billing:** plan, billable beds, invoices + PDFs, pay now and saved card (PayHere), "I paid by bank transfer", credit notes, billing details.
- **Agent outputs:** handovers, care logs, insights, morning brief, device tasks; **review queue** (approve / edit / reject, uncertain items with both views); **"why" view** (case trace); staff **ARIA**.
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
