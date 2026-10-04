# Lesson 06: Importing and Exporting

**Course:** Mastering Finance
**Module:** Data Management
**Duration:** ~7 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

CentenarianOS does not connect to your bank, so nothing arrives on its own. The low-effort way to keep Finance current is to download a statement from your bank once a month and import it. This lesson walks through the bank statement import step by step, shows how to undo an import, and ends with exporting your transactions.

---

### Before You Start

**Get the file from your bank.** Most banks and card providers let you download your transactions as a CSV file:

1. Sign in to your bank's website
2. Open the account's activity or statements page
3. Look for Download or Export and choose CSV
4. Pick the date range and save the file

**Have the account in Finance.** A statement is always imported into one account, so the account has to exist first. Lesson 07 covers adding accounts.

**Know the limits.** One import takes up to 5,000 rows and 4,000,000 characters. For a longer history, download shorter date ranges and import them one at a time.

---

### Opening the Import

There are two ways in:

- On the Finance dashboard, click **Import bank statement**
- On **Finance → Accounts**, click **Import statement** on an account. That account is already chosen when the import opens.

The import has four steps, shown across the top of the page: **1 Account and file · 2 Columns · 3 Review · 4 Done**. Nothing is saved until the end of step 3, and **Back** keeps everything you entered.

---

### Step 1: Account and File

**Choose the account.** This is required. Each option shows the bank, the account name, and the last four digits, so two accounts with the same name are easy to tell apart. If the account isn't listed, the link under the list takes you to the Accounts page to add it.

**Give it the statement.** Either choose the CSV file, or paste the file's text into the box and click **Use pasted text**.

The file is read on your device first, and the page tells you what it found:

- Whether it recognized the layout ("Looks like a Chase credit card export"), found the columns by their names, or needs you to choose them
- Which line the header row is on
- How many transaction rows there are
- Any lines above the table that were skipped, such as a summary block
- Warnings about damage in the file, such as a quotation mark that is never closed

A recognized layout is a starting guess. You confirm the columns in the next step either way.

If the file is over the limits, the page says so here and stops.

---

### Step 2: Columns

This step answers three questions about the file.

**Which column is which?** There is one list per role, already filled in from the file:

| Role | Needed? | What it is |
|------|---------|------------|
| **Date** | Required | The transaction date |
| **Description** | Required | What the bank printed for the transaction |
| **Amount** | Required for one-column files | The money column |
| **Debit** and **Credit** | Required for two-column files | Money out and money in, in separate columns |
| **Type** | Required when a type column gives the direction | Says debit or credit for each row |
| **Posted date** | Optional | Used only for a row that has no date |
| **Merchant** | Optional | A clean store name, when the file has one |
| **Memo** | Optional | Used as the description when a row has none |
| **Category** | Optional | Matched by name to your budget categories |
| **Bank ID** | Optional | The bank's own transaction or reference number |
| **Status** | Optional | Says Pending or Posted |

**How does the file show a purchase?** Banks disagree about this, so you choose one:

- **Purchases are negative numbers**
- **Purchases are positive numbers**
- **Separate debit and credit columns**
- **A type column says debit or credit**

The starting choice comes from the settings you saved for this account, then from the file itself, and, when the file gives no clue, from the account type: a credit card account starts with "purchases are positive".

**How does the file write dates?** Month/Day/Year, Day/Month/Year, or Year-Month-Day. When every date in the file could be read two ways (03/04/2026 is March 4 or April 3), the page shows an example and you have to choose before you can continue.

Two switches sit under the columns:

- **Include pending transactions** is off. Rows the bank marks as pending are left out, because a pending charge can change before it posts.
- **Remember these settings for this account** is on. After a successful import, the settings are saved and filled in the next time you import into that account.

**Check the sample.** At the bottom, the first five rows are shown the way they will be read: date, amount, Expense or Income, and description. A line under it counts the whole file, for example "148 of 150 rows can be read: 140 as expenses and 8 as income". If your purchases show up as Income, the sign choice is wrong. If the dates look off, the date order is wrong. Fix it here, before anything is sent.

---

### Step 3: Review

Now the statement is compared with what is already in the account. Still nothing is saved.

**Every row has a status:**

| Status | What it means | What happens by default |
|--------|---------------|-------------------------|
| **New** | Not in the account yet | It is added |
| **Already imported** | The same row, or a transaction with the same date, amount, and vendor, is already in the account | It is skipped |
| **Repeated in this file** | An earlier row of this file has the same bank ID | It is skipped |
| **Matches an entry you made** | You already typed or scanned this purchase. The row shows your entry's date, amount, and name | The statement row is linked to your entry, so there is no second copy |
| **Can't import** | The row can't be used. The reason is shown, for example a pending row | It is left out |

Rows the import could not read at all are listed at the bottom with their row number in your file and the reason, such as an amount that is not a number.

**The tabs** above the list show the count for each status. Click one to see only those rows.

**For each row you can:**

- Choose what to do. The choices depend on the row: a new row can be imported or skipped, a matched row can be linked, imported as its own transaction, or skipped, and a row that only looks like a duplicate can be imported anyway.
- Switch it between **Expense** and **Income**
- Pick a **Category**. Rows from a vendor with a learned category, the one you set by answering "Always" to the categorize prompt (Lessons 03 and 09), arrive with that category filled in and marked **Learned from this vendor**.

**To change several rows at once,** tick them (or tick **Select all on this page**), then use **Set category...** or **Skip selected**.

**The summary line** at the top keeps count as you go: "Will add 42, link 3, skip 7".

A statement with more than 200 rows is shown 200 at a time, with **Previous 200** and **Next 200** under the list.

When it looks right, click **Import statement**.

---

### Step 4: Done

The result shows how many rows were imported, linked to your own entries, skipped as duplicates, and rejected, with the reason for each rejected row.

From here you can:

- **Undo this import**
- **View these transactions**, which opens the Transactions page
- **Import another file**, which starts again with the same account chosen

Under the result, **Import history** lists every import you have run: the date, the account, the file name, the counts, and whether it was undone. The same list is on step 1, so you can come back later and undo an import without running a new one.

---

### Undoing an Import

Click **Undo this import** on the result, or **Undo** next to an import in Import history. You are asked to confirm first. Then:

- Transactions that import added are deleted
- Any of those you edited afterwards are kept, and the page lists them so you can decide what to do with each
- Entries you made yourself that the import linked stay in your transactions. Only the link is removed

---

### Importing the Same File Twice

It is safe. Every imported row carries an identity, either the bank's own ID or one built from its date, amount, direction, and description. When you import a file again, or a new statement whose dates overlap the last one, the rows already in the account show as **Already imported** and are skipped.

---

### Tips for Monthly Imports

- **Import monthly.** Thirty days of transactions are quick to review, and you still remember what they were.
- **Create your budget categories first** (Lesson 02), so you can assign them during the review.
- **Answer "Always"** when the categorize prompt appears. Each vendor you teach is one less row to categorize next month.
- **One account at a time.** Download each account's statement separately and import it into that account.
- **No bank export?** Step 1 has a simple template (date, amount, type, description, vendor, category) you can fill in by hand and import the same way.

---

### Exporting Transactions

On the Finance dashboard, click **Export**. A CSV file of all your transactions downloads, with these columns: Date, Type, Amount, Description, Vendor, Category, Notes.

To export a date range, use the Finance card in the **Data Hub** (`/dashboard/data`). It shows the export address and the date filters it accepts: add `?from=YYYY-MM-DD&to=YYYY-MM-DD` to that address.

The exported file can be:

- Opened in Excel or Google Sheets for your own analysis
- Shared with an accountant for tax preparation
- Kept as a backup of your Finance data

---

### No Automatic Sync

Importing is manual on purpose. You download the statement, look at every row before it is saved, and categorize with intent. That review is also a chance to catch a charge you don't recognize.

Statement import needs a connection. If you are offline, the page says so, and the preview, import, and undo buttons wait until you are back online.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance, click "Import bank statement"]

> [SCREENSHOT: Step 1. Callouts: step indicator across the top, Account list showing bank + name + last four, Statement file input, paste box]

> [SCREEN: Choose the account, choose a sample bank CSV. The green panel appears]

> [SCREENSHOT: What the page found. Callouts: layout line, "Header row found on line N", row count]

> [SCREEN: Click "Continue to columns"]

> [SCREENSHOT: Step 2. Callouts: column lists, the four "How does this file show a purchase?" choices, date order choices, the two checkboxes]

> [SCREEN: Switch the sign choice to the wrong one. The sample rows flip from Expense to Income. Switch it back]

> [SCREENSHOT: The sample. Callouts: Expense / Income chips, the "N of N rows can be read" line]

> [SCREEN: Click "Continue to review"]

> [SCREENSHOT: Step 3. Callouts: summary line "Will add..., link..., skip...", status tabs with counts, a New row with its category marked "Learned from this vendor", a "Matches an entry you made" row showing the entry]

> [SCREEN: Change one row's category. Tick three rows, use "Set category..." to set them all at once. Skip one row. The summary line updates each time]

> [SCREEN: Click "Import statement". Step 4 appears]

> [SCREENSHOT: Step 4. Callouts: Imported / Linked / Skipped as duplicates / Rejected counts, Undo this import, View these transactions, Import another file, Import history below]

> [SCREEN: Click "Import another file", choose the same CSV again, continue to Review. Every row shows "Already imported"]

> [SCREEN: Go back to step 1. In Import history, click Undo on the import, confirm. The summary of what was deleted, unlinked, and kept appears]

> [SCREEN: Navigate to /dashboard/finance, click Export. The CSV downloads]

> [SCREEN: End on the Finance dashboard]

---

## Key Takeaways

- There is no bank connection: download a CSV statement from your bank and import it
- Open the import from the Finance dashboard (**Import bank statement**) or from an account on the Accounts page (**Import statement**)
- Step 1: choose the account (required) and the file, or paste its text. One import takes up to 5,000 rows
- Step 2: confirm the columns, how the file shows a purchase, and the date order. Check the five-row sample before continuing
- Step 3: review every row. Statuses are New, Already imported, Repeated in this file, Matches an entry you made, and Can't import
- A row that matches an entry you made is linked to it instead of being added twice
- Set categories per row or for several selected rows at once. Learned vendor categories are filled in for you
- Step 4: see what was imported, linked, skipped, and rejected. Every import can be undone, from the result or from Import history
- Undo keeps any imported transaction you edited afterwards, and keeps your own entries
- Importing the same file again is safe: rows already in the account are skipped
- Export on the Finance dashboard downloads all transactions as a CSV
