# Lesson 06: Logging a Restaurant Meal

**Course:** Mastering Your Fuel
**Module:** Meal Log
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Not every meal happens in your kitchen. When you eat out, there's no protocol to select — you're eating someone else's food and you probably don't have exact nutrition data. The restaurant meal format is designed for this: it lets you keep a record of eating out without needing to build a protocol or enter detailed nutrition.

---

### When to Use Restaurant Logging

Use the restaurant meal format any time you eat somewhere other than home:
- Sit-down restaurants
- Fast food
- Coffee shop pastries
- Food trucks
- Work catering
- Meals at a friend's or family member's house (if you didn't cook)

The restaurant format is for capturing *that you ate out* and *where*, not for tracking precise nutrition. It keeps your meal log complete without requiring you to build a protocol for a meal you'll likely never repeat.

---

### Logging the Restaurant Meal

Go to `/dashboard/fuel/meals` and click **Log Meal**. Toggle on the **Restaurant meal** switch (or check the "Eating out" option — it depends on how the form renders).

When you enable restaurant mode, the Protocol selector disappears and is replaced with location fields:

**Restaurant name** — The name of the place. "Chipotle", "Le Bernardin", "Mom's kitchen". Free text.

**Address / City / State / Country** (all optional) — As much location detail as you want. City is usually enough for your own reference.

**Website** (optional) — If you want to link to the restaurant for future reference.

**Meal type** — Same as always: Breakfast, Lunch, Dinner, Snack.

**Date and time** — When you ate.

**Notes** — What you ordered, how it was, anything worth remembering. This is where most of the useful information goes for restaurant meals. For example: "Grilled salmon, side salad, no dressing. Good portion size."

---

### What Restaurant Meals Don't Do

Restaurant meals don't:
- Affect your inventory (nothing to decrement — you didn't cook from your ingredients)
- Calculate precise nutrition totals (you can add a rough calorie estimate in notes, but there's no macro breakdown)
- Contribute a calculated NCV score (the system records these as unscored)

This means restaurant meals show up in your meal log count but don't affect your NCV average or precise calorie totals. That's intentional — partially estimated data would distort the metrics.

You'll see your total meal log count on the dashboard, and you can filter to see only restaurant meals or only home-cooked meals. Over time, the ratio of home meals to restaurant meals is itself a useful signal.

---

### Editing and Reviewing Restaurant Meals

Restaurant meals appear in your log just like protocol-based meals. They're marked with a restaurant icon so you can tell them apart at a glance.

Click any restaurant meal entry to view or edit the details. You can update the location, notes, or meal type at any time.

---

### A Note on Nutrition Estimation

Some users want more than just a restaurant name — they want a rough calorie estimate. The best approach is to add the estimate in your Notes field: "~800 cal burger + fries, high fat, probably Red NCV". That information is there for your reference without distorting the calculated metrics.

If you eat at a specific restaurant frequently (a regular lunch spot, for example), you might create a rough protocol with approximate nutrition data for your usual order. It won't be perfectly accurate, but it'll be closer than nothing, and it keeps inventory and NCV scoring consistent.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/meals — show the meal log]

> [SCREEN: Click "Log Meal" — form opens]

> [SCREEN: Toggle on the "Restaurant meal" switch — show the form change: protocol selector disappears, location fields appear]

> [SCREENSHOT: Restaurant meal form with callouts: Restaurant meal toggle, Restaurant name, City, State, Website, Notes — protocol selector is gone]

> [SCREEN: Fill in: Restaurant name "Nobu", City "New York", State "NY"]

> [SCREEN: Select Meal type: "Dinner"]

> [SCREEN: Type in Notes: "Omakase tasting menu. Light portions, mostly fish, excellent quality. Probably Green-Yellow NCV overall."]

> [SCREEN: Click Save — entry appears in the meal log with a restaurant icon]

> [SCREENSHOT: Meal log with both a protocol-based meal and a restaurant meal — callout on the restaurant icon differentiating the two types]

> [SCREEN: Click the restaurant entry — show the detail view with location info and notes visible]

> [SCREEN: End on the detail view — end lesson]

---

## Key Takeaways

- Restaurant meals skip the protocol selector — log by location and notes instead
- Inventory is not affected by restaurant meals (nothing was cooked from your ingredients)
- No NCV score or precise nutrition is calculated — restaurant meals log the *fact* of eating out, not the detail
- Notes field is where the useful info goes: what you ordered, portion size, quality observations
- Restaurant meals appear in your total meal count and are filterable in the log view
- For a regular restaurant order, consider building a rough protocol for better nutrition tracking
