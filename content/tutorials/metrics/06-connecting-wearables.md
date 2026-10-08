# Lesson 06: Connecting Wearables

**Course:** Mastering Health Metrics
**Module:** Integrations
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Manual logging works, but your watch, ring or scale already has months of data. Today you bring that data in with each device's CSV export; direct Garmin sync is on the way. This lesson shows where your devices live in Settings, how their data is kept apart, and why importing the same export twice never doubles anything.

---

### Where to Manage Integrations

Navigate to `/dashboard/settings/wearables`. This page lists the supported sources, each with what it can bring in.

You can also go straight to the Health Metrics import page (`/dashboard/metrics/import`) and pick the source there.

---

### What Each Card Offers

**Garmin — Coming Soon:**
Direct Garmin sync needs Garmin's developer approval and is not switched on yet, so the card shows **Coming Soon**. Next to it:
- **Import CSV** opens the import page with Garmin selected
- **Template** downloads the Garmin CSV template

**CSV sources:**
Apple Health, Google Health, InBody and Hume Health each have an **Import CSV** button (the import page with that source selected) and a **Template**. Export a CSV from the provider's app and import it (Lesson 05).

**Oura and WHOOP:**
There is no Oura or WHOOP card yet. Choose **Oura** or **WHOOP** on the import page and import the CSV the Oura or WHOOP app exports.

---

### How Your Device Data Is Kept

Every source keeps its own row for each day:

- A Garmin day, an Apple Health day and a day you typed in yourself are stored side by side. They are never added together, so two devices counting the same steps can't double your total.
- Importing the same export again adds nothing. A day that is already stored only gains values in fields that are blank today; the values you have are kept unless you tick **Replace existing values** on the import page.
- Click **Check rows** before importing to see how many days are new, already imported, gaining fields, or different.

When Garmin sync is switched on, it will write to the same Garmin rows your Garmin CSV imports create, keyed on Garmin's own calendar day, so a day is never stored twice and a value Garmin doesn't send is never erased.

---

### Where Device Data Shows Up

Your own daily log (Manual Entry) drives the 7-day summary strip, stats, personal records and the main trend charts. Device rows keep their source: on the Trends page, turn on **Compare Sources** to chart Garmin, Apple Health or InBody next to your own entries.

Most people with several devices use each for what it measures best: a ring for sleep and HRV, a watch for steps and activity, a scale for body composition.

---

### Activities Are Different

Rides, runs, walks and hikes from Garmin are activities, not daily totals. Import them from **Travel → Import → Garmin Activities CSV**, where they become trips (Mastering Travel Tracking, Lesson 07). Each activity is recognised by its start time, so importing the same activities again adds nothing.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/settings/wearables — show the full page with all provider cards]

> [SCREENSHOT: Wearables settings page — callouts: Garmin card with Coming Soon, Import CSV and Template; CSV cards (Apple Health, Google Health, InBody, Hume Health) with Import CSV buttons]

> [SCREEN: Click "Import CSV" on the Garmin card — the import page opens with Garmin selected]

> [SCREEN: Upload a Garmin CSV — click Check rows — show the "Before you import" counts]

> [SCREEN: Click Import — then Check rows again on the same file — every day shows as already imported]

> [SCREEN: Open Health Metrics → Trends — turn on Compare Sources — show Garmin next to Manual]

> [SCREEN: End on wearables settings page — end lesson]

---

## Key Takeaways

- Garmin direct sync is Coming Soon; import Garmin's CSV export today from the Garmin card's Import CSV button
- Apple Health, Google Health, InBody and Hume Health import by CSV; Oura and WHOOP too, from the import page
- Each source keeps its own row per day; devices are never added together
- Re-importing an export adds nothing new; stored values are kept unless you tick Replace existing values
- Check rows before Import to see what is new, already imported, or different
- Your own entries drive the summary and main charts; device rows show in Compare Sources
- Garmin activities (rides, runs, walks, hikes) import as trips from Travel → Import
