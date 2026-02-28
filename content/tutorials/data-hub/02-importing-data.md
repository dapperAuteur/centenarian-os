# Lesson 2: Importing Data from CSV & Google Sheets

**Course:** Data Hub Guide
**Module:** Getting Started
**Duration:** ~5 min
**Lesson type:** text
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Whether you're migrating from another app or bulk-loading historical data, the Data Hub importer handles it. This lesson walks through the full import workflow — from downloading a template to seeing your data land in the dashboard.

---

### Step 1: Download the Template

1. Go to the **Data Hub** (`/dashboard/data`)
2. Find the module you want to import into
3. Click the **Template** button to download the CSV template
4. Open it in Google Sheets, Excel, or any spreadsheet app

Each template includes:
- A header row with the exact column names the importer expects
- 2–3 example rows with realistic data
- Required columns are noted in the import page instructions

---

### Step 2: Fill In Your Data

Follow these guidelines:

- **Dates** must be `YYYY-MM-DD` format (e.g., `2026-02-15`)
- **Numbers** should be plain (no `$` signs or commas in amounts)
- **Leave optional columns empty** if they don't apply — the importer skips blanks
- **Vehicle/category nicknames** must match existing records (or they'll be skipped/auto-created depending on the module)
- **Keep under the row limit**: 1,000 rows for most modules, 200 for vehicles, 500 for contacts

---

### Step 3: Upload and Preview

1. Click **Import** on the module card in the Data Hub
2. Choose your CSV file — or switch to the **Google Sheets** tab and paste a published sheet URL
3. The importer validates your columns and shows a **preview table** of the first 50 rows
4. Review the preview for any obvious issues

---

### Step 4: Import

1. Click the **Import** button (shows row count, e.g., "Import 47 Rows")
2. Wait for the progress indicator
3. Review the result banner:
   - **Green** — success! Shows imported count and any skipped rows
   - **Red** — error details with row numbers so you can fix and retry

---

### Module-Specific Tips

| Module | Tips |
|--------|------|
| **Trips** | Vehicle nicknames must match existing vehicles. CO2 is auto-calculated. Linked finance transactions are NOT auto-created during bulk import. |
| **Fuel** | If you provide `total_cost` and `gallons`, `cost_per_gallon` is calculated for you. |
| **Maintenance** | `service_type` must be a valid type: oil_change, tire_rotation, brake_service, etc. |
| **Vehicles** | Max 200. Duplicate nicknames are skipped. |
| **Equipment** | Category names are auto-created if they don't exist. `current_value` defaults to `purchase_price`. |
| **Contacts** | Upserts by name + type — existing contacts are updated, not duplicated. Location fields create sub-locations. |
| **Tasks** | An "Imported Tasks" milestone is auto-created if needed. Default tag: personal, priority: 2. |
| **Workouts** | Rows with the same name + date are grouped into one workout. Each row becomes one exercise. |

---

### Google Sheets Workflow

For ongoing imports:

1. Create a Google Sheet with the template columns
2. Fill in your data
3. Go to **File > Share > Publish to web** > choose CSV format > Publish
4. Copy the published URL
5. On the import page, switch to the **Google Sheets** tab
6. Paste the URL and click Import

This lets you maintain a living spreadsheet and re-import anytime.

---

## Screen Recording Notes

> [SCREEN: Download a template from the Data Hub]

> [SCREEN: Open template in Google Sheets — fill in 5 rows of trip data]

> [SCREEN: On the Trips import page — upload the CSV file]

> [SCREEN: Show preview table with 5 rows]

> [SCREEN: Click Import — show green success banner: "Imported 5 trips"]

> [SCREEN: Navigate to Travel dashboard — show the 5 trips appear]

> [SCREEN: Demonstrate Google Sheets flow — publish, paste URL, import]

---

## Key Takeaways

- Download the CSV template first — it shows the exact format expected
- Dates must be YYYY-MM-DD, numbers plain (no $ or commas)
- Preview your data before importing to catch issues
- Each module has specific behaviors (auto-calc CO2, category creation, upserts)
- Google Sheets publishing lets you maintain a living spreadsheet for re-imports
