# Lesson 02: Wearable Connections

**Course:** Settings & Billing
**Module:** Settings
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Wearable Connections page is where your devices' health data comes in. Today every source arrives by CSV export; direct Garmin sync is on the way. This lesson covers each card, where its button takes you, and how CentenarianOS keeps a re-import from doubling anything.

---

### Navigating to Wearable Connections

Click **Settings** → **Wearables** in the dashboard sidebar. The page is at `/dashboard/settings/wearables`.

---

### The Provider Cards

The page shows five provider cards.

**Garmin — Coming Soon**
Steps, sleep, heart rate, stress, workouts and body composition. Direct sync with your Garmin Connect account needs Garmin's developer approval and is not switched on yet, so the card shows an amber **Coming Soon** label. Until then:
- **Import CSV** opens `/dashboard/metrics/import?source=garmin`, the health metrics import with Garmin selected
- **Template** downloads the Garmin CSV template

**Apple Health**
Export data from the iPhone Health app and import via CSV.

**Google Health**
Export from Google Health on Android and import via CSV.

**InBody**
Body composition scan results — import the InBody-exported CSV.

**Hume Health**
Import Hume's CSV export.

Oura and WHOOP have no card yet. On the import page, choose **Oura** or **WHOOP** as the source and import the CSV their apps export.

---

### Importing CSV Data

Click **Import CSV** on any card. This opens `/dashboard/metrics/import?source={provider}` — the health metrics import page with that provider's column mapping selected.

Click **Check rows** before importing. Nothing is saved yet; you see how many days are new, how many are already imported, how many gain values in blank fields, and how many have different values. Then click **Import**.

How repeat imports work:
- Each source keeps its own row per day. Garmin, Apple Health and your own entries are never added together.
- Importing the same export again adds nothing. A day you already have only gains values in fields that are blank today; stored values are kept unless you tick **Replace existing values**, and a blank cell never erases anything.

---

### Status Messages

When a direct connection is offered, connecting or disconnecting shows a flash banner at the top of the page:
- **Green** (success): "Connected" or disconnect confirmed
- **Red** (error): Describes what went wrong

Banners auto-dismiss after 5 seconds.

---

### Bulk Import

At the bottom of the Wearables page, a gray callout box:

> "Bulk Import — Have historical data from any source? Import it via CSV to backfill your health metrics. → Go to Import"

The **Go to Import** link opens `/dashboard/metrics/import` without a pre-selected source — useful for Oura, WHOOP, or a device not listed as a card.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/settings/wearables — show the full page]

> [SCREENSHOT: Wearables page — callouts: Garmin card with Coming Soon, Import CSV and Template; CSV cards (Apple Health, Google Health, InBody, Hume) with Import CSV buttons]

> [SCREEN: Click "Import CSV" on the Garmin card — the import page opens with Garmin selected]

> [SCREEN: Upload a sample CSV — click Check rows — show the "Before you import" counts]

> [SCREENSHOT: Before you import — callouts: New days, Already imported (skipped), Replace existing values toggle]

> [SCREEN: Return to the wearables page — scroll to Bulk Import callout at the bottom]

> [SCREENSHOT: Bulk import callout — callout: "Go to Import" link]

> [SCREEN: End on the wearables page — end lesson]

---

## Key Takeaways

- Wearables page at /dashboard/settings/wearables — Garmin plus four CSV providers
- Garmin direct sync is Coming Soon; its card's Import CSV and Template work today
- Apple Health, Google Health, InBody, Hume Health: Import CSV opens the metrics import with that source selected
- Oura and WHOOP: choose them on the import page and import their CSV exports
- Check rows before Import; re-importing an export never duplicates a day, and stored values are kept unless you tick Replace existing values
- Bulk Import callout at the bottom links to /dashboard/metrics/import for unlisted sources
