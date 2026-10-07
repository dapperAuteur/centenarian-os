# Lesson 3: The Categories Dashboard

**Course:** Life Categories Guide
**Module:** The Dashboard
**Duration:** ~8 min
**Lesson type:** text
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Categories dashboard is where life categories come together into a single view. It shows what you've tagged, how your spending breaks down by life area, and which items still need attention. Let's walk through each section.

---

### Getting There

Navigate to **Dashboard > Life > Categories** or go directly to `/dashboard/categories`. You'll see it in the sidebar under the Life group, right after Data Hub.

---

### Period Selector

At the top of the page, you can choose a time window:

- **7 days** — this week's activity
- **30 days** — the last month (default)
- **90 days** — the last quarter

This controls what data appears in the summary cards, charts, and uncategorized items section.

---

### Summary Cards

Below the header, a grid of cards shows one card per life category:

| Card Element | What It Shows |
|-------------|--------------|
| **Category icon** | The category's assigned icon |
| **Category name** | e.g., "Health", "Finance" |
| **Item count** | Total tagged items in the selected period |
| **Spending** | Expenses minus income of the period's transactions in this life area: through their budget category's life area or a tag, counted once each |
| **Color bar** | The category's color as a left border accent |

Cards with zero items in the current period still appear but are dimmed.

---

### Spending by Life Area (Pie Chart)

The first chart, **Spending by Life Area**, breaks down your spending by life area. A transaction counts toward the life area its budget category sits under, plus any life area it is tagged with, once each, and by its date within the period. Transfers between your own accounts never count. Each slice uses the life area's color.

Hover over a slice to see the exact dollar amount and percentage.

---

### Activity by Category (Bar Chart)

The second chart shows how many items are tagged in each category, broken down by entity type. Each bar represents a category, and the segments within show the mix of tasks, trips, transactions, workouts, etc.

This helps you see which life areas you're most active in and what types of activities dominate each area.

---

### Manage Panel

Click the **Manage** button in the page header to open an inline panel where you can:

1. **Add a new category** — enter a name, pick a color
2. **Edit existing categories** — change name, color, or sort order
3. **Delete a category** — removes it and all its entity tags

Changes take effect immediately. The summary cards and charts update when you close the manage panel.

For the full tree (placing budget categories under life areas, merging, moving), use the **Organize categories** button in the header, described next.

---

### One Category Tree and Organize Categories

You used to have two sets of categories: budget categories in Finance and life categories everywhere else. Now there is one set. Life areas are the top level, and your budget categories sit under them. Pick Groceries for a transaction and it counts toward Health too, with nothing else to tag.

#### How the Tree Works

| Level | Examples | What it's for |
|-------|----------|---------------|
| **Life area** (top) | Health, Home, Travel, Career | Which part of your life. Tag tasks, trips, workouts and other items with it directly. |
| **Budget category** (under a life area) | Groceries, Rent, Gas | Where the money went. Budgets are set here. |

- A transaction's **life area comes from its budget category**. Groceries under Health means every Groceries transaction counts toward Health.
- Budgets don't change: they stay on the budget categories.
- A budget category that isn't placed yet sits under **No life area** until you organize it.

---

#### The Organize Categories Screen

Go to **Dashboard > Life > Categories** and click **Organize categories** (`/dashboard/categories/organize`). The same screen is linked from the Finance dashboard's category window and from Budgets.

**Needs a life area** is at the top. It lists budget categories with no life area yet. For each one you can:

1. Click the suggestion, such as **Use Health** for Groceries or **Use Travel** for Gas. Suggestions come from the category's name, and nothing is placed until you click.
2. Pick any life area from the category's list.
3. Drag the category onto a life area card.

**Use all suggestions** accepts every suggestion at once.

Below that, each **life area card** lists its budget categories. Drag a category to another card, or change its list, to move it. Its transactions move with it.

At the bottom of each card you can add a budget category straight under that life area, and at the bottom of the page you can add a new life area.

---

#### Rename, Merge and Delete

Click the **pencil** next to a budget category or a life area:

- **Rename** it (and recolor a life area).
- **Merge into** another one at the same level. Merging budget categories moves the transactions, recurring payments, invoices, vendors' default categories, cash counts, insurance premiums and schedule pay settings, then deletes the merged category. The category you keep keeps its own budgets.
- **Delete** it. A deleted budget category's transactions become uncategorized; a deleted life area's budget categories go back to **Needs a life area**. Merge instead when you want to keep the history together.

---

#### One Picker Everywhere

Every place you choose a category uses the same picker: adding or editing a transaction, the bulk bar on Transactions, the statement import review, recurring payments, invoices and cash.

- Life areas are headings, with their budget categories under them.
- Type to search. A life area's name shows all its categories.
- Arrow keys move, Enter picks, Escape closes.
- **Add "…"** creates a new budget category and asks which life area it belongs under.
- On the Transactions bulk bar you can also pick a life area on its own to tag the selected transactions without changing their category.

---

#### Tags You Add Yourself

On a transaction, the life area from its category shows as **Health · from Groceries**. You can't remove it there; change the category instead. You can still add extra life areas, such as Travel for a grocery run during a trip, and the app never removes a tag you added.

---

#### Before the Database Update

The tree needs a database update (migration 223). Until it's applied, the two lists work as before and the Organize screen says **Run migration 223 first**.

---

## Screen Recording Notes

> [SCREEN: Navigate to Dashboard > Life > Categories]

> [SCREENSHOT: Full dashboard — summary cards grid at top, charts below]

> [SCREEN: Change period selector from 30 days to 7 days — show cards update]

> [SCREEN: Hover over a pie chart slice — show tooltip with amount and percentage]

> [SCREEN: Point out the bar chart — show the entity type breakdown within each bar]

> [SCREEN: Click Manage — show the inline category management panel]

> [SCREEN: Add a new category "Side Projects" with purple color — show it appear in the grid]

> [SCREEN: Click Organize categories in the header — the Organize screen opens with "Needs a life area" at the top]

> [SCREEN: Click "Use Health" on Groceries — it moves to the Health card; drag Gas onto the Travel card]

> [SCREENSHOT: A transaction's Life areas section — "Health · from Groceries"]

---

## Key Takeaways

- The Categories dashboard lives at `/dashboard/categories` in the Life nav group
- Period selector controls the data window: 7, 30, or 90 days
- Summary cards show item count and spending per category
- Pie chart breaks down spending by life area
- Bar chart shows activity counts by category with entity type segments
- Use the Manage panel to add, edit, or delete categories
- One category tree: budget categories sit under life areas, and a transaction's life area comes from its budget category
- Organize categories (`/dashboard/categories/organize`) places, moves, renames, merges and deletes categories; suggestions by name apply only when you click them
- The same category picker is used everywhere you choose a category, and tags you add yourself are never removed by the app
