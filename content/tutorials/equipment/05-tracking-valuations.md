# Lesson 05: Tracking Value Over Time

**Course:** Mastering Equipment Tracking
**Module:** Valuations
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Most things lose value after you buy them. Some gain value. The Valuations feature lets you record what an item is worth at any point in time, building a visual history of appreciation or depreciation.

---

### What Is a Valuation?

A valuation is a timestamped snapshot of an item's value. Each valuation has:

- **Date** — when you assessed the value
- **Value** — the dollar amount
- **Source** — how you determined the value: Manual, eBay (comparable listings), or Other
- **Notes** — optional context (e.g., "eBay sold listings average", "insurance appraisal")

---

### Adding a Valuation

1. Navigate to an item's detail page at `/dashboard/equipment/[id]`
2. Scroll to the **Value History** section
3. Click **+ Add Valuation**
4. Fill in the inline form: date, value, and optional notes
5. Click **Save**

When you save a valuation, two things happen:
- The valuation record is stored in the `equipment_valuations` table
- The item's `current_value` field is automatically updated to match the new valuation

This means the most recent valuation always determines the current value shown on the hub and summary.

---

### The Value Chart

Below the add form, the detail page shows a Recharts line chart. The chart plots:

- **Purchase price** as the first data point (at the purchase date)
- **Each valuation** as a subsequent point (at the valuation date)

The line connects these points chronologically, giving you a visual trend. A rising line means the item is appreciating. A falling line means it's depreciating.

The chart uses a teal line (#0d9488) with a grid background, dollar-formatted Y axis, and tooltips on hover showing the exact value and date.

---

### The Valuations Table

Below the chart, a table lists every valuation in reverse chronological order (newest first). Each row shows:

- Date
- Value
- Notes (if any)

This gives you a scannable history of every assessment.

---

### Depreciation Math

The Equipment Summary (Lesson 07) calculates depreciation as:

```
Depreciation = Total Purchase Value - Total Current Value
```

If you paid $5,000 across all your gear and it's currently worth $3,800, your depreciation is $1,200.

Individual item depreciation shows on the hub cards as a percentage:

```
Change % = ((Current Value - Purchase Price) / Purchase Price) × 100
```

A camera bought for $1,800 now worth $1,450 shows **-19.4%**. A vintage guitar bought for $800 now worth $1,200 shows **+50.0%**.

---

### When to Add Valuations

There's no automatic schedule. Add a valuation when:
- You check comparable prices (eBay, marketplace)
- An insurance appraisal happens
- The item's condition changes significantly
- You want to update the current value for any reason

Even one valuation per year gives you a useful trend over time.

---

### Example Valuation Data

Here's what the `equipment_valuations` data looks like for a camera over two years:

```json
[
  {
    "id": "val-001",
    "equipment_id": "equip-a7iii",
    "valued_at": "2024-12-01",
    "value": 1600.00,
    "source": "ebay",
    "notes": "Average of 5 sold listings on eBay"
  },
  {
    "id": "val-002",
    "equipment_id": "equip-a7iii",
    "valued_at": "2025-06-15",
    "value": 1450.00,
    "source": "ebay",
    "notes": "Price dropped after A7IV release"
  },
  {
    "id": "val-003",
    "equipment_id": "equip-a7iii",
    "valued_at": "2026-01-10",
    "value": 1350.00,
    "source": "manual",
    "notes": "Steady decline, shutter count at 45k"
  }
]
```

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment/[id] — show the detail page for an item with existing valuations]

> [SCREENSHOT: Value History section — callouts: "+ Add Valuation" button, Line chart with purchase price + valuations, Valuation table]

> [SCREEN: Click "+ Add Valuation" — show the inline form appear]

> [SCREEN: Fill in date, value ($1,350), and notes ("eBay comparable") — click Save]

> [SCREEN: Show the chart update with the new data point added]

> [SCREENSHOT: Updated chart — callout: "New valuation appears on the chart, current_value updated automatically"]

> [SCREEN: Scroll down to the valuations table — show the new entry at the top]

> [SCREEN: Navigate back to the hub — show the item card with updated current value and change percentage]

---

## Key Takeaways

- A valuation is a dated value snapshot — add one whenever you reassess an item's worth
- Saving a valuation automatically updates the item's current_value
- The detail page chart plots purchase price + all valuations chronologically
- Depreciation = Total Purchase Value - Total Current Value (shown in summary)
- Change % on hub cards shows individual item appreciation/depreciation
- Even yearly valuations build a useful trend over time
