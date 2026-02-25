# Lesson 02: Wearable Connections

**Course:** Settings & Billing
**Module:** Settings
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

CentenarianOS can pull health data automatically from wearable devices, or you can import it manually via CSV. The Wearable Connections page manages both. This lesson covers every provider, what each one syncs, and how to connect and disconnect them.

---

### Navigating to Wearable Connections

Click **Settings** → **Wearables** in the dashboard sidebar. The page is at `/dashboard/settings/wearables`.

---

### Two Types of Providers

The page shows seven provider cards, split into two types:

**OAuth providers** — connect once and data syncs automatically on a schedule. You authenticate with the provider's own login.

**CSV providers** — no persistent connection. You export data from the source app or device, then import the CSV file manually.

---

### OAuth Providers (Auto-Sync)

**Oura Ring**
Syncs sleep, activity, and readiness scores. Connect using your Oura account credentials.

**WHOOP**
Syncs recovery scores, strain, and sleep performance. Connect using your WHOOP account.

**Garmin**
Syncs steps, sleep, heart rate, and stress. Connect using your Garmin Connect account.

**Connecting an OAuth Provider:**
Click **Connect** on the provider card. You're redirected to that provider's authorization page — log in with your account there and grant CentenarianOS read access. After authorization, you're redirected back to `/dashboard/settings/wearables?connected={provider}` and a green success banner appears.

Once connected, each card shows:
- A green **Connected** badge with a checkmark
- **Last synced: [date/time]** — when data was last pulled
- A sync error message (in red) if the last sync attempt failed

**Syncing Manually:**
Click **Sync** (teal button) on any connected card to trigger an immediate data pull instead of waiting for the automatic schedule. A spinner shows while syncing.

**Disconnecting:**
Click **Disconnect** (red button). A confirmation dialog appears:

> "Disconnect [provider]? Your synced health data will be preserved."

Your historical data from that provider stays in your health metrics — disconnecting only stops future syncs. You can reconnect at any time.

---

### CSV Providers (Manual Import)

**Apple Health**
Export data from the iPhone Health app and import via CSV.

**Google Health**
Export from Google Health on Android and import via CSV.

**InBody**
Body composition scan results — import the InBody-exported CSV.

**Hume Health**
Emotional wellness data — import via Hume's CSV export.

**Importing CSV Data:**
Click **Import CSV** on any CSV provider card. This links to `/dashboard/metrics/import?source={provider}` — the health metrics import page, pre-filtered to that provider's format.

The import page accepts the provider's standard CSV format and maps columns to your health metrics automatically. Multiple imports from the same provider are additive — they add new data points without overwriting existing ones.

---

### Status Messages

After connecting or disconnecting, a flash banner appears at the top of the page:
- **Green** (success): "Connected" or disconnect confirmed
- **Red** (error): Describes what went wrong

Banners auto-dismiss after 5 seconds.

---

### Bulk Import

At the bottom of the Wearables page, a gray callout box:

> "Bulk Import — Have historical data from any source? Import it via CSV to backfill your health metrics. → Go to Import"

The **Go to Import** link opens `/dashboard/metrics/import` without a pre-selected source — useful if you have data from a device not listed as a provider.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/settings/wearables — show the full page]

> [SCREENSHOT: Wearables page — callouts: OAuth providers section (Oura, WHOOP, Garmin) with Connect buttons, CSV providers section (Apple Health, Google Health, InBody, Hume) with Import CSV buttons]

> [SCREEN: Click "Connect" on Oura — redirect to Oura authorization page]

> [SCREENSHOT: Oura authorization page — callout: "Authorize CentenarianOS to read your data"]

> [SCREEN: Authorize — redirect back — green success banner — Oura card now shows Connected badge]

> [SCREENSHOT: Connected Oura card — callouts: Green "Connected" badge, "Last synced: [timestamp]", Sync button (teal), Disconnect button (red)]

> [SCREEN: Click "Sync" — spinner appears — sync completes]

> [SCREEN: Click "Disconnect" — confirmation dialog appears]

> [SCREENSHOT: Disconnect dialog — callout: "Your synced health data will be preserved" — reassurance message]

> [SCREEN: Show a CSV provider card — click "Import CSV" — show the import page redirect]

> [SCREENSHOT: CSV provider card — callout: "Import CSV" button, "Import via CSV export from iPhone" description]

> [SCREEN: Scroll to Bulk Import callout at the bottom]

> [SCREENSHOT: Bulk import callout — callout: "Go to Import" link]

> [SCREEN: End on the wearables page — end lesson]

---

## Key Takeaways

- Wearables page at /dashboard/settings/wearables — 7 providers in two types
- OAuth (Oura, WHOOP, Garmin): Connect → authorize on provider's site → auto-sync; Sync button for manual trigger; Disconnect preserves historical data
- CSV (Apple Health, Google Health, InBody, Hume Health): Import CSV → opens metrics import page pre-filtered to that provider
- Connected cards show: green badge, last synced timestamp, and sync errors in red
- Disconnect dialog confirms data is preserved before removing the connection
- Bulk Import callout at the bottom links to /dashboard/metrics/import for unlisted sources
