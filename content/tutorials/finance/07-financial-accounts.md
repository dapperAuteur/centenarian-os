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
| **Institution Name** | text | Optional — bank or lender name |
| **Last Four** | 4 chars | Last 4 digits of account number (for identification) |
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
- Balance = Opening Balance + income - expenses (auto-calculated from transactions)
- Accounts appear as a row at the top of the finance dashboard
- Delete with transactions → soft deactivate (data preserved); delete without → hard delete
- Assign transactions to accounts to maintain accurate per-account balances
