# Lesson 07: Managing Financial Accounts

**Course:** Mastering Your Finances
**Module:** Accounts
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Financial accounts are the containers for your money — checking accounts, savings accounts, credit cards, loans, and cash. This lesson covers how to set them up, what each field does, and how they connect to your transactions.

---

### What Is a Financial Account?

A financial account represents a real-world account or cash reserve. Every transaction you log can be assigned to an account, which lets you track balances, see per-account spending, and know exactly where your money lives.

---

### Account Types

Five types are supported:

| Type | Description | Example |
|------|-------------|---------|
| **Checking** | Primary spending account | Chase Checking |
| **Savings** | Money set aside | Ally Savings |
| **Credit Card** | Revolving credit | Visa Signature |
| **Loan** | Installment debt | Car loan, mortgage |
| **Cash** | Physical cash or petty cash | Wallet, emergency fund |

---

### Creating an Account

Navigate to `/dashboard/finance/accounts` and click **+ Add Account**.

The form includes:

| Field | Type | Notes |
|-------|------|-------|
| **Name** | text | Required — e.g., "Chase Checking" |
| **Account Type** | select | checking / savings / credit_card / loan / cash |
| **Institution Name** | text | Optional — bank or lender name. Shown next to the account name wherever you pick an account |
| **Last Four** | 4 chars | Last 4 digits of account number. Tells apart two accounts with the same name, and helps the app recognize transfers: a description such as "TRANSFER TO ...5345" points at the account ending 5345 |
| **Opening Balance** | number | Starting balance — used as the baseline for calculations |
| **Interest Rate** | number | Optional — APR for savings/loans, APY for credit cards |
| **Credit Limit** | number | Optional — only relevant for credit cards |
| **Monthly Fee** | number | Optional — recurring account fee |
| **Due Date** | 1-28 | Optional — payment due day of month (credit cards, loans) |
| **Statement Date** | 1-28 | Optional — statement close day of month |

---

### How Balances Work

Account balances are calculated, not stored directly:

```
Balance = Opening Balance + SUM(income transactions) - SUM(expense transactions)
```

Every transaction assigned to the account affects the balance. Income adds. Expenses subtract. The opening balance provides the starting point.

This means you don't manually update balances — they stay accurate as long as your transactions are assigned to the right accounts.

For **credit cards and loans**, the balance is what you owe: an expense (a charge) raises it and an income entry (a payment) lowers it.

**Moving money between accounts.** Click **Transfer** on the accounts page or the finance dashboard, pick the From and To accounts, the amount, and the date. Two linked transactions are created: an expense on the From account and an income on the To account. Paying a credit card or a loan from a bank account is a transfer too. Transfers change both balances but are never counted as spending or income. Lesson 05 covers linking transactions that already exist, such as rows from two imported statements.

---

### The Accounts Dashboard

The accounts row appears at the top of your finance dashboard (`/dashboard/finance`). Each account shows:
- Account name and type icon
- Current balance
- Last four digits (if set)

Click an account to filter the dashboard to only that account's transactions.

---

### Managing Accounts

The accounts management page at `/dashboard/finance/accounts` lets you:

**Edit** — change any field. Balance recalculates automatically.

**Delete** — two behaviors:
- If the account has no transactions: hard delete (permanently removed)
- If the account has transactions: soft deactivate (`is_active = false`). The account disappears from the dashboard but its data is preserved.

**Reactivate** — if an account was soft-deactivated, you can reactivate it to bring it back.

**Import statement** — each account has an **Import statement** link. It opens the bank statement import (Lesson 06) with that account already chosen, so the statement's transactions land in the right account.

---

### Paying Down Cards and Loans

Credit card and loan accounts get their own page: **Debt payoff** (`/dashboard/finance/debt`, linked from the Finance dashboard and under Life in the menu).

**Your debts** — each card and loan with what you owe, its APR, the minimum payment, the next due date (marked Paid once a linked payment covers it), and interest paid this year. Import a statement PDF and the APR, minimum, due date and any **deferred-interest promotions** come from it. A promotion close to its deadline turns amber, with the monthly amount needed to clear it and the deferred interest you'd be charged if you miss it.

**Interest paid** — month by month for each account, exact from imported statements, otherwise from transactions marked as interest.

**Payoff calculator** — pick a debt, then either enter a monthly payment to see the payoff date and total interest, or pick a date to see the payment needed.

**Debt-free plan** — one monthly budget (all minimums plus an extra amount) spread over every debt:
- **Highest interest first (avalanche)** — the default; pays the least interest. Promo balances are still cleared a payment before their deadline.
- **Smallest balance first (snowball)** — quick wins, usually more interest.
- **Promo deadlines first** — every promo balance first, then highest interest.
- **My own order** — you choose.

The plan shows your debt-free date, interest saved compared with paying only minimums, a balance-over-time chart and a month-by-month schedule. Save it to check later whether your linked card and loan payments are on track.

**Due dates in your planner** — each card and loan due date becomes a task under **Inbox › Inbox › Bills**, with the minimum and the statement balance that avoids interest, and an estimate of what paying early saves. It's checked off automatically when a linked payment lands. Promo deadlines get a task 30 days ahead.

**Reminders** — a **Due soon** banner on the Finance page from 3 days before a payment is due, and optional emails (3 days before, 1 day before, or both).

Every projection here is an estimate (interest = balance × APR ÷ 12 per month, no new charges), not financial advice.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance/accounts — show the accounts page]

> [SCREEN: Click "+ Add Account" — show the form]

> [SCREENSHOT: Account form — callouts: Name, Type dropdown, Institution, Last Four, Opening Balance, Interest Rate, Credit Limit]

> [SCREEN: Fill in: Name "Chase Checking", Type "Checking", Institution "JPMorgan Chase", Last Four "4567", Opening Balance 2500]

> [SCREEN: Save — show the account appear in the list]

> [SCREEN: Navigate to /dashboard/finance — show the accounts row at the top with the new account]

> [SCREEN: Click the account — show the dashboard filter to that account's transactions]

---

## Key Takeaways

- 5 account types: checking, savings, credit_card, loan, cash
- Balance = Opening Balance + income - expenses (auto-calculated from transactions); on a card or loan the balance is what you owe
- Use Transfer to move money between accounts, including card and loan payments: both balances change, and nothing counts as spending or income
- Accounts appear as a row at the top of the finance dashboard
- Delete with transactions → soft deactivate (data preserved); delete without → hard delete
- Assign transactions to accounts to maintain accurate per-account balances
- **Import statement** on an account opens the bank statement import with that account chosen (Lesson 06)
- **Debt payoff** shows interest paid, a payoff calculator and a debt-free plan (avalanche by default, promo deadlines protected); due dates become planner tasks under Inbox › Bills, with a Due soon banner and optional email reminders
