# Lesson 07: Managing Inventory

**Course:** Mastering Your Fuel
**Module:** Inventory
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The inventory system tracks how much of each ingredient you have on hand. When you log a meal using a protocol, the ingredients used are automatically subtracted. When you restock, you add quantities back. Low-stock alerts tell you when something is running low before you run out mid-meal-prep.

Used well, inventory makes the Fuel module feel like it's running your kitchen with you — not just after the fact.

---

### Navigating to Inventory

Go to `/dashboard/fuel/inventory`. You'll see your inventory list — each item shows the ingredient name, current quantity, unit, and whether it's below the low-stock threshold.

Low-stock items are flagged prominently — both in the inventory list and on the Fuel dashboard home page, where they appear in an alert panel at the top.

---

### Adding an Inventory Item

Click **Add to Inventory** to create a new inventory entry.

**Ingredient** — Select from your ingredient library. You must add the ingredient to your library first before you can track its inventory.

**Quantity** — How much you currently have. For example: 500 (if your unit is grams), 2 (if your unit is "whole" for eggs × 12 = a dozen, or however you've set it up).

**Unit** — Should match the unit you set in your ingredient library. The system typically pre-fills this.

**Low stock threshold** — The quantity at which you want to be alerted. For example: if you set a threshold of 100g for spinach, you'll get a low-stock alert when you drop to 100g or below. Set this to a practical number — enough for at least one meal, so you have time to restock before you run out.

Click **Save** and the item appears in your inventory.

---

### How Inventory Depletes

Every time you log a meal that uses a protocol, the system subtracts each ingredient's quantity from your inventory automatically.

Example: Your "Morning Green Smoothie" protocol uses 60g of spinach. Each time you log that smoothie as a meal, your spinach inventory goes down by 60g. After four smoothies (240g total), you're getting close to your threshold.

This happens in the background — you don't have to think about it. Just log your meals normally and your inventory reflects reality.

---

### Restocking

When you buy more of something, update the inventory:

1. Find the item in your inventory list
2. Click the **Restock** button (or the + icon)
3. Enter how much you're adding
4. Click Confirm

The quantity updates immediately. The low-stock alert clears if the new quantity is above the threshold.

You can also click **Edit** on any inventory item to adjust the quantity directly, update the threshold, or change any field.

---

### Manual Adjustments

Sometimes inventory won't match reality — you used an ingredient in a meal you didn't log, you threw something away, or you added an ingredient manually that was already half-used.

Use the **Edit** button to set the quantity to whatever it actually is. Inventory accuracy is only as good as your logging habits — if you log meals consistently, the automatic deductions will keep things mostly accurate with occasional manual corrections for outliers.

---

### Low Stock Alerts on the Dashboard

The Fuel dashboard home page shows a **Low Stock** panel with any ingredients at or below their threshold. This is the first thing you see when you open the Fuel module — a quick scan before meal prep or grocery shopping.

The list shows: ingredient name, current quantity, and threshold. Use it as your grocery list prompt: if spinach is flagged, add it to your shopping list.

---

### Inventory Threshold Tips

Setting thresholds well makes the alerts useful instead of noisy:

- Set the threshold to roughly two servings' worth. If one smoothie uses 60g of spinach, set the threshold at 120g — you'll get the alert with enough stock for one more meal, giving you time to buy more.
- For items you use in large batches (like cooking oils), set a higher threshold so you don't run out mid-batch-cook.
- For rarely-used specialty ingredients, a very low threshold (or none) avoids constant false alerts.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel — show the Low Stock alerts panel on the dashboard (or show it empty with a note that alerts appear here)]

> [SCREEN: Navigate to /dashboard/fuel/inventory — show the inventory list]

> [SCREEN: Click "Add to Inventory" — form opens]

> [SCREENSHOT: Inventory form with callouts: Ingredient selector, Quantity, Unit, Low stock threshold]

> [SCREEN: Click the Ingredient dropdown — select "Spinach" from library]

> [SCREEN: Enter Quantity: 400, Unit: grams auto-fills]

> [SCREEN: Enter Low stock threshold: 120]

> [SCREEN: Click Save — item appears in inventory list]

> [SCREENSHOT: Inventory item card showing current quantity, unit, and threshold — callout on the threshold value]

> [SCREEN: Click the Restock button on an item that's below threshold — enter quantity: 300 — confirm]

> [SCREEN: Show the quantity updating and the low-stock alert clearing]

> [SCREENSHOT: Before/after inventory restock — quantity updates from 80g to 380g, alert badge disappears]

> [SCREEN: Navigate back to /dashboard/fuel — show the Low Stock panel (now empty or updated)]

> [SCREEN: Click Edit on an inventory item — show the edit form — update the threshold — save]

> [SCREEN: End on the inventory list — end lesson]

---

## Key Takeaways

- Inventory tracks quantity on hand for each ingredient; depletes automatically when you log protocol-based meals
- Low-stock alerts appear both in the inventory list and on the Fuel dashboard home
- Set thresholds at roughly two servings' worth — enough to alert you before you actually run out
- Restock by clicking the Restock button and entering the quantity added
- Manually edit quantities when reality doesn't match the logged record
- Inventory only depletes for protocol-based meals — restaurant meals don't affect it
