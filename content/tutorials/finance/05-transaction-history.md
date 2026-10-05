# Lesson 05: Transaction History

**Course:** Mastering Finance
**Module:** Transaction Management
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The dashboard shows you summaries. The Transaction History shows you the actual records — every individual transaction you've logged, searchable and filterable. This is where you do maintenance work: fixing miscategorized transactions, finding specific entries, and reviewing your spending at a detailed level.

---

### Navigating to Transaction History

From the Finance dashboard, click **View All Transactions** or the **Transactions** link in the Finance navigation. This takes you to `/dashboard/finance/transactions`.

---

### The Transactions List

The transactions page shows all your transactions in reverse chronological order (most recent first). Each row shows:

- **Date** — when the transaction occurred
- **Type** — Expense or Income, visually distinguished (usually red for expense, green for income)
- **Amount** — the dollar value
- **Category** — which budget category it's assigned to
- **Description** — your transaction note
- **Vendor** — the vendor if you logged one
- **Account** — the institution, account name, and last four digits (two accounts can share a name, so all three are shown)
- **Edit** and **Delete** buttons

A transaction that is one side of a transfer between your own accounts also shows a **Transfer ↔ account** badge. Click the badge to open the other side.

---

### Filtering and Searching

**Date range filter** — Set a start and end date to view transactions within a specific period. Useful for reviewing a single month, a quarter, or a custom range for tax purposes.

**Type filter** — Show only Expenses, only Income, or both.

**Category filter** — Filter to transactions in a specific category. "Show me all Dining Out transactions for Q1" is a common query.

**Vendor search** — Type any vendor name to filter by vendor. "Amazon" returns all Amazon transactions. Useful for reviewing subscriptions, recurring expenses, or a specific vendor relationship.

**Description search** — Free-text search across description fields. Helpful when you remember part of a description but not the date or category.

Filters stack — you can combine date range + category + type to find exactly what you need.

---

### Editing a Transaction

Click **Edit** on any row. The transaction form opens with all fields pre-filled. Update anything — amount, date, category, description, vendor — and click Save.

Common reasons to edit:
- **Wrong category** — you logged groceries under Dining Out
- **Wrong date** — logged today but the transaction was yesterday
- **Incomplete vendor** — you left it blank but want to add it for better analytics
- **Amount error** — typo in the amount

When you set or change the category of a transaction that has a vendor, a prompt appears above the list: "Always categorize 'CHIPOTLE' as Dining? [Always] [Just this once]". **Always** makes it that vendor's learned category, so its future transactions (including receipt scans and CSV imports) are categorized automatically, and then offers to apply it to the vendor's past transactions, showing how many first. **Just this once** changes nothing else.

---

### Transfers Between Your Own Accounts

Moving money from checking to savings, paying a credit card, and paying a loan are not spending or income. They are your own money changing accounts. The app tracks each one as a **transfer**: two linked transactions, an expense on the account the money left and an income on the account it reached. On a credit card or loan, that income entry is the payment, and it lowers what you owe.

Linked transfers are left out of your spending and income totals everywhere: the dashboard cards and charts, budget progress, brand P&L, Life Categories spending, and the AI coach. They still count in each account's balance, and exports still include them.

**The Possible transfers panel.** When some of your transactions look like transfers, a **Possible transfers** panel appears above the list. Click **Review** to open it. A pair is suggested when one account has an expense and another has an income for exactly the same amount within 5 days. Each suggestion shows both transactions with date, amount, account, and description, and says why it was suggested.

- **High confidence** — each transaction has only one possible match, and a description supports it (wording such as "transfer" or "payment", or the other account's last four digits).
- **Check this one** — more than one transaction could be the other side, or nothing in the descriptions says it is a transfer. Round amounts collide: a $300 loan payment and three $300 card payments on the same day all look alike. Read these before linking.

For each pair, click **Link** or **Not a transfer**. Dismissals are remembered in the browser you are using; **Show dismissed** brings them back. **Link all high-confidence** links every high-confidence pair in one step. Nothing is linked until you click.

**Payments with no matching transaction.** Below the pairs, the panel lists expenses that read like a card or loan payment when the other account has no transaction for them, such as a car loan you never import a statement for. Choose the account under **Paid to** and click **Record payment**. One entry for the same amount and date is added on that account, so its balance goes down by the payment.

**From a single transaction.** Click a transaction to open its page. The **Transfer** card offers:

- **Mark as transfer…** — pick the matching transaction on another account.
- **This is a payment to…** — pick the account the money went to when that account has no transaction for it (expenses only).
- **Unlink** — on a transaction that is already linked. Both transactions stay and count as spending and income again. If one side was added by "This is a payment to…", you choose whether to remove that added entry.

**Editing a linked transaction.** The amount is locked, because both sides of a transfer have to match. Unlink first to change it. Category, notes, date, vendor, and description can be changed at any time.

---

### Deleting a Transaction

Click **Delete** on any row. A confirmation prompt appears. Deletion is permanent — the transaction is removed from all dashboard totals, charts, and budget progress bars immediately.

Deleting one side of a transfer asks what to do with the other side: **Delete both sides** removes the transfer from both accounts, and **Unlink and delete only this one** keeps the other transaction as an ordinary one.

Use delete for:
- Duplicate transactions (logged the same transaction twice)
- Test entries
- Truly erroneous entries that don't represent a real financial event

Don't delete transactions just because they were over-budget or you regret the expense — that history is useful data.

---

### Bulk Reassignment

If several transactions landed in the wrong category (or are uncategorized), tick the checkbox on each row (or the header checkbox for the whole page). A bar appears where you can **Set category**, set a brand, or add a life tag, then click **Apply**.

If every transaction you selected is from the same vendor, the "Always categorize this vendor as ...?" prompt appears after you apply, so you can make the choice stick for that vendor's future transactions.

---

### Year-End Review

The transaction history is your ledger for tax and financial planning purposes. At year-end:

1. Set the date range to January 1 – December 31 of the year
2. Filter to Income to see total annual income by category
3. Filter to Business Expenses to see deductible business costs
4. Use the CSV export (Lesson 06) to download the full year as a spreadsheet for your accountant

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance — click "View All Transactions" or "Transactions" in nav]

> [SCREEN: Transaction history page loads — show the full list]

> [SCREENSHOT: Transactions list — callouts: Date, Type badge (Expense/Income), Amount, Category, Description, Vendor, Edit and Delete buttons]

> [SCREEN: Use the date range filter — set to current month — list filters to only this month's transactions]

> [SCREEN: Use the category filter — select "Groceries" — list filters to Groceries only]

> [SCREENSHOT: Filtered list showing only Groceries transactions — callout: Filter chips active at top]

> [SCREEN: Type "Whole Foods" in vendor search — show filtered results]

> [SCREEN: Click Edit on a transaction — edit form opens pre-filled — change the category — save]

> [SCREENSHOT: Edit form — callout: "All fields editable — category reassignment is the most common edit"]

> [SCREENSHOT: The "Always categorize ... as ...?" prompt above the list after saving — callout: "Always / Just this once"]

> [SCREEN: Click Review on the Possible transfers panel — show a High confidence pair and a "Check this one" pair]

> [SCREENSHOT: Possible transfers panel — callouts: confidence label, both accounts with institution and last four, Link, Not a transfer, Link all high-confidence]

> [SCREEN: Click Link on a high-confidence pair — the pair leaves the panel and both rows in the list show the "Transfer ↔ account" badge]

> [SCREEN: Under "Payments with no matching transaction", choose the loan account under "Paid to" and click Record payment]

> [SCREEN: Click a linked transaction — show the Transfer card with the other side and the Unlink button]

> [SCREEN: Click Delete on a transaction — confirmation prompt — cancel (don't delete for demo)]

> [SCREEN: Click Delete on a linked transaction — show the "Delete both sides" and "Unlink and delete only this one" choices — cancel]

> [SCREEN: Clear all filters — show the full unfiltered list]

> [SCREEN: End on the transaction history — end lesson]

---

## Key Takeaways

- Transaction history at /dashboard/finance/transactions — all transactions, most recent first
- Filter by: date range, type (expense/income), category, vendor, description keyword — filters stack
- Edit any transaction: fix category, amount, date, vendor, description
- Changing a category offers "Always" (the vendor's future transactions get it too) or "Just this once"
- Select rows to bulk-set a category, brand, or life tag
- Transfers between your own accounts, card payments, and loan payments are linked pairs; they are not counted as spending or income
- The Possible transfers panel suggests pairs; you decide with Link or Not a transfer, and only high-confidence pairs can be linked in bulk
- Deleting one side of a transfer asks whether to delete both sides or unlink first
- Delete is permanent — use for duplicates and errors, not for over-budget regret
- Vendor search is powerful: "Amazon" finds every Amazon transaction across all time
- Year-end: filter to Jan 1–Dec 31, export CSV for accountant or tax purposes
