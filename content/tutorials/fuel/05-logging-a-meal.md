# Lesson 05: Logging a Meal

**Course:** Mastering Your Fuel
**Module:** Meal Log
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

You've built your ingredient library and created your protocols. Now comes the daily habit that makes the Fuel module useful: logging what you eat.

Meal logging in CentenarianOS is designed to be fast. If you're eating a protocol you already built, logging takes about fifteen seconds.

---

### Navigating to the Meal Log

Go to `/dashboard/fuel/meals`. Your meals are grouped by date — today's meals at the top, older entries below. Each entry shows the protocol name, meal type, time, and a summary of calories and cost.

Click **Log Meal** to add a new entry.

---

### The Meal Log Form

**Date** — When you ate this meal. Defaults to today. Change it if you're logging something from yesterday.

**Time** — What time you ate. Useful for tracking meal timing patterns over time.

**Meal type** — Breakfast, Lunch, Dinner, or Snack. This categorizes the entry in your history and in analytics.

**Protocol** — Select from your protocol library. Start typing the protocol name and pick it from the dropdown. Once selected, the form shows you the nutrition summary for that meal: calories, protein, NCV score, and estimated cost.

That's it for the required fields. Click **Save** and the meal is logged.

---

### What Happens When You Log a Meal

When you log a meal linked to a protocol, two things happen automatically:

**1. Inventory is decremented.** Each ingredient in the protocol is subtracted from your inventory by the quantity used. If your smoothie protocol uses 60g of spinach and you have 240g in inventory, after logging the smoothie you'll have 180g remaining.

If an ingredient is below its low-stock threshold after the deduction, it gets flagged on your dashboard.

**2. Nutrition is recorded.** The meal log entry stores the nutrition data from the protocol at the time you logged it — even if you edit the protocol later, your historical logs reflect what you actually ate.

---

### Optional: Adding a Note

The **Notes** field lets you add any extra context. Did you make a substitution? Eat only half a portion? Add a note so your log reflects reality. For example: "Used almond milk instead of Greek yogurt" or "Half serving — not very hungry."

Notes don't affect the nutrition calculation — they're just your written record.

---

### Reviewing Your Meal History

Back on the meal log page, your entries are grouped by date. Each day shows all meals logged for that day with a running total of calories at the bottom.

Click any entry to view the full detail: protocol name, ingredients, nutrition breakdown, NCV score, and your note if you added one.

From the detail view, you can edit the entry (change meal type, adjust notes) or delete it if you logged something in error.

---

### Logging Meals Without a Protocol

What if you ate something you don't have a protocol for? You have two options:

1. **Create a protocol first** — takes a few minutes but makes future logging faster if you'll eat it again
2. **Log a restaurant meal** — if you ate out, the restaurant meal format is designed for that (covered in the next lesson)

For home-cooked one-off meals that you don't plan to repeat, creating a quick protocol with just the main ingredients is still the best approach. The nutrition data will be more complete than skipping it.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/meals — show the meal log with grouped dates]

> [SCREEN: Click "Log Meal" — form opens]

> [SCREENSHOT: Full meal log form with all fields labeled: Date, Time, Meal type, Protocol selector, Notes]

> [SCREEN: Click the Meal type dropdown — show the four options: Breakfast, Lunch, Dinner, Snack — select "Breakfast"]

> [SCREEN: Click the Protocol dropdown — type "smoothie" — show "Morning Green Smoothie" appearing — select it]

> [SCREEN: Show the nutrition preview that appears: calories, protein, NCV score, cost]

> [SCREENSHOT: Form with protocol selected — callout on the auto-populated nutrition summary below the protocol dropdown]

> [SCREEN: Add a note: "Added extra banana today"]

> [SCREEN: Click Save — the meal appears in the log under today's date]

> [SCREENSHOT: Meal log entry with callouts: Meal type, Protocol name, Time, Calories, NCV badge]

> [SCREEN: Log a second meal — select "Lunch" — select a different protocol — save]

> [SCREEN: Show both meals grouped under today with a calorie total for the day]

> [SCREEN: Click on one meal entry — show the detail view]

> [SCREENSHOT: Meal detail view showing protocol name, nutrition breakdown, NCV score, and note]

---

## Key Takeaways

- Log a protocol-based meal: select Date, Meal type, Protocol → Save — takes about 15 seconds
- Logging automatically decrements ingredient quantities from your inventory
- Nutrition data is stored at log time — historical entries don't change if you edit the protocol later
- Notes are free text — useful for substitutions, partial portions, or anything that doesn't fit the form
- No protocol? Either create one first (recommended) or use the restaurant meal format (next lesson)
