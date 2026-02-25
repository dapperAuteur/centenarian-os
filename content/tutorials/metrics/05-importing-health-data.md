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

Each source has pre-configured column mapping that matches the typical export format from that provider. When you select a source and upload its CSV, the fields map automatically without manual column configuration.

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

### Importing

When the table looks correct, click **Import**. The system processes all rows and returns a summary:

- **Imported:** X rows successfully inserted or updated
- **Skipped:** Y rows that had no valid metric data
- **Errors:** Up to 10 specific error messages for rows that couldn't be processed

Imported rows follow the same upsert logic as manual logging: if a row already exists for that date, it's updated. If not, it's created. This means you can re-import without creating duplicates — the new import simply overwrites the existing data for those dates.

**Maximum import size:** 365 rows per import. For larger historical datasets, run multiple imports.

---

### After Import

Navigate back to `/dashboard/metrics` after importing. Your 7-day summary strip will now reflect any imported dates within the last 7 days. The analytics page and weekly review will also incorporate the imported data the next time they're loaded.

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

> [SCREEN: Click Import — import result summary appears]

> [SCREENSHOT: Import result — callouts: Imported count, Skipped count, Errors list (if any)]

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
- Import uses upsert — re-importing won't create duplicates, it updates existing dates
- Imported data immediately appears in analytics, weekly review, and the 7-day summary strip
