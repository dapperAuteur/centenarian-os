# Lesson 07: The Equipment Summary Dashboard

**Course:** Mastering Equipment Tracking
**Module:** Connections
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Equipment Summary gives you a bird's-eye view of everything you own — total value, depreciation, revenue attribution, and a category-by-category breakdown. This lesson covers how to read it and what the numbers mean.

---

### Accessing the Summary

The summary data drives the four cards at the top of the hub page (`/dashboard/equipment`). The API behind them is `/api/equipment/summary`, which aggregates data across all your active (non-retired) equipment.

---

### The Four Summary Cards

**Total Items** — the count of active equipment items. Retired items are excluded.

**Total Value** — the sum of `current_value` across all active items. This reflects the latest valuations, not what you paid.

**Depreciation** — the difference between what you paid and what everything is worth now:

```
Depreciation = Total Purchase Value - Total Current Value
```

If this number is negative, your portfolio has appreciated overall.

**Categories** — how many distinct categories your active items span.

---

### Category Breakdown

The summary API also returns a per-category breakdown, used for filtering on the hub. Each category entry shows:

- **Category name**
- **Item count** — how many active items in this category
- **Purchase total** — sum of purchase prices
- **Current total** — sum of current values

Categories are sorted by current value descending — your most valuable category appears first.

---

### ROI Calculation

The summary includes an ROI (Return on Investment) figure:

```
ROI = ((Total Attributed Revenue - Total Purchase Value) / Total Purchase Value) × 100
```

**Attributed Revenue** comes from income transactions that are linked to your equipment via activity links (Lesson 06). If you have a camera linked to a photography gig that paid $500, that $500 is attributed revenue.

If no income transactions are linked, ROI is 0%. This metric is most useful for equipment that generates revenue — cameras for photography, instruments for gigs, tools for paid work.

---

### What the Summary Doesn't Include

- **Retired items** — excluded from all calculations. If you retire a laptop, its value drops out of the totals.
- **Unlinked transactions** — the `transaction_id` on equipment (Lesson 04) is for audit purposes. ROI uses activity links to income transactions, not the purchase transaction link.
- **Projected values** — the summary shows current state only, not future projections.

---

### Using the Summary Effectively

Check the summary monthly to answer:
- Is my total asset value going up or down?
- Which category holds the most value?
- Am I earning revenue from my equipment? (ROI)
- How much has my gear depreciated since purchase?

If depreciation is high and ROI is low, you're spending on gear that isn't working for you. If ROI is climbing, your equipment is paying for itself.

---

### Example Summary Response

Here's what the `/api/equipment/summary` API returns:

```json
{
  "totalItems": 12,
  "totalPurchaseValue": 8500.00,
  "totalCurrentValue": 6800.00,
  "depreciation": 1700.00,
  "totalAttributedRevenue": 3200.00,
  "roi": -62.35,
  "categories": [
    { "name": "Camera", "count": 3, "purchaseTotal": 4500.00, "currentTotal": 3200.00 },
    { "name": "Computer", "count": 2, "purchaseTotal": 2800.00, "currentTotal": 2400.00 },
    { "name": "Audio", "count": 4, "purchaseTotal": 800.00, "currentTotal": 750.00 },
    { "name": "Fitness", "count": 3, "purchaseTotal": 400.00, "currentTotal": 450.00 }
  ]
}
```

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment — show the hub page with summary cards visible]

> [SCREENSHOT: Summary cards — callouts: Total Items, Total Value, Depreciation, Categories]

> [SCREEN: Hover over each card — show any tooltips or additional detail]

> [SCREEN: Click a category filter pill — show the grid filter to just that category]

> [SCREENSHOT: Filtered view — callout: "Category filter shows only items in the selected category"]

> [SCREEN: Navigate to an item detail page — show how activity links to income transactions contribute to ROI]

> [SCREEN: Return to the hub — end lesson]

---

## Key Takeaways

- Summary cards show: Total Items, Total Value, Depreciation, and Categories for active equipment
- Depreciation = Total Purchase Value - Total Current Value
- ROI uses attributed revenue from income transactions linked via activity links
- Retired items are excluded from all summary calculations
- Category breakdown is sorted by current value — most valuable category first
- Check monthly to track whether your gear is working for you or just depreciating
