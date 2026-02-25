# Lesson 06: Importing and Exporting

**Course:** Mastering Finance
**Module:** Data Management
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Manual entry works, but for most people the lowest-friction approach to Finance is a monthly import from your bank's CSV export. This lesson covers how to import transaction data in bulk and how to export your Finance data for use in spreadsheets, tax tools, or external analysis.

---

### Importing Transactions

From the Finance dashboard, click **Import** (or navigate to the import option in the Finance menu).

---

### Preparing Your Bank CSV

Most banks and credit card providers let you export a CSV of your transaction history from their website or app. The typical process:

1. Log in to your bank's web interface
2. Navigate to account history or statements
3. Find the export or download option (usually CSV, Excel, or OFX)
4. Set the date range and download

The resulting CSV will have columns for Date, Description/Merchant, and Amount. Different banks format these differently — the import tool handles common formats and normalizes column names.

---

### The Import Workflow

**Step 1: Upload or paste your CSV**
Drag the file onto the upload area or paste raw CSV text. The import tool parses it and shows a data table.

**Step 2: Review the parsed table**
Each row represents a transaction. Check that:
- Dates parsed correctly (YYYY-MM-DD)
- Amounts are positive numbers (the Type field handles direction)
- Descriptions look recognizable

**Step 3: Assign types and categories**
This is the most time-consuming step, especially on first import. For each row (or in bulk):
- Set **Type** to Expense or Income (the tool may auto-detect based on amount sign from your bank)
- Assign a **Category** from your existing budget categories

The table supports bulk category assignment: select multiple rows of the same type and assign them all to a category at once.

**Step 4: Set the vendor field (optional)**
If your bank descriptions include merchant names, the tool may parse them into the Vendor field automatically. Review and correct as needed.

**Step 5: Import**
Click **Import**. The system inserts all valid rows. You'll see a summary: imported count, skipped count (rows with missing or invalid data), and any errors.

Duplicate detection: if a transaction with the same date, amount, and description already exists, the import will skip it. This prevents double-logging when you re-import overlapping date ranges.

---

### Tips for Efficient Monthly Imports

- **Do it monthly, not annually** — 30 days of transactions is much faster to categorize than 365. The detail is fresher and easier to recognize.
- **Download on the 1st of each month** for the prior month's complete data.
- **Create specific budget categories before importing** — so you can assign categories during import rather than editing transactions after the fact.
- **Bank descriptions are often abbreviated** — "AMZN*MKTP US 123ABC" is an Amazon purchase. Familiarize yourself with your bank's typical merchant name format.

---

### Exporting Transactions

From the Finance dashboard or the Transactions page, click **Export** or **Download CSV**.

The export downloads all transactions within your current filter settings as a CSV file. To export:

- **All transactions ever:** clear all filters, then export
- **Current year only:** set the date range to Jan 1–Dec 31 of the current year, then export
- **A specific category:** apply the category filter, then export

The exported CSV includes all transaction fields: Date, Type, Amount, Category, Description, Vendor. This CSV can be:
- Opened in Excel or Google Sheets for further analysis
- Shared with an accountant for tax preparation
- Imported into tax software that accepts CSV input
- Used as a backup of your Finance data

---

### No Automatic Sync

CentenarianOS Finance doesn't connect directly to bank accounts or Plaid. The import process is intentionally manual — you download from your bank, review what you're importing, and categorize with intent.

This has two advantages: you review your transactions before they enter the system (catching errors or fraud), and there are no OAuth connections to banking credentials in CentenarianOS.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance — click "Import"]

> [SCREEN: Import page or modal opens]

> [SCREENSHOT: Import interface — callouts: Upload area (drag CSV), Paste CSV option, Data source note]

> [SCREEN: Upload or paste a sample bank CSV — data table appears]

> [SCREENSHOT: Parsed import table — callouts: Date column, Type column (auto-detected or manual), Amount, Description, Category dropdown per row, Vendor field]

> [SCREEN: Select multiple rows of the same type — use bulk category assignment to set them all to "Groceries" at once]

> [SCREENSHOT: Bulk category assignment — callout: "Select rows → assign category → applies to all selected"]

> [SCREEN: Click Import — result summary appears]

> [SCREENSHOT: Import result — callouts: Imported count, Skipped count, Errors list]

> [SCREEN: Navigate back to /dashboard/finance — show updated dashboard with new transactions]

> [SCREEN: Navigate to Transactions page — apply a filter — click Export]

> [SCREENSHOT: Export prompt or download confirmation — callout: "Downloads all transactions matching current filters as CSV"]

> [SCREEN: End on the transactions page — end lesson and the course]

---

## Key Takeaways

- Import from any bank's CSV export: upload the file or paste raw CSV text
- Import workflow: parse → review table → assign type + category (bulk assign supported) → import
- Duplicate detection: same date + amount + description skips on re-import
- Do monthly imports (30 days at a time) for best efficiency and freshness
- Export uses your current filter — filter by year or category before exporting for targeted outputs
- Export CSV is your shareable ledger: tax prep, accountant, spreadsheet analysis, backup
- No direct bank connection — intentionally manual for security and intentional categorization
