# sotercare-console

The care home's web dashboard (Next.js App Router), used by `org_admin`, `facility_manager` and `ward_head` (read).

## Views
- **Live floor view**: ward → room → resident tiles. State colours (normal / open alert with elapsed timer / claimed by name / pad moisture / band offline / low battery)
- **Alert board**: Open / Claimed / Resolved today, with re-push count, phones reached and time to claim
- **Alert timeline**: raised → each re-push round → seen → claimed by → escalations → resolved (outcome and note)
- **Manager escalation**: unclaimed ≥ 2 min → banner + sound (the manager's primary channel is the mobile app push); "gateway offline" banner
- **Manager settings**: per-manager on-call / quiet hours for escalation pushes
- **Shifts dashboard** (see `../b2b-plan/05-Staff-Shifts-and-Check-in.md`). Shifts are set and changed **only by managers**:
  - **roster planner** (week/month by ward and staff, recurring patterns, copy last week, conflict and coverage warnings, draft → publish);
  - shift editor (edit, extend, cancel, reassign for cover/swap, roster change history);
  - **Now** (per ward: on shift now, current availability, open claims, next shift change);
  - **Today's availability** (timeline per on-shift staff member: on site / online / offline; display only, kept 48 h);
  - **Upcoming** (7 days, headcount vs coverage rule, unfilled slots);
  - **Staff** (wards, upcoming shifts, app readiness);
  - templates, shift margin and coverage rules;
  - notification settings.
- **No attendance reports.**
- **Agent outputs** (see `../b2b-plan/06-Agentic-Design.md`):
  - **Review queue** for harsh proposals (draft rosters, cover assignments, monthly report, resident profiles, care-routine changes, band reassignments) and **uncertain** proposals (both views shown) with approve / edit / reject;
  - insights inbox with evidence charts and feedback;
  - **"Why" view** per output: the case trace (which specialists were asked, their answers, Critic objections, evidence links);
  - handovers and daily care logs;
  - morning brief;
  - device tasks and dead-zone report.
- **Staff on shift**: local vs cloud connection, alert readiness, current claim
- **Metrics**: time to claim / resolve (median, p90) by shift, ward and hour; unclaimed ≥ 2 min; alerts per resident; false-alarm rate; ward-head escalations. Per-caregiver figures are managers only
- **Resident page**: incident history, moisture episodes, activity, skin-temperature trend, band history
- **Devices**: gateway status; bands (battery, RSSI, firmware, last seen, assignment)
- **Administration**: wards and rooms, residents, staff and roles, shifts, **family accounts (invite, link to residents, revoke)**, band ↔ resident assignment, alert policy (timers, sign-off), reports and exports

## Rules
- BFF with httpOnly cookies. **The token is never exposed to browser JavaScript.** The socket uses a short-lived ticket issued by the BFF
- Environment-based API URLs (no hard-coding); unlimited socket reconnect, plus re-fetch of the live snapshot on reconnect; error boundaries
- Shows "last update hh:mm" when data is stale (for example during the facility's internet outage; the gateway kiosk is the live source then)

## Stack
Next.js · React · TypeScript · Tailwind · TanStack Query · Socket.IO client · charts library (follow the dataviz guidelines) · Playwright e2e · `@sotercare/contracts`

## Origin: built from the `web-dev-v2` dashboard (D-20)
- **Created from** `SoterCare/sotercare-website` (formerly `web-dev-v2`) at **`4837021`**, the last commit before the dashboard was removed (`e88ba1e`), with `phase-1/alert-reliability` (`19aec37`) merged in. The marketing pages are then deleted (they stay in `sotercare-website`)
- **Keep:** BFF proxy (`server-proxy.ts`, `proxyHeaders.ts`), `alertEvents.ts` + tests, `WebSocketContext.tsx` (reconnect + snapshot), Next.js / Tailwind setup
- **Adapt:**
  - `AlertsPanel`, `useAlerts`, `StatsTimeline`, `TemperatureStatistics`, `VitalsDisplay`, `latestVitals` become the alert board, timelines and resident charts;
  - `NoPhoneBanner` / `notificationStatus` become the staff-readiness and gateway-offline banners;
  - the recycle bin becomes admin restore
- **Replace:** `auth.ts`, `useDeviceId.ts` (one device per user) and `mockData.ts` become Cognito through the BFF with facility / ward / resident navigation
- Full list: `../b2b-plan/07-Old-Repo-Mapping.md` §3.7
