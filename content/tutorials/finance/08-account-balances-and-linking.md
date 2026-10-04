# Lesson 08: Account Balances & Equipment Links

**Course:** Mastering Your Finances
**Module:** Accounts
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Once your accounts are set up and transactions are flowing, balances become meaningful. This lesson covers how to read account balances, how they connect to the Equipment module, and how cross-module linking works.

---

### Reading Account Balances

Each account's balance is live — it updates every time you add, edit, or delete a transaction assigned to that account.

The balance calculation:
```
Balance = Opening Balance + SUM(income) - SUM(expenses)
```

For **checking/savings/cash**: a positive balance means money available.

For **credit cards**: the balance represents what you owe. Income transactions (payments) reduce it. Expense transactions (charges) increase it.

For **loans**: similar to credit cards — the balance tracks remaining debt.

---

### Transfers, Card Payments, and Loan Payments

When money moves between two of your own accounts, both balances have to change, but nothing was spent or earned. The app records that as a **transfer**: an expense on the account the money left, an income on the account it reached, and a link between the two.

| What happened | Account the money left | Account it reached |
|---------------|------------------------|--------------------|
| Checking to savings | Expense: balance goes down | Income: balance goes up |
| Paid a credit card | Expense on the bank account | Income on the card: what you owe goes down |
| Paid a loan | Expense on the bank account | Income on the loan: what you owe goes down |

Because the two transactions are linked, they are left out of spending and income totals: the dashboard cards and charts, budget progress, brand P&L, Life Categories spending, and the AI coach. Balances and exports still include them.

Each side shows a **Transfer ↔ account** badge that opens the other side. The account is always written with its institution and last four digits, because two accounts can share a name.

If only one account has a transaction for the payment (a loan you never import a statement for, say), open the payment and click **This is a payment to…**. One entry is added on the loan for the same amount and date, so the loan's balance goes down by the payment. Lesson 05 covers the Possible transfers panel, which finds these for you.

---

### Per-Account Filtering

On the finance dashboard, click any account in the accounts row to filter the view to just that account. The summary cards, budget bars, and transaction list all update to reflect only that account's data.

Click **All** to return to the combined view.

---

### Equipment Transaction Links

The Equipment module (Life → Equipment) can link items to financial transactions. When a transaction is linked as a purchase record for a piece of equipment:

- The equipment detail page shows the transaction as the purchase source
- The Equipment Summary calculates purchase values from these links
- You can trace "what did I buy with this money?" directly from the Finance module

From the Equipment side, teachers or users search for the transaction by vendor name in the equipment form's **Linked Purchase Transaction** field.

---

### Activity Links from Finance

Financial transactions can also appear in activity links. If you link a transaction to equipment, a trip, or a task via the ActivityLinker component:

- The link appears on both the transaction detail and the linked item's detail
- Income transactions linked to equipment contribute to the Equipment Summary's ROI calculation
- Expense transactions linked to trips help track travel costs

Activity links don't move money or change balances — they're informational cross-references.

---

### Example: Tracing a Purchase

1. You buy a camera for $1,799 at B&H Photo → logged as an expense in Finance
2. In Equipment, you create "Sony A7III" and link it to the B&H transaction
3. The equipment detail page shows: Purchased $1,799, linked to "B&H Photo — $1,799 — 2024-06-15"
4. Later, you link the camera to a "$500 photography gig" income transaction via activity links
5. The Equipment Summary shows: Purchase $1,799, Revenue $500, ROI: -72%

The entire chain — spending, ownership, and revenue — is traceable across modules.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance — show the accounts row with balances]

> [SCREEN: Click a checking account — show the filtered view]

> [SCREEN: Click "All" — return to combined view]

> [SCREEN: Navigate to /dashboard/equipment/[id] — show the Linked Purchase Transaction on the detail page]

> [SCREENSHOT: Equipment detail — callout: "Linked transaction traces this item back to the B&H Photo purchase"]

> [SCREEN: Show the Equipment Summary page with purchase value and ROI numbers]

---

## Key Takeaways

- Account balances are auto-calculated: Opening Balance + income - expenses
- A transfer, card payment, or loan payment is two linked transactions: both balances change, and neither counts as spending or income
- Click any account on the dashboard to filter to that account's transactions
- Equipment items link to transactions via the purchase transaction field
- Activity links connect transactions to equipment, trips, and tasks for cross-module tracing
- Income transactions linked to equipment contribute to ROI calculations
