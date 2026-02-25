# Lesson 06: Connecting Wearables

**Course:** Mastering Health Metrics
**Module:** Integrations
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Manual logging works, but wearable integrations make it automatic. If you have an Oura Ring, WHOOP, or Garmin device, you can connect it to CentenarianOS and have your daily metrics sync without entering them by hand. This lesson covers how to connect your device and what happens when the sync runs.

---

### Where to Manage Integrations

Navigate to `/dashboard/settings/wearables`. This page shows all supported providers with their connection status.

Alternatively, navigate to the Health Metrics import page — the wearable connections section is accessible from there too.

---

### Two Types of Providers

**OAuth providers (automatic sync):**
These connect via OAuth and can pull data automatically. Three providers:
- **Oura Ring** — Syncs sleep score, HRV, recovery/readiness score, SpO2, resting HR, activity
- **WHOOP** — Syncs recovery score, HRV, sleep data, strain (active calories)
- **Garmin** — Syncs steps, resting HR, HRV, sleep, activity minutes, stress score

**CSV import providers (manual file upload):**
These don't have OAuth — you export a CSV from their app and use the import tool. Covered in Lesson 05. Four providers:
- Apple Health
- Google Health
- InBody
- Hume Health

---

### Connecting an OAuth Provider

From the Wearables settings page, find the provider card for your device (Oura, WHOOP, or Garmin).

Click **Connect**. You'll be redirected to that provider's OAuth authorization page. Sign in with your account credentials and grant permission for CentenarianOS to read your health data.

After authorization, you're redirected back to the Wearables settings page. The provider card now shows:
- **"Connected"** badge
- Last sync timestamp (will show "Never synced yet" on first connect)
- A **Sync** button
- A **Disconnect** button

---

### Running a Sync

After connecting, click **Sync** to pull your data. The provider card shows a loading state while syncing. When complete, the last sync timestamp updates.

What gets synced:
- The most recent data from your device (typically the last 7–30 days, depending on the provider's API limits)
- Only metrics you've unlocked in CentenarianOS will be written — if you haven't unlocked HRV, Oura HRV data won't be saved even if the sync fetches it

**Automatic sync:** Syncs run automatically once per day in the background when you're logged in. You don't need to manually click Sync for daily updates — it happens automatically. The manual Sync button is for when you want an on-demand update (e.g., after a morning workout before the auto-sync runs).

---

### Sync Status

The provider card shows one of three sync statuses:

- **Idle** — Connected and up to date. No action needed.
- **Syncing** — A sync is in progress.
- **Error** — The last sync failed. The error message is shown on the card. Common errors: expired token (reconnect by clicking Connect again), provider API outage, or a permissions scope issue.

If you see an error, the first step is always to click **Connect** again and re-authorize. Most sync errors are resolved by re-authorization.

---

### Disconnecting a Provider

Click **Disconnect** on any connected provider. A confirmation prompt appears. After disconnecting:
- The OAuth token is revoked and deleted from CentenarianOS
- **Your existing health data is not deleted** — synced data already in your metrics history remains intact
- Future automatic syncs stop for that provider

You can reconnect at any time by clicking Connect again.

---

### Multiple Providers

You can connect multiple OAuth providers simultaneously. If you have both Oura and Garmin connected, and both provide resting HR data, the sync will write both readings. The last provider to sync wins for any given date — there's no automatic merge or priority system.

Most users with multiple devices use them for different metrics: Oura for sleep and HRV, Garmin for steps and activity. Configure your metric unlocks to reflect which device you trust most for each metric.

---

### CSV Providers

For Apple Health, Google Health, InBody, and Hume Health — there's no direct connection. Instead, export a CSV from the provider's app and use the Import tool (Lesson 05) to upload the data. These providers don't have public OAuth APIs that allow third-party data access.

Each CSV provider card shows an **Import CSV** button that links directly to the import page with that provider pre-selected.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/settings/wearables — show the full page with all provider cards]

> [SCREENSHOT: Wearables settings page — callouts: OAuth provider cards (Oura, WHOOP, Garmin) with Connect buttons, CSV provider cards (Apple Health, Google Health, InBody, Hume Health) with Import CSV buttons]

> [SCREEN: Click "Connect" on Oura Ring card — OAuth redirect page]

> [SCREENSHOT: Oura OAuth page — callout: "Authorize CentenarianOS to read your health data"]

> [SCREEN: Return to wearables settings — Oura card now shows "Connected" badge]

> [SCREENSHOT: Connected Oura card — callouts: Connected badge, Last sync timestamp, Sync button, Disconnect button]

> [SCREEN: Click "Sync" — card shows syncing state — complete — timestamp updates]

> [SCREENSHOT: After sync — updated last sync timestamp — callout: "Auto-sync runs daily — manual sync for on-demand updates"]

> [SCREEN: Show the sync error state on a different card (if possible to demo) — show error message text]

> [SCREEN: Click "Disconnect" on the Oura card — confirmation prompt — cancel (don't disconnect for demo)]

> [SCREEN: Show Garmin card — click "Connect" to start Garmin OAuth (or just show what it looks like)]

> [SCREEN: Click "Import CSV" on Apple Health card — show redirect to import page with Apple Health pre-selected]

> [SCREEN: End on wearables settings page — end lesson]

---

## Key Takeaways

- Three OAuth providers (auto-sync): Oura Ring, WHOOP, Garmin
- Four CSV providers (manual import): Apple Health, Google Health, InBody, Hume Health
- Connect from /dashboard/settings/wearables — OAuth redirects to provider's authorization page
- Auto-sync runs daily in background; manual Sync button for on-demand updates
- Only unlocked metrics are written during sync — unlock metrics in Health Metrics before expecting data
- Sync error → first step is reconnect (re-authorize) — resolves most token expiry issues
- Disconnecting does not delete your existing synced data
- Multiple providers can run simultaneously; last sync wins per date/metric
