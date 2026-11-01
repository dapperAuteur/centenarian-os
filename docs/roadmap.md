---
app: centenarianos
name: CentenarianOS
stage: live
url: https://www.centenarianos.com
updated: 2026-11-01
---

## Live now
- Correlations, retrospective and weekly review across health, habits, focus, nutrition and finance
- Planner, workouts, exercises, recipes, metrics and the Centenarian Engine
- Finance from statement CSV and PDF import, transfer tracking, budgets from history and vendor bills
- One-way Google Calendar sync
- Income and work-schedule events received from Work.WitUS
- Sign in with WitUS beside email sign-in, including silent sign-in on the login page
- Media tracking retired to Stream.WitUS: read-only list, no writes (410), CSV export that Stream.WitUS imports

## In progress
- Decomposition into one job per app (plan 49): Work.WitUS separation is partly done (plan 55)
- Media to Stream.WitUS (plan 49, Stage 1): export in 500-row parts for Stream's import limit, no likes or shares on media, export link on the Data Hub (branch feat/media-retire-to-stream); then a production export and import hand check (witus task 146)
- RideWitUS endpoints and events (plan 70, wave 1): tracked contract at docs/integrations/ridewitus-contract.md with shared signing test vectors; the calendar activity feed now goes through the outbox (retried when RideWitUS is down) and RideWitUS Sync now can re-send calendar events

## Next
- Confirm the Work.WitUS database separation and update the database section of this repo's docs
- Refreshed Phase 3 plan for the Work.WitUS table move (plan 55)

## Backlog
- Academy courses move to Learn.WitUS (plan 49, Stage 3)
- Travel moves to RideWitUS, with trip summaries sent back here (plan 49, Stage 4)
- Public publishing and community surfaces move out (plan 49, Stage 5)
- Final cleanup of retired tables (plan 49, Stage 6)
- Garmin data, compare-over-time reports and account sorting (plans 64, 67, 68, 69, awaiting decisions)
- Receivers for signed events from Invest.WitUS and the fitness assessment app

## Blocked on
- Stage 2 kickoff decisions and database provisioning (task 51)
- Postgres 17 client for the schema dump (task 56)
- Owner decisions on plans 64 to 69
