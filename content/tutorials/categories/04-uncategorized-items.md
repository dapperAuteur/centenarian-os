# Lesson 4: Finding & Tagging Uncategorized Items

**Course:** Life Categories Guide
**Module:** The Dashboard
**Duration:** ~5 min
**Lesson type:** text
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The most powerful part of the Categories dashboard is the uncategorized items view. It scans all your modules and shows you every recent item that hasn't been tagged with a life category yet. This is especially useful after bulk imports, when you might have dozens or hundreds of new items that need categorizing.

---

### The Uncategorized Items Section

Scroll past the charts on the Categories dashboard and you'll find the **Uncategorized Items** section. It shows:

- A **count badge** — e.g., "42 uncategorized items"
- Items **grouped by module** — Finance, Tasks, Travel, Workouts, etc.
- Each group is **collapsible** — click the module header to expand or collapse

---

### What Each Item Row Shows

| Element | Description |
|---------|-------------|
| **Display name** | A readable description (e.g., "Whole Foods -$47.23" for a transaction, "Morning Run" for a workout) |
| **Date** | When the item was created or occurred |
| **Module badge** | Which module the item belongs to (Finance, Travel, etc.) |
| **Compact tagger** | Small colored dots for existing tags + a "+" button to add tags |

---

### Quick Tagging Individual Items

1. Find the item in the uncategorized list
2. Click the **+** button (dashed circle) on the right side of the row
3. Select a category from the dropdown
4. The item is tagged and **disappears from the uncategorized list**
5. The count badge decrements

This is fast enough to tag items one at a time as you review them.

---

### Batch Tagging Multiple Items

For bulk operations (especially after a large CSV import):

1. Use the **checkboxes** on the left side of each item row
2. Select as many items as you want — even across different modules
3. A floating action bar appears at the bottom: **"Tag N selected as..."**
4. Click it and choose a category from the dropdown
5. All selected items are tagged at once and removed from the list

---

### Period Control

The uncategorized items list respects the same period selector at the top of the page. If you set it to 90 days, you'll see untagged items from the last 3 months. Set it to 7 days to focus on just this week.

---

### After Bulk Imports

Here's a recommended workflow after importing data via the Data Hub:

1. **Import your data** — CSV or Google Sheets via the Data Hub
2. **Go to Categories** — navigate to `/dashboard/categories`
3. **Set period to 90 days** — to catch all recently imported items
4. **Scroll to Uncategorized Items** — you'll see your imported items grouped by module
5. **Batch tag** — select similar items and tag them together (e.g., all gym-related transactions as "Fitness")
6. **Quick tag stragglers** — use the inline tagger for items that don't fit a batch

---

### Which Modules Are Scanned?

The uncategorized items view checks all 11 entity types:

| Module | What It Shows |
|--------|--------------|
| Finance | Recent transactions (vendor + amount) |
| Tasks | Recent planner tasks (activity name) |
| Trips | Recent trip logs (mode + origin → destination) |
| Workouts | Recent workout logs (workout name) |
| Equipment | Items in your equipment catalog |
| Focus Sessions | Recent engine sessions (type + duration) |
| Recipes | Your recipe collection |
| Fuel Logs | Recent fuel entries (station name) |
| Maintenance | Recent vehicle service records |
| Invoices | Recent invoices (contact name) |
| Routes | Multi-stop trip routes |

---

## Screen Recording Notes

> [SCREEN: Navigate to Categories dashboard — scroll down to Uncategorized Items]

> [SCREENSHOT: Uncategorized section showing "38 uncategorized items" with module groups]

> [SCREEN: Expand the Finance group — show transaction items with compact taggers]

> [SCREEN: Click "+" on a transaction — select "Health" — show it disappear from the list]

> [SCREEN: Check 5 items across Tasks and Finance — show the batch action bar appear]

> [SCREEN: Click "Tag 5 selected as..." — select "Career" — show all 5 disappear]

> [SCREEN: Change period to 90 days — show more items appear]

---

## Key Takeaways

- The uncategorized items view shows every recent item without a life category tag
- Items are grouped by module and shown with a readable display name and date
- Quick-tag one at a time with the inline compact tagger
- Batch-tag multiple items at once using checkboxes and the floating action bar
- Use this view after bulk imports to categorize all your new data efficiently
- The period selector (7/30/90 days) controls how far back the scan goes
