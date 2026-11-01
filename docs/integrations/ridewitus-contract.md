# CentenarianOS, RideWitUS and Work.WitUS: endpoints and events contract

**Status:** current as of 2026-11-01. This is the tracked copy of the contract in CentOS plan 70 §1
(`plans/70-ridewitus-d4-endpoints-and-events.md`, gitignored), so sessions that cannot read `plans/`
(cloud sessions, other repos) work from the same text. When the contract changes, change this file in
the same branch as the code.

**Builds on (decided, not open):** RideWitUS is the single travel home. CentOS travel (trips, fuel,
maintenance, components) and Work.WitUS's job-costed mileage move there; CentOS and Work.WitUS read
summaries from RideWitUS. Every row keys off the WitUS user id (the OIDC `sub`, `witus_sub` on the wire),
never an app-local id. Design source: RideWitUS PRD §6 (`ride-wit-us/plans/future/PRD.md` v0.4).

**Signing test vectors:** `tests/fixtures/witus-signing-vectors.json` in this repo is the source of
truth (see the last section).

---

## 1. Rules every item follows

These match RideWitUS PRD §6.2 and the WitUS signed-webhook contract
(`claude/witus-inbox/docs/webhook-contract.md`).

- **Wire format.** `X-Witus-Source`, `X-Witus-Timestamp` (unix seconds), `X-Witus-Signature:
  sha256=<hex(HMAC-SHA256(secret, "<timestamp>.<signedBody>"))>`. A POST signs its raw body exactly as
  sent. A GET signs its path plus query string exactly as sent (`lib/events/sign-request.ts`
  `signedGetBody`), so the `witus_sub` that picks whose data comes back cannot be edited in flight. The
  receiver never rebuilds or reorders the query before checking it. The `sha256=` prefix is required
  between these apps (the WitUS Inbox also accepts bare hex; these receivers do not).
- **Replay window.** 300 seconds, absolute skew (future timestamps rejected too), constant-time compare
  (`lib/events/verify-signature.ts`). A capture replayed inside the window is harmless by design: every
  handler is either a read or an idempotent latest-state upsert.
- **Keys.** One secret per endpoint or receiver, generated with `openssl rand -hex 32` (at least 32
  characters, webhook contract "Secret requirements"), the same value on both apps, distinct per
  environment. The receiver checks the source slug too: `ride-witus`, `centenarianos`, `work-witus`
  (`gemini/witus/lib/products.ts`, checked 2026-10-31). `centenarian-os` is the Inbox/Outbox slug and is
  not accepted here.
- **Identity.** Every request and event carries `witus_sub`. CentOS resolves it with
  `userIdForWitusSub` (`witus_identities`); RideWitUS resolves it against `users.witus_sub`; Work.WitUS
  sends the sub it holds for the signed-in person. No mapping = `unknown_subject`: a 404 on a request, a
  per-row rejection on an event (the sender keeps the row pending and never marks it failed).
- **Idempotency key.** Events carry `event_id`, deterministic per fact (`trip:<uuid>`,
  `envelope:<goal uuid>`, `cal:<sha256 of calendar_sync_items.id>`). Receivers upsert on
  `(user_id, event_id)`; an event whose `occurred_at` is older than the stored row is **accepted and
  ignored** (not rejected, so the sender marks it sent). Resync: the 5-minute limit plus idempotent
  re-emits. GETs are reads.
- **Batches.** One event or `{ "events": [...] }`, at most 500. More is a 400 `too_many_events`.
- **Event response** (2xx means the batch arrived): `{ "accepted": <n>, "rejected": [{ "event_id": "...",
  "reason": "..." }] }`. Rows not named are sent. New receivers use the object form. CentOS's own income
  receiver returns strings (`app/api/events/income/route.ts`); do not copy that shape. Both outboxes parse
  both forms (`rejectedIds` in `lib/integrations/outbox.ts`; RideWitUS ports it).
- **Request response** (the ecosystem envelope): `{ "ok": true, "data": ... }` or `{ "ok": false,
  "error": "...", "code": "..." }`.
- **Failure without config.** Secret unset = 503 `not_configured` on a receiver or endpoint; URL or
  secret unset = a logged no-op on a sender (rows stay pending, so setting the env later delivers them).
- **Privacy.** No coordinates, no GPS, no receipts, no descriptions or attendees, no transactions. Logs
  carry status codes and counts, never bodies, secrets or signatures.

## 2. Error codes

| HTTP | `code` / row `reason` | Meaning | Sender does |
|---|---|---|---|
| 200 / 202 | (none) | Accepted (202 for resync) | Mark sent |
| 200, row | `unknown_subject` | No mapping for that `witus_sub` yet | Keep pending on backoff, never fail |
| 200, row | `unsupported_schema_version` | Major version the receiver does not know | Fail the row, alert |
| 200, row | `invalid_event` (with a field name) | Row failed validation | Fail the row, alert |
| 400 | `invalid_body`, `invalid_subject`, `invalid_scope`, `invalid_since`, `too_many_events` | Bad request shape | Fix the sender; do not retry the same body |
| 401 | `unauthorized` (one flat message) | Signature, timestamp, headers or source wrong | Retry once on clock skew, then alert |
| 404 | `unknown_subject` | Request for an unmapped `witus_sub` | Show "connect CentenarianOS" (or RideWitUS) |
| 404 | `not_found` | Item is not this user's | Show "not found" |
| 429 | `rate_limited` + `Retry-After` | Resync more than once per 5 minutes | Show the wait |
| 500 | `lookup_failed` | Database error | Retry on backoff |
| 503 | `not_configured` | Secret unset on the receiver | Retry on backoff; alert after the last delay |

## 3. Contract table

Status key: **Built** = on CentOS `main`. **Gap** = built but missing a piece. **New** = not built.

| ID | Item | Direction | Method and path | Secret (both apps) | Rate limit | Status | Needed by (RideWitUS phase) |
|---|---|---|---|---|---|---|---|
| E1 | Vendors list | RideWitUS → CentOS (pull) | `GET /api/v1/ride/vendors?witus_sub=&q=&limit=&offset=&since=` | `RIDE_VENDOR_API_SECRET` | None on CentOS; RideWitUS debounces typing (300 ms) and times out at 4 s | Built | 1f |
| E2 | One vendor | RideWitUS → CentOS | `GET /api/v1/ride/vendors/:id?witus_sub=&since=` | same | same | Built | 1f |
| E3 | Vendor prices | RideWitUS → CentOS | `GET /api/v1/ride/vendors/:id/prices?witus_sub=&since=&limit=` | same | same | Built | 1f |
| E4 | Sync now | RideWitUS → CentOS | `POST /api/v1/ride/resync` | `RIDE_RESYNC_SECRET` | 1 per user per 5 min, both sides | Gap: `envelopes` and `calendar` built; `matches` not built | 2d |
| E5 | `envelope.balance` | CentOS → RideWitUS (push) | `POST <ENVELOPE_BALANCE_EVENTS_URL>` = RideWitUS `/api/events/envelope-balance` | `ENVELOPE_BALANCE_EVENTS_SECRET` | Outbox: 500 per request | Built (sender); receiver New | 2b |
| E6 | `calendar.activity` | CentOS → RideWitUS | `POST <RIDEWITUS_CALENDAR_ACTIVITY_URL>` = RideWitUS `/api/events/calendar-activity` | `CALENDAR_ACTIVITY_EVENTS_SECRET` | 500 per request | Built (sender, on the outbox); receiver New | 2b, 2c |
| E7 | `cost.matched` | CentOS → RideWitUS | `POST <FINANCE_MATCH_EVENTS_URL>` = RideWitUS `/api/events/finance-match` | `FINANCE_MATCH_EVENTS_SECRET` | 500 per request | New (both sides) | 2b |
| E8 | `trip.summary` | RideWitUS → CentOS | `POST /api/events/mobility-activity` | `MOBILITY_ACTIVITY_EVENTS_SECRET` | 500 per request | New (both sides) | 2a exit, Stage 4 |
| E9 | `trip.plan`, `forecast.item`, `vehicle.snapshot`, `cost.recorded` | RideWitUS → CentOS | `POST /api/events/mobility-cost` | `MOBILITY_COST_EVENTS_SECRET` | 500 per request | New (both sides) | 2a exit, Stage 4 |
| E10 | Travel for this job | Work.WitUS → RideWitUS (pull) | `GET /api/v1/work/job-travel?witus_sub=&work_job_ref=` | `WORK_JOB_TRAVEL_API_SECRET` | None; Work.WitUS calls on page view, 4 s timeout, stores nothing | New | 2e |
| (P) | `activity.recorded` (Garmin) | CentOS → RideWitUS | RideWitUS `/api/events/activity-recorded` | `ACTIVITY_RECORDED_EVENTS_SECRET` | 500 per request | Parked (CentOS plan 64); listed so names do not collide | Phase 4 |

Not in this contract (no endpoint needed): the calorie estimate (CentOS computes it inside E8);
depreciation for all tools (CentOS-only); the travel UI cutover. Calendar `#trip` tokens need no
RideWitUS write API: CentOS creates no record for `#trip` (`lib/capture/calendar-records.ts`), the parsed
token travels in E6 as `trip_token`, and RideWitUS turns it into a trip or a suggestion.

## 4. Items

Example ids and subs are placeholders, not real values.

### E1 to E3. Vendors

Read-only by owner decision (PRD Q14): RideWitUS never creates vendors; it links to
`create_vendor_url`. Differences from PRD §6.9: no `POST /api/v1/ride/vendors`; `created_at` instead of
`updated_at` (`user_contacts` has no `updated_at`); adds `category`, `city`, pagination and optional
`recent_prices`. Route code: `app/api/v1/ride/vendors*`; logic: `lib/integrations/ridewitus/vendors.ts`.

```http
GET /api/v1/ride/vendors?witus_sub=SUB_EXAMPLE&q=shell&limit=50
X-Witus-Source: ride-witus
X-Witus-Timestamp: 1793400000
X-Witus-Signature: sha256=<hmac over "1793400000./api/v1/ride/vendors?witus_sub=SUB_EXAMPLE&q=shell&limit=50">
```

```json
{ "ok": true, "data": {
  "vendors": [{ "id": "VENDOR_UUID", "name": "Shell on Main", "company_name": "Shell", "category": "Fuel",
    "website": null, "phone": "555-0100", "city": "Indianapolis, IN, US",
    "locations": [{ "id": "LOC_UUID", "label": "Main St", "address": "100 Main St", "is_default": true }],
    "created_at": "2026-03-02T15:00:00Z" }],
  "next_offset": null, "currency": null,
  "create_vendor_url": "https://<centos-host>/dashboard/contacts/new?type=vendor&name=shell" } }
```

- `limit` 1 to 200, default 50; `offset` from the previous page's `next_offset`; `q` is a
  case-insensitive "name contains"; `since` (YYYY-MM-DD) adds each vendor's `recent_prices` (up to 10,
  newest first).
- E2 answers `{ vendor, currency: null }`; an id that is not this user's vendor is 404 `not_found`.
- E3 answers `{ vendor_id, since, prices: [{ item_name, price, unit, unit_price, recorded_date, source }],
  currency: null }`, newest first; `since` defaults to 180 days ago, `limit` 1 to 200 (default 50).
- `currency` stays null until CentOS stores one on `item_prices`.
- RideWitUS stores only `vendor_refs` (CentOS contact id plus optional location id) and never caches a
  response.

### E4. Sync now

```json
POST /api/v1/ride/resync
{ "witus_sub": "SUB_EXAMPLE", "scopes": ["calendar", "matches", "envelopes"], "since": "2026-10-01" }
```

```json
202 { "ok": true, "data": { "request_id": "REQ_UUID",
  "scopes": { "envelopes": { "status": "queued", "queued": 2 },
              "calendar":  { "status": "queued", "queued": 14 },
              "matches":   { "status": "nothing_to_send", "queued": 0 } },
  "delivery": [{ "receiver": "ridewitus.calendar_activity", "sent": 14, "retrying": 0, "failed": 0, "skipped": 0 }] } }
```

- No `scopes` = all three. Scope status: `queued`, `nothing_to_send`, `skipped` (with `note`, such as
  `not_configured` when that receiver's URL or secret is unset), `not_available` (not built), `error`.
- `envelopes` is current state and ignores `since`. `calendar` re-emits the shared calendars' window
  (past 14 days, next 30), narrowed to events starting on or after `since` when it is given.
- The limiter is in module memory, so it is per warm instance; acceptable because every re-emit is an
  idempotent latest-state upsert. RideWitUS enforces its own 1 per 5 minutes on the button and shows
  "last received" per scope.

### E5. `envelope.balance`

```json
{ "event_id": "envelope:GOAL_UUID", "event_type": "envelope.balance", "schema_version": 1,
  "witus_sub": "SUB_EXAMPLE", "occurred_at": "2026-10-31T14:00:00Z", "is_active": true,
  "envelope_id": "GOAL_UUID", "link_type": "trip", "link_id": "CENTOS_TRIP_UUID", "link_source": "centenarian-os",
  "label": "Chicago trip", "goal_kind": "trip", "balance": "240.00", "target_amount": "600.00",
  "target_date": "2026-12-10", "currency": "USD", "status": "active", "as_of": "2026-10-31T14:00:00Z",
  "deep_link": "https://<centos-host>/dashboard/finance/savings/GOAL_UUID" }
```

`link_type` is `trip` or `equipment` today, with CentOS ids (`savings_goals.linked_trip_id`,
`linked_equipment_id`). RideWitUS stores the latest row per `envelope_id` (a projection) and shows it
beside the trip or vehicle whose id matches. The Stage 4 import keeps ids, so a CentOS trip id is the
RideWitUS trip id after migration. `link_source` is a payload label, not the auth slug; the header slug is
`centenarianos`. `link_type: vehicle` comes after Stage 4 (owner decision, 2026-11-01).

### E6. `calendar.activity`

Fields (`lib/ridewitus/calendar-activity.ts`): `event_id` (`cal:` plus SHA-256 of the row id),
`event_type`, `schema_version: 1`, `witus_sub`, `occurred_at`, `starts_at`, `ends_at`, `all_day`,
`time_zone`, `title` (`"Event"` when the calendar hides titles), `location`, `calendar_label`, `status`,
`trip_token` (`{ distance_miles, mode, duration_min }` or null), `is_active`. Filters (all in CentOS):
shared calendars only (off by default), a location required, past 14 and next 30 days. A later
`travel_hint` field (CentOS plan 66) may be added at `schema_version` 1, so the receiver must ignore
unknown fields.

Delivery: through `integration_outbox` (receiver key `ridewitus.calendar_activity`, migration 217, env
names unchanged; `lib/ridewitus/delivery.ts` `outboxActivityDelivery`). After each sync, sharing change
or retraction, the events are queued (one row per `event_id`, the newest payload wins) and that user's
due rows are sent at once. Rows RideWitUS does not accept stay pending on the outbox backoff (1 min,
5 min, 30 min, 2 h, 12 h, then `failed`; `unknown_subject` never fails) and go out with the next write or
the daily cron. Without migration 217 the sender falls back to a direct signed POST. "Sync now" with
scope `calendar` re-queues the shared calendars' window, narrowed by `since`.

### E7. `cost.matched`

Sent when the user confirms, changes or removes a match between a `cost.recorded` item (E9) and a CentOS
transaction, and once per migrated pre-matched row.

```json
{ "event_id": "match:fuel:RIDE_FUEL_UUID", "event_type": "cost.matched", "schema_version": 1,
  "witus_sub": "SUB_EXAMPLE", "occurred_at": "2026-10-31T14:05:00Z", "is_active": true,
  "source_type": "fuel", "source_id": "RIDE_FUEL_UUID", "matched": true,
  "transaction_amount": "48.12", "transaction_currency": "USD", "transaction_date": "2026-10-30",
  "deep_link": "https://<centos-host>/dashboard/finance/transactions/TX_UUID" }
```

Unmatching sends `matched: false`. RideWitUS stores the reference only.

### E8. `trip.summary` to `/api/events/mobility-activity`

Common fields on every RideWitUS event: `event_id`, `event_type`, `schema_version`, `witus_sub`,
`occurred_at`, `is_active`.

```json
{ "events": [{ "event_id": "trip:RIDE_TRIP_UUID", "event_type": "trip.summary", "schema_version": 1,
  "witus_sub": "SUB_EXAMPLE", "occurred_at": "2026-10-31T13:00:00Z", "is_active": true,
  "trip_id": "RIDE_TRIP_UUID", "date": "2026-10-31", "mode": "bike", "vehicle_kind": "bike",
  "purpose": "commute", "category": "fitness", "distance_miles": 6.2, "duration_min": 34,
  "active_minutes": 31, "calories_kcal": null, "calories_source": null, "assist_level": null,
  "co2_kg": 0, "co2_avoided_kg": 1.05, "is_human_powered": true, "status": "completed" }] }
```

```json
200 { "accepted": 1, "rejected": [] }
```

CentOS upserts `mobility_activity_events` on `(user_id, event_id)`. When `calories_source` is null and
the trip is human-powered, CentOS fills `calories_kcal` from MET x body mass on the trip date x hours and
stores `calories_source = 'estimate'` (PRD §7.2). MET values come from the 2024 Adult Compendium, fetched
and checked in the session that builds the estimate; until then no estimate is stored (null, not a
guess). Loop guard: RideWitUS never emits `trip.summary` for a trip whose `source` is a CentOS-originated
import that CentOS already counts, and demo users never emit.

### E9. Cost events to `/api/events/mobility-cost`

| `event_type` | `event_id` | Projection table | Key fields |
|---|---|---|---|
| `trip.plan` | `plan:<trip uuid>` | `mobility_cost_events` | `trip_id`, `label`, `start_date`, `end_date`, `budget_amount`, `currency`, `tax_category`, `destination_label` |
| `forecast.item` | `forecast:<vehicle>:<kind>:<YYYY-MM or service>` | `mobility_cost_events` | `kind`, `vehicle_id`, `vehicle_label`, `label`, `expected_date`, `expected_amount` (omitted when unknown), `currency`, `basis`, `due_by_miles`, `confidence` |
| `vehicle.snapshot` | `vehicle:<uuid>:<YYYY-MM>` | `mobility_vehicle_snapshots` | `vehicle_id`, `vehicle_label`, `vehicle_kind`, `ownership`, `month`, `miles_actual`, `miles_projected`, `cost_fuel`, `cost_maintenance`, `cost_depreciation`, `cost_per_mile`, `book_value`, `currency` |
| `cost.recorded` | `cost:<source_type>:<source uuid>` | `mobility_cost_events` | `source_type`, `source_id`, `date`, `amount`, `currency`, `vendor`, `vehicle_label`, `category_hint`, `work_job_ref` (nullable), `centos_transaction_id` (nullable, migration only) |

```json
{ "event_id": "cost:fuel:RIDE_FUEL_UUID", "event_type": "cost.recorded", "schema_version": 1,
  "witus_sub": "SUB_EXAMPLE", "occurred_at": "2026-10-30T22:10:00Z", "is_active": true,
  "source_type": "fuel", "source_id": "RIDE_FUEL_UUID", "date": "2026-10-30", "amount": "48.12",
  "currency": "USD", "vendor": "Shell on Main", "vehicle_label": "Civic", "category_hint": "auto_fuel",
  "work_job_ref": null, "centos_transaction_id": null }
```

`centos_transaction_id` carries an existing transaction link from a migrated row; CentOS records the
match as confirmed and answers with E7. `work_job_ref` lets CentOS (and later Work.WitUS) tell business
costs apart without reading RideWitUS.

### E10. Travel for this job (on RideWitUS)

Work.WitUS's job page calls it server-side. RideWitUS returns only the caller's own rows tagged with that
job ref, so a wrong or foreign `work_job_ref` returns an empty list, never another person's data.
Work.WitUS checks that the signed-in person may see the job before it calls. Trips get their job from a
"Log travel for this job" link on the Work.WitUS job page (`?work_job_ref=` prefilled); fuel reaches the
job through cost allocation, not its own tag (owner decision, 2026-11-01).

```http
GET /api/v1/work/job-travel?witus_sub=SUB_EXAMPLE&work_job_ref=JOB_UUID
X-Witus-Source: work-witus
```

```json
{ "ok": true, "data": {
  "work_job_ref": "JOB_UUID", "as_of": "2026-10-31T14:00:00Z",
  "trips": [{ "trip_id": "RIDE_TRIP_UUID", "date": "2026-10-28", "mode": "car", "purpose": "work",
    "tax_category": "business", "origin_label": "Home", "destination_label": "Lucas Oil Stadium",
    "is_round_trip": true, "distance_m": 41842.7, "distance_miles": 26.0, "duration_s": 3120,
    "cost": { "amount": "12.00", "currency": "USD" }, "fuel_cost": { "amount": "3.41", "currency": "USD" },
    "deep_link": "https://<ridewitus-host>/app/trips/RIDE_TRIP_UUID" }],
  "totals": { "trip_count": 1, "distance_m": 41842.7, "distance_miles": 26.0,
    "by_currency": [{ "currency": "USD", "trip_costs": "12.00", "fuel_costs": "3.41", "total": "15.41" }] },
  "log_url": "https://<ridewitus-host>/app/trips/new?work_job_ref=JOB_UUID" } }
```

`work_job_ref` is the Work.WitUS `contractor_jobs.id`, kept as text. `fuel_cost` is RideWitUS's FIFO
allocation for owned fuel-burning vehicles; null until that exists. Amounts are never converted (PRD
§5.7); Work.WitUS applies its own mileage rate. A date-range read for Work.WitUS reports is deferred
(owner decision, 2026-11-01).

## 5. Env names per app

Names only. Values are generated per environment and set by piping, never pasted (witus `CLAUDE.md`,
"Post-deploy automation rule", secrets). Production values first; preview deployments leave them unset,
so previews fail closed (503 or no-op) instead of sending a preview's events into production.

| Name | CentOS | RideWitUS | Work.WitUS |
|---|---|---|---|
| `RIDE_VENDOR_API_SECRET` | checks | signs | |
| `RIDE_RESYNC_SECRET` | checks | signs | |
| `CENTOS_API_URL` | | base URL for E1 to E4 | |
| `ENVELOPE_BALANCE_EVENTS_URL` / `_SECRET` | sends | checks (secret) | |
| `RIDEWITUS_CALENDAR_ACTIVITY_URL` / `CALENDAR_ACTIVITY_EVENTS_SECRET` | sends | checks (secret) | |
| `FINANCE_MATCH_EVENTS_URL` / `_SECRET` | sends | checks (secret) | |
| `MOBILITY_ACTIVITY_EVENTS_SECRET` | checks | signs | |
| `MOBILITY_COST_EVENTS_SECRET` | checks | signs | |
| `MOBILITY_ACTIVITY_EVENTS_URL` / `MOBILITY_COST_EVENTS_URL` | | sends | |
| `WORK_JOB_TRAVEL_API_SECRET` | | checks | signs |
| `RIDEWITUS_API_URL` (proposed; confirm against Work.WitUS naming) | | | base URL for E10 |
| `CRON_SECRET` | outbox cron | drain cron, demo reset | |
| `ACTIVITY_RECORDED_EVENTS_URL` / `_SECRET` | reserved (plan 64, parked) | | |

## 6. Signing test vectors

`tests/fixtures/witus-signing-vectors.json` holds known-good requests (method, path plus query, body,
timestamp, secret, the exact signed string and the expected `X-Witus-*` headers) and must-reject cases
(stale and future timestamps, an edited or reordered query, an edited or re-serialized body, a wrong
secret, a wrong or Inbox-style source slug, a bare-hex signature, a bad timestamp, a missing header, and
no secret = 503). Every value in it is a made-up test value.

- **Source of truth:** this repo. Change the file here first.
- **Copies:** RideWitUS keeps a byte-identical copy (`tests/fixtures/witus-signing-vectors.json` there).
  Work.WitUS copies it when it builds its signed client. Copy the file unchanged; do not regenerate it in
  the other repo.
- **Tests:** here, `tests/unit/witus-signing-vectors.test.ts` runs every case through
  `lib/events/sign-request.ts`, `lib/events/verify-signature.ts` and `verifyRideRequest`. RideWitUS runs
  the same cases through its port.

To check by hand against a deployed endpoint once the secrets are set, sign a fixture with
`openssl dgst -sha256 -hmac "$SECRET"` over `"<timestamp>.<signed>"`: it should get 200; the same body with
one byte changed, or a timestamp 301 seconds old, should get 401; an unmapped sub should get
`unknown_subject`.
