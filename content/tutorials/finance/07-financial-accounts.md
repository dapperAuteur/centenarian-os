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
| **Currency** | select | Starts on your home currency. Pick the local currency for cash you carry on a trip (e.g. MXN). Can change only while the account has no transactions |
| **Institution Name** | text | Optional — bank or lender name. Shown next to the account name wherever you pick an account |
| **Last Four** | 4 chars | Last 4 digits of account number. Tells apart two accounts with the same name, and helps the app recognize transfers: a description such as "TRANSFER TO ...5345" points at the account ending 5345 |
| **Starting Balance** | number | The baseline for the balance. On a credit card or loan, what you owed |
| **As of** | date | Optional — the day the starting balance is as of (end of that day). Only transactions after it count. Empty: every transaction counts |
| **Interest Rate** | number | Optional — APR for savings/loans, APY for credit cards |
| **Credit Limit** | number | Optional — only relevant for credit cards |
| **Monthly Fee** | number | Optional — recurring account fee |
| **Due Date** | 1-28 | Optional — payment due day of month (credit cards, loans) |
| **Statement Date** | 1-28 | Optional — statement close day of month |

---

### How Balances Work

Account balances are calculated, not stored directly:

```
Balance = Starting Balance + SUM(income) - SUM(expenses)
          (only transactions dated after the "as of" date, when there is one)
```

Every transaction assigned to the account affects the balance. Income adds. Expenses subtract. The starting balance provides the starting point. When it has an **as of** date, older transactions stay in your history but no longer change the balance, so an account can start part-way through its history.

This means you don't manually update balances — they stay accurate as long as your transactions are assigned to the right accounts.

For **credit cards and loans**, the balance is what you owe: an expense (a charge) raises it and an income entry (a payment) lowers it.

**Moving money between accounts.** Click **Transfer** on the accounts page or the finance dashboard, pick the From and To accounts, the amount, and the date. Two linked transactions are created: an expense on the From account and an income on the To account. Paying a credit card or a loan from a bank account is a transfer too. Transfers change both balances but are never counted as spending or income. Lesson 05 covers linking transactions that already exist, such as rows from two imported statements.

---

### Accounts in Other Currencies

Every account has a currency, and its opening balance, transactions and balance are all in that currency. Your **home currency** (Settings → Currencies) is the one totals are reported in.

- A foreign-currency account shows its balance in its own currency and, under it, the value in your home currency with the rate's date and source ("rate as of Oct 5, 2026 (ECB via Frankfurter)").
- Each transaction on it stores the amount converted at the rate for its date. Dashboard totals, budgets, brand P&L and Life Categories add up the converted amounts, so 350 pesos counts as about $20.
- **Exchange money** (Accounts page) records swapping currency at a booth or ATM: what you handed over, what you received, and any fee. It is a linked transfer, so it is never spending or income; the fee is its own expense; and the rate you got is saved as your own rate for that day.
- Rates come from Frankfurter (European Central Bank reference rates, with history) and, for other currencies, ExchangeRate-API; they refresh daily and on **Update rates now**. Rates you enter on Settings → Currencies always win.

---

### Cash on Hand

Cash accounts get extra help, because cash never sends you a statement.

- **Cash on hand card** (Finance dashboard) — each active cash account with its balance in its own currency (≈ home currency when foreign) and "Last counted". That line turns amber when you have never counted or the last count is over 30 days old. No cash account yet? A **Track cash on hand** button creates one named Wallet.
- **Count** — enter what you actually have, as a total or bill by bill and coin by coin. The difference from the recorded balance becomes one entry on the account ("Unrecorded cash spending" or "Cash found", tagged `cash-count`, in the category you pick), so the balance matches. Count history lists every count; **Undo latest count** deletes the latest count and its entry. Needs migration 213.
- **Paid cash** — amount, what it was for, optional category (learned vendor categories fill in), today's date, and your last used cash account. One tap saves it, offline too.
- **Withdraw** — opens Transfer into that cash account.
- **ATM withdrawals in imports** — on a checking or savings statement, rows such as "ATM WITHDRAWAL" or "RETIRO EN CAJERO" get **Cash withdrawal → into** a cash account in the same currency, so the cash becomes cash on hand instead of spending. ATM fees stay expenses.

---

### Starting Balance and Reconciling

Banks and card companies send a statement every month. Reconciling checks your records against it, so the balance here is the real one. Every non-cash account has a **Reconcile** link and a "Reconciled through" line (amber when never reconciled or more than 30 days ago).

**Set the starting balance first.** Importing years of statements, or starting mid-history? Use the balance on your first imported statement's start date: its beginning balance, as of the day before the period starts. The Reconcile page's **Use my first imported statement** fills both in from the earliest PDF statement. On a card or loan, enter what you owed.

**Reconcile each statement:**

1. Enter the statement's closing date and ending balance (on a card or loan, the new balance: what you owe). A PDF import fills these in, and right after one the import page offers **Reconcile to this statement's balance**.
2. **Compare** shows the balance your records give for that date, the difference, and the period's transactions.
3. Tick **Cleared** on each transaction that appears on the statement.
4. **Finish.** No difference: the statement is reconciled. A difference: look for a missing, doubled or mis-dated transaction first, then choose **Add an adjustment** (one "Reconciliation adjustment" transaction, tagged `reconcile-adjustment`), **Change the starting balance** (only before any earlier statement is reconciled), or **Leave it open**.

Transactions inside a reconciled period show a **Reconciled** badge, and editing or deleting one asks first. **Unreconcile** opens a statement again. The Finance dashboard's **Reconcile your accounts** card lists the accounts due this month. Needs migration 221.

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

### Retirement Accounts and Life Insurance

Retirement accounts and life insurance policies live on their own pages, separate from the five account types above.

**Retirement** (`/dashboard/finance/retirement`) — add a 401(k), 403(b), 457(b), IRA (traditional, Roth, SEP, SIMPLE), HSA, brokerage account, pension, annuity or whole life cash value. Each account holds your contribution (a fixed amount per pay period or a percent of pay), the employer match rule (for example 100% up to 4% of pay, with an optional yearly cap) and, if you like, its own expected return. Click **Add balance** to type in the balance from each statement; the latest one is the account's balance.

**The planner** — enter your age or birth year, retirement age, the age to plan to, your yearly spending in retirement (an amount, or a multiple of what you spend now) and your own Social Security estimate. The page projects each account to retirement in today's dollars, draws your plan beside three presets (Conservative 4%, Middle 6%, Optimistic 8% a year, with 3% inflation, all editable assumptions), compares the total with your target, and shows about how much more a month would close any gap. A small **Net worth (estimate)** line adds your accounts, retirement balances and permanent-policy cash value.

**Insurance** (`/dashboard/finance/insurance`) — term, whole and universal life policies with coverage, premium and frequency, start and term-end dates, cash value and beneficiaries. Link the category or vendor the premium shows up as and the page finds the payments: paid to date, the next due date and whether it's covered. Optionally the next due date becomes a task under **Inbox › Bills**. A term policy ending within a year turns amber.

Every figure on these pages is an estimate from your own numbers, not financial advice.

---

### The Wallet: Everything on One Page

The **Wallet** (`/dashboard/finance/wallet`, the Wallet button at the top of the Finance dashboard or Wallet in the Life menu) puts what you have and what you owe on one page, in your home currency. An account in another currency is converted at today's rate; one with no rate yet is listed in amber and left out of the totals, never added at face value.

- **Net worth (estimate):** cash + checking and savings + retirement + life policy cash value + assets − what you owe on cards, lines of credit and loans, with each part listed.
- **Cash:** physical cash only, each pocket with how long ago you counted it. Over 30 days (or never) shows an amber **Count cash** link.
- **Checking and savings:** its own card. Money your savings goals hold is shown but not subtracted, because it is still in the account.
- **Credit cards and lines of credit:** owed out of your total limit, with a bar and a % for each card. The limit comes from the account, else your latest imported statement. A card you overpaid counts as zero; a card with no limit is listed outside the %. 30% or more turns amber: a common rule of thumb, not a rule. A loan account with a limit is a line of credit and shows here.
- **Loans:** each loan's starting balance and date next to what you owe now, the payoff date at its monthly payment (the minimum on your latest imported statement, else your last payment recorded as a transfer to the loan; with neither it says "Not known yet"), and **Try a monthly payment** to see a new payoff date and the interest you would save.
- **Assets and insurance:** equipment you own and your own vehicles, with your value (resale, which you keep up with valuations) next to the book value after depreciation, and the coverage of your policies in force.
- **Retirement:** what your retirement accounts hold and the years left (65 marked "assumed" if you haven't set an age), green **On track** or an amber "Short by" line.

**Business pages:** the Wallet's **Businesses** card lists each business (brand) with this year's money in, out and net. Open one for its cash flow by **month** (last 12), **quarter** (last 8) or **year** (last 5), a profit and loss for any dates with a PDF, open invoices, and income expected in the next 90 days. Money counts toward a business when a transaction, invoice or trip is tagged to it; transfers between your own accounts never count.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance/accounts — show the accounts page]

> [SCREEN: Click "+ Add Account" — show the form]

> [SCREENSHOT: Account form — callouts: Name, Type dropdown, Institution, Last Four, Starting Balance, As of, Interest Rate, Credit Limit]

> [SCREEN: Fill in: Name "Chase Checking", Type "Checking", Institution "JPMorgan Chase", Last Four "4567", Starting Balance 2500, As of the day before the first statement's period]

> [SCREEN: Save — show the account appear in the list]

> [SCREEN: Navigate to /dashboard/finance — show the accounts row at the top with the new account]

> [SCREEN: Click the account — show the dashboard filter to that account's transactions]

> [SCREEN: Accounts page — click Reconcile on the checking account, enter the statement's closing date and ending balance, Compare, tick Cleared, Finish]

> [SCREEN: Finance dashboard → Wallet — scroll from net worth to Credit cards (a card at 30%+ in amber) to Loans; type a bigger monthly payment and show the new payoff date and interest saved]

> [SCREEN: Wallet → Businesses → open a business → switch Monthly / Quarterly / Yearly cash flow]

---

## Key Takeaways

- 5 account types: checking, savings, credit_card, loan, cash
- Balance = Starting Balance + income - expenses (auto-calculated from transactions after the starting balance's "as of" date, when set); on a card or loan the balance is what you owe
- **Reconcile** each account monthly against its statement: compare, tick Cleared, finish (adjustment, change the starting balance, or leave open); the dashboard card lists accounts not reconciled in 30 days
- Use Transfer to move money between accounts, including card and loan payments: both balances change, and nothing counts as spending or income
- Cash accounts: **Count** keeps the balance honest (one "Unrecorded cash spending" or "Cash found" entry), **Paid cash** records cash spending in one tap (offline too), and imported ATM withdrawals go into a cash account instead of counting as spending
- Accounts appear as a row at the top of the finance dashboard
- The **Wallet** shows net worth, physical cash, checking and savings, credit used vs limit, loans (with a payoff calculator), assets and retirement on one page, and each business gets a cash flow page
- Delete with transactions → soft deactivate (data preserved); delete without → hard delete
- Assign transactions to accounts to maintain accurate per-account balances
- **Import statement** on an account opens the bank statement import with that account chosen (Lesson 06)
- **Debt payoff** shows interest paid, a payoff calculator and a debt-free plan (avalanche by default, promo deadlines protected); due dates become planner tasks under Inbox › Bills, with a Due soon banner and optional email reminders
- **Retirement** tracks retirement accounts with hand-entered balances and projects them to retirement (presets, target, gap, needed per month); **Insurance** tracks life policies, premium payments and term-end dates
