# Lesson 05: Importing Health Data

**Course:** Mastering Health Metrics
**Module:** Data Import
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

If you've been using Garmin, Apple Health, Oura, or another health app for months or years, you already have historical data sitting in those systems. The import tool lets you bring that history into CentenarianOS in bulk — up to 365 rows per import — so your analytics and weekly review have context from day one instead of starting cold.

---

### Navigating to Import

From the Health Metrics page, click the **Import** button in the header. This takes you to `/dashboard/metrics/import`.

---

### Choosing a Data Source

At the top of the import page, select your data source. Eight options are available:

**CSV Import providers:**
- **Garmin** — CSV export from Garmin Connect (Health Stats → Export)
- **Apple Health** — CSV export from Apple Health or a third-party export app
- **Oura** — CSV export from the Oura app
- **WHOOP** — CSV export from the WHOOP app
- **Google Health** — CSV export from Google Fit or Health Connect
- **InBody** — CSV export from InBody scale or InBody app
- **Hume Health** — CSV from Hume Health

**Manual Entry:**
- Opens an editable table without any file upload — useful for entering a few days of backlogged data without a CSV

Each source has pre-configured column mapping that matches the typical export format from that provider. When you select a source and upload its CSV, the fields map automatically without manual column configuration. The Garmin and Apple Health **Download Template** files (column names like `logged_date`, `resting_hr`, `steps`) are read too.

Each source keeps its own row per day. A Garmin day, an Apple Health day and a day you typed in yourself are stored side by side and never added together.

---

### Uploading a CSV

After selecting your source, you'll see two options for getting data into the import tool:

**File upload** — Click the upload area or drag a CSV file onto it. The file is parsed immediately in your browser.

**Paste CSV** — Click the "Paste CSV" tab, paste the raw CSV text from your clipboard, and click **Parse CSV**. Useful when you're working from a downloaded file you don't want to navigate to, or when copying directly from an app export.

---

### The Import Data Table

After uploading or pasting, the data appears in an editable table. Each row represents one day:

- **Date** — The calendar date for this entry (YYYY-MM-DD format). Editable via date picker if the parsed date is wrong.
- **Core metric columns** — Resting HR, Steps, Sleep hours, Activity minutes
- **Enrichment metric columns** — Collapsed by default (click to expand), showing HRV, SpO2, Sleep Score, etc. if those columns exist in your export
- **Notes** — Optional text field per row
- **Delete row** — Remove any row you don't want to import (duplicates, test dates, etc.)

You can edit any cell in the table before importing — correct a misread value, remove an outlier, or adjust a date that was formatted incorrectly.

The **Add Row** button at the bottom lets you manually add a row if your CSV was missing a date you have data for.

---

### Validation

Before import, the system validates each row:
- Dates must be in YYYY-MM-DD format (dates in other formats are auto-converted where possible)
- Metric values must be numeric
- Rows without a valid date are skipped and listed as errors
- Rows without any metric values (date only) are skipped

---

### Check Rows, Then Import

When the table looks correct, click **Check rows**. Nothing is saved yet. A "Before you import" panel counts what the import would do for this source:

- **New days** — dates you have no row for yet. They are added.
- **Already imported (skipped)** — days whose values are all already stored. Nothing changes.
- **Days gain blank fields** — days you have, where the file fills in fields that are empty today (for example, sleep score on a day that only had steps).
- **Different values (existing kept)** — days where the file disagrees with what is stored. Your stored values stay. Open **Days with different values** to see which dates and fields.
- **Dates listed twice (merged)** — a file that names the same date twice is merged into one day; the later row wins where both have a value.
- **Invalid rows** — rows with no readable date or no metric.

The **Import** button turns on after the check. If you edit the table, switch source, or change the toggle below, check again.

**Replace existing values** (off by default): tick it when the file should win where it disagrees with what is stored, for example after correcting a value in your export. A blank cell never erases a stored value, with or without the toggle.

After you click **Import**, a green message repeats the counts for what was saved. Importing the same file a second time adds nothing: every day shows as already imported.

**Maximum import size:** 365 rows per import. For larger historical datasets, run multiple imports.

**A full Garmin account export:** the ZIP you request from your Garmin account holds years of data as JSON, not a CSV. The `scripts/garmin-export-to-centos.mjs` script in the CentenarianOS repository turns it into Garmin files of at most 365 days each for this page (steps, resting HR, sleep, stress, Body Battery, weight and more, one row per day), plus a Garmin Activities CSV for the Travel import and a Workouts CSV for the Data Hub.

InBody works a little differently: its scans are matched by their measurement time, so importing the same InBody export again adds only new scans, and the latest scan of each day becomes that day's InBody body-composition row.

---

### After Import

Navigate back to `/dashboard/metrics` after importing. Rows imported as **Manual Entry** are your own daily log: the 7-day summary strip, stats, personal records and the main trend charts read them. Rows imported from a device source (Garmin, Apple Health, Oura and the others) keep that source; open the Trends page and turn on **Compare Sources** to see them next to your own entries.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/metrics — click "Import" button in page header]

> [SCREEN: Import page loads — show the source selector at top]

> [SCREENSHOT: Import page — callouts: Source selector (8 options), Upload area, Paste CSV tab]

> [SCREEN: Select "Garmin" from the source dropdown]

> [SCREEN: Upload a sample Garmin CSV (or demonstrate the paste option)]

> [SCREENSHOT: Data table after CSV parse — callouts: Date column, Core metric columns, Enrichment columns toggle, Delete row button per row, Add Row button at bottom]

> [SCREEN: Edit one cell in the table — demonstrate editing a value]

> [SCREEN: Delete one row — show it disappear]

> [SCREEN: Click Check rows — the "Before you import" panel appears]

> [SCREENSHOT: Before you import — callouts: New days, Already imported (skipped), Days gain blank fields, Different values (existing kept), Replace existing values toggle]

> [SCREEN: Click Import — the green result message repeats the counts]

> [SCREEN: Click Check rows again on the same file — every day now shows as already imported]

> [SCREEN: Navigate back to /dashboard/metrics — show updated 7-day summary with imported data]

> [SCREEN: Demonstrate the Manual Entry option — click Manual Entry source — show the empty editable table]

> [SCREEN: End on the metrics page with imported data visible — end lesson]

---

## Key Takeaways

- Import from 8 sources: Garmin, Apple Health, Oura, WHOOP, Google Health, InBody, Hume Health, or Manual Entry
- Upload a CSV file or paste CSV text directly — both are parsed into an editable table
- Edit any cell before importing — correct dates, values, or remove rows
- Auto column mapping for all supported providers — no manual field configuration needed
- Maximum 365 rows per import; run multiple imports for larger datasets
- Check rows before Import: new days are added, days you have only gain blank fields, stored values are kept unless you tick Replace existing values
- Re-importing the same file adds nothing, and a date listed twice in one file is merged
- Each source keeps its own row per day; Manual Entry feeds the summary and main charts, device sources show in Compare Sources
