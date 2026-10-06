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

**Get the file from your bank.** Most banks and card providers let you download your transactions as a CSV file, and every one lets you download your monthly statement as a PDF:

1. Sign in to your bank's website
2. Open the account's activity or statements page
3. Look for Download or Export and choose CSV, or download the statement PDF
4. Pick the date range (for a CSV) and save the file

A CSV works for any bank. Some card sites (Best Buy) offer an ".xls" download that is really plain text: choose it like a CSV. A real Excel workbook can't be read; use the PDF statement for the same period instead, or open the workbook and save it as CSV. A PDF statement also brings in the statement's summary: balances, interest charged, interest rates, the minimum payment and due date, and any promotional balance with the date it expires (see "PDF Statements" below).

**Have the account in Finance.** A statement is always imported into one account, so the account has to exist first. Lesson 07 covers adding accounts.

**Know the limits.** One import takes up to 5,000 rows and 4,000,000 characters. For a longer history, download shorter date ranges and import them one at a time.

---

### Opening the Import

There are two ways in:

- On the Finance dashboard, click **Import bank statement**
- On **Finance → Accounts**, click **Import statement** on an account. That account is already chosen when the import opens.
- On **Settings**, choose a CSV or PDF in the **Statements** box. The import opens with that file already loaded.

The import has four steps, shown across the top of the page: **1 Account and file · 2 Columns · 3 Review · 4 Done**. Nothing is saved until the end of step 3, and **Back** keeps everything you entered.

---

### Step 1: Account and File

**Choose the account.** This is required. Each option shows the bank, the account name, and the last four digits, so two accounts with the same name are easy to tell apart. If the account isn't listed, the link under the list takes you to the Accounts page to add it.

**Give it the statement.** Either choose the CSV or PDF file, or paste a CSV's text into the box and click **Use pasted text**. A PDF skips step 2 and goes straight to review; see "PDF Statements" below.

The file is read on your device first, and the page tells you what it found:

- Whether it recognized the layout ("Looks like a Chase credit card export"), found the columns by their names, or needs you to choose them
- Which line the header row is on
- How many transaction rows there are
- Any lines above the table that were skipped, such as a summary block
- Warnings about damage in the file, such as a quotation mark that is never closed

A recognized layout is a starting guess. You confirm the columns in the next step either way.

The box is green only when a known layout was recognized and nothing needs checking. It is amber ("Needs your attention") when the columns couldn't be worked out, the file has damage, or the export looks like it belongs to a different kind of account than the one you chose (a card export into a checking account, say). See "What the colors mean" below.

**Layouts recognized from real exports:** Citi credit cards (including the AAdvantage and Costco cards), PayPal activity, Arizona Federal Credit Union (checking, credit card and loan), Navy Federal (checking and savings), and the Best Buy (Citibank) text download. Chase, American Express, Capital One, Apple Card, Discover, Bank of America and Wells Fargo layouts are recognized from what their exports are known to look like.

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
| **Details** | Optional | Added after the description, and the store name is read from it. For banks that put the type in Description ("Withdrawal Debit Card") and the store in Memo, such as Arizona Federal |
| **Category** | Optional | Matched by name to your budget categories |
| **Bank ID** | Optional | The bank's own transaction or reference number |
| **Status** | Optional | Says Pending or Posted |

**How does the file show a purchase?** Banks disagree about this, so you choose one:

- **Purchases are negative numbers**
- **Purchases are positive numbers**
- **Separate debit and credit columns**
- **A type column says debit or credit**

For a credit card or loan account the same choices use card words: **Charges appear as negative numbers**, **Charges appear as positive numbers**, **Separate charge and payment columns**. A line above them says what the import will do for that kind of account.

The starting choice comes from the settings you saved for this account, then from the file itself, and, when the file gives no clue, from the account type: a credit card account starts with "purchases are positive".

**How does the file write dates?** Month/Day/Year, Day/Month/Year, or Year-Month-Day. When every date in the file could be read two ways (03/04/2026 is March 4 or April 3), the page shows an example and you have to choose before you can continue.

Two switches sit under the columns:

- **Include pending transactions** is off. Rows the bank marks as pending are left out, because a pending charge can change before it posts.
- **Remember these settings for this account** is on. After a successful import, the settings are saved and filled in the next time you import into that account.

**Check the sample.** At the bottom, the first five rows are shown the way they will be read: date, amount, Expense or Income (on a card or loan: Charge, Payment, Refund or credit, Interest, or Fee), and description. A line under it counts the whole file, for example "148 of 150 rows can be read: 140 as expenses and 8 as income", or on a card "120 charges, 12 payments, 3 refunds or credits, 9 interest charges". If your purchases show up as Income (or your charges as Payments), the sign choice is wrong.

Some layouts leave out rows that move no money, and say so: in a PayPal export, the item lines that detail another row, authorizations, holds, voids, denied payments, and the other-currency side of a currency conversion. They are counted as "left out" in gray, not as errors. If the dates look off, the date order is wrong. Fix it here, before anything is sent.

---

### Step 3: Review

Now the statement is compared with what is already in the account. Still nothing is saved.

**Every row has a status:**

| Status | What it means | What happens by default |
|--------|---------------|-------------------------|
| **New** | Not in the account yet | It is added |
| **Already imported** | The same row is already in the account from an earlier import | It is skipped |
| **Possible duplicate** | A transaction with the same date, amount, and vendor is already in the account. Check it: two real purchases can look alike | It is skipped, or choose Import anyway |
| **Repeated in this file** | An earlier row of this file has the same bank ID | It is skipped |
| **Matches an entry you made** | You already typed or scanned this purchase. The row shows your entry's date, amount, and name | The statement row is linked to your entry, so there is no second copy |
| **Matches an entry you made** (a recorded payment) | Another statement's import recorded this payment here (see "Card and Loan Statements") | The statement row is linked to that payment, so there is no second copy |
| **Can't import** | The row can't be used. The reason is shown, for example a pending row | It is left out |

Rows the import could not read at all are listed at the bottom with their row number in your file and the reason, such as an amount that is not a number.

**The tabs** above the list show the count for each status. Click one to see only those rows.

**For each row you can:**

- Choose what to do. The choices depend on the row: a new row can be imported or skipped, a matched row can be linked, imported as its own transaction, or skipped, and a row that only looks like a duplicate can be imported anyway.
- Switch it between **Expense** and **Income**, or on a card or loan choose what it is: **Charge**, **Payment**, **Refund or credit**, **Interest**, or **Fee**
- For a payment, choose where it was **Paid from** (or, on a bank statement, which card or loan **This paid**). See "Card and Loan Statements" below
- Pick a **Category**. Rows from a vendor with a learned category, the one you set by answering "Always" to the categorize prompt (Lessons 03 and 09), arrive with that category filled in and marked **Learned from this vendor**.

**To change several rows at once,** tick them (or tick **Select all on this page**), then use **Set category...** or **Skip selected**.

**The summary line** at the top keeps count as you go: "Will add 42, link 3, skip 7".

A statement with more than 200 rows is shown 200 at a time, with **Previous 200** and **Next 200** under the list.

When it looks right, click **Import statement**.

---

### Card and Loan Statements

When the account you chose is a credit card or a loan, the import speaks in card terms instead of expense and income:

| You see | Stored on the card or loan as | What it does to what you owe |
|---------|-------------------------------|------------------------------|
| **Charge** | Expense | Goes up |
| **Interest** | Expense | Goes up |
| **Fee** | Expense | Goes up |
| **Payment** | Income, linked as a transfer | Goes down |
| **Refund or credit** (on a loan: **Credit**) | Income | Goes down |

Interest and fees are recognized from the wording ("INTEREST CHARGED TO STANDARD PURCH", "LATE FEE"), and a PDF statement's own sections say which rows they are. Change any row with **What is this row?**.

**Payments are transfers, not income.** A payment moves money from another of your accounts, so it is linked to that account instead of counting as income:

1. Each payment row has **Paid from**. It starts with the account your last linked payment to this card came from, or, for a card with no history yet, the account you last paid any card from. Pay every card from the same checking account? Choose it once and every statement after that starts there.
2. **Paid from, for all payments** sets the account on every payment of the statement at once.
3. On import, if that account already has the matching withdrawal (same amount, within 5 days), the two are linked. If not, and **Record the payment on the other account if it isn't there yet** is ticked (it is by default), the withdrawal is added there so both balances are right. When you import that account's statement later, its row links to the recorded payment instead of being added twice.

Loans work the same way: a payment on a loan statement is a loan payment from the account you choose.

**On a bank statement,** money out whose wording names a card or a loan ("PAYMENT THANK YOU", "CITI CARD ONLINE", "Transfer To Loan") gets **This paid**. Choose the card or loan and it is linked as a card or loan payment instead of counting as spending. When the wording names exactly one of your cards or loans, it is chosen for you.

**Refunds are less spending, never earnings.** On the Finance dashboard and in Budgets, a refund on a card lowers spending in its category (or Uncategorized) instead of counting as income.

---

### What the Colors Mean

Every message, label, and banner in the import uses the same scale, and always has an icon and words too:

- **Green** (check mark): done and fine. "Adds up", "Imported".
- **Amber** (warning triangle), "Needs your attention": something for you to check or decide. A statement that doesn't add up, dates that read two ways, rows that can't be imported, possible duplicates, saved settings that don't fit this file.
- **Red** (cross): something failed or blocks you.
- **Blue** (i): information, nothing to do.
- **Gray**: a plain label, such as "Already imported" or a row left out because it moves no money.

---

### Step 4: Done

The result shows how many rows were imported, linked to your own entries, skipped as duplicates, and rejected, with the reason for each rejected row. When payments were linked, it also says how many were linked to a matching row on the other account, how many were recorded there, and any that couldn't be linked.

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
- Payments the import linked as transfers are taken apart. A payment it had recorded on another account is deleted with it; a withdrawal that was already there just loses the link

---

### PDF Statements

Choose the statement PDF in step 1, the same box a CSV goes in.

**Private by design.** The PDF is read inside CentenarianOS itself. It is never sent to any other company or service, and no AI reads it. Only the rows you import and the statement's summary numbers are saved.

**What works.** Text PDFs, the kind you download from your bank's website. A scanned or photographed statement has no text to read, and the page says so ("This PDF has no readable text; scanned statements aren't supported"). Password-protected PDFs are refused too: save a copy without the password first. A PDF can be up to 10 MB.

**Which statements are recognized.** Best Buy credit card statements from Citibank are read section by section: the account summary, every transaction (purchases, payments, credits, fees, and interest), the interest rate table, and promotional balances.

**Transaction lists printed from a card website** are recognized too: Capital One cards (such as the REI Co-op Mastercard) and Discover cards printed from the Capital One website, and PayPal Credit activity printed from its website. These are lists, not monthly statements, so they have no balances to check: the review says so in blue and nothing needs confirming. Pending transactions and canceled payments on them are left out, with a note.

Any other statement is read by looking for lines with a date, a description, and an amount. Those imports are marked as an unrecognized layout, and you should check every row and its direction (expense or income) before importing.

**The account picks itself.** The statement prints the last four digits of the account. When exactly one of your accounts ends in those digits, it is chosen for you. Otherwise choose it yourself; the review step warns you if the account you picked ends in different digits.

**Card conventions.** Purchases, cash advances, fees, and interest are charges (stored as expenses). Payments and credits lower what you owe (stored as income); a payment is linked as a transfer to the account it was paid from (see "Card and Loan Statements").

**The statement summary.** The review step shows the summary above the rows: previous balance, payments, other credits, purchases, cash advances, fees, interest, new balance, the minimum payment, and the due date. Next to it:

- **Does it add up?** CentenarianOS checks previous balance − payments − credits + purchases + cash advances + fees + interest = new balance, and that the rows it found add up to each total. A green "Adds up" note means everything matched. Otherwise an amber "Needs your attention" box lists each difference in plain words, and you have to tick **Import anyway: I've checked the differences** before **Import statement** works.
- **Interest rates (APR)** for each kind of balance.
- **Promotional balances** with the date each one expires and the deferred interest that would be charged if it isn't paid off by then.

**What is saved.** After the import, the summary, interest rates, and promotional balances are saved with the account, one record per statement period. Undoing the import removes that record along with the transactions. Importing the same statement again updates it.

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

> [SCREEN: Choose the account, choose a sample bank CSV. The green panel appears (a recognized layout). Then paste a file with unnamed columns: the panel is amber and says "Needs your attention"]

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

> [SCREEN: Click "Import another file", choose a text PDF statement (use a synthetic sample, never a real one on screen). The panel names the statement and the matched account. Click "Continue to review"]

> [SCREEN: Review shows the statement summary, the green "adds up" note, the APRs, and the promotional balances]

> [SCREEN: Choose a credit card account and a synthetic card CSV. In Review, rows read Charge, Payment, Refund or credit, Interest, Fee. On a payment row, "Paid from" is filled in; use "Paid from, for all payments" to set it on every payment]

> [SCREEN: Import. The result says how many payments were linked to a matching withdrawal and how many were recorded on the paying account]

> [SCREEN: Navigate to /dashboard/finance, click Export. The CSV downloads]

> [SCREEN: End on the Finance dashboard]

---

## Key Takeaways

- There is no bank connection: download a CSV or PDF statement from your bank and import it
- A PDF is read inside CentenarianOS and never sent anywhere else; it must be a text PDF, not a scan
- A PDF statement's summary is checked (does it add up?) and saved with its APRs and promotional balances
- Open the import from the Finance dashboard (**Import bank statement**) or from an account on the Accounts page (**Import statement**)
- Step 1: choose the account (required) and the file, or paste its text. One import takes up to 5,000 rows
- Step 2: confirm the columns, how the file shows a purchase, and the date order. Check the five-row sample before continuing
- Step 3: review every row. Statuses are New, Already imported, Repeated in this file, Matches an entry you made, and Can't import
- A row that matches an entry you made is linked to it instead of being added twice
- Card and loan statements use card words: Charge, Payment, Refund or credit, Interest, Fee
- A card or loan payment is linked to the account it was paid from as a transfer, never counted as income; the paying account is remembered from your last linked payment
- A bank payment to a card or loan can be linked with "This paid" so it isn't counted as spending
- A refund on a card lowers spending; it is never earnings
- Green means done, amber means check this, red means it failed, blue is information
- Set categories per row or for several selected rows at once. Learned vendor categories are filled in for you
- Step 4: see what was imported, linked, skipped, and rejected. Every import can be undone, from the result or from Import history
- Undo keeps any imported transaction you edited afterwards, and keeps your own entries
- Importing the same file again is safe: rows already in the account are skipped
- Export on the Finance dashboard downloads all transactions as a CSV
