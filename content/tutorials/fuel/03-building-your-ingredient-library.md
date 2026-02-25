# Lesson 03: Building Your Ingredient Library

**Course:** Mastering Your Fuel
**Module:** Ingredients
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Your ingredient library is the foundation of the entire Fuel module. Every protocol you write, every meal you log with nutrition data, every inventory item you track — all of it references ingredients from this library.

Getting a solid ingredient library set up is the most time-intensive part of getting started. But once you have your staples in place, you'll rarely need to add new ingredients — you just use them.

---

### Navigating to the Ingredient Library

Go to `/dashboard/fuel/ingredients`. You'll see your ingredient list — cards or a list view of everything you've added so far, each with its NCV badge.

Click **Add Ingredient** to open the ingredient form.

---

### The Ingredient Form

**Name** — What you call this ingredient. Be specific enough to be useful. "Chicken" is okay, but "Chicken breast, boneless skinless" is better — it makes the nutritional data more accurate and the protocol ingredient lists clearer.

**NCV score** — Green, Yellow, or Red. This is your judgment call based on the NCV framework from the previous lesson. For most whole foods, this is straightforward: spinach is Green, brown rice is Yellow, white bread is Red.

**Serving unit** — Choose the unit you'll use when measuring this ingredient: grams, milliliters, oz, lb, kg, cup, tablespoon, teaspoon, or "whole" (for things like eggs or apples). Pick the unit that matches how you actually measure this ingredient when you cook.

**Calories per 100g** — Calories per 100 grams. This is the standard nutrition reporting unit. You can find it on any food label or nutrition database.

**Macros (optional but useful):**
- Protein per 100g
- Carbs per 100g
- Fat per 100g
- Fiber per 100g

You don't have to fill in all macros. If you only care about NCV scores and not detailed macro breakdowns, you can add just calories and skip the rest.

**Cost per unit** — How much this ingredient costs per unit (matching the serving unit you chose). For example: if your serving unit is "cup" and a bag of oats costs $4.50 and yields about 15 cups, your cost per cup is $0.30. This feeds the per-meal cost calculation in protocols.

**Brand, store, vendor notes** (all optional) — Track where you buy an ingredient, what brand you prefer, or notes like "organic preferred" or "buy in bulk at Costco." This is reference data for your grocery habits.

---

### Looking Up Nutrition Data

You have two options for finding accurate nutritional data:

**USDA database search** — The ingredient form includes a search field for the USDA FoodData Central database. Type the ingredient name and select from the results. The system pre-fills the calorie and macro fields automatically. This is the fastest way to get accurate data for whole foods.

**Open Food Facts (barcode)** — For packaged products, you can enter a barcode number and pull nutrition data from the Open Food Facts database. Useful for brand-name items where the exact nutrition varies by product.

If neither database has what you need, type the numbers in manually from the package label or a trusted nutrition source.

---

### Starting Your Library

Rather than adding every ingredient you've ever used, start with what you actually eat regularly. A practical approach:

1. Think of 5–10 meals you eat most often
2. List the main ingredients in each
3. Add those to your library first

For a typical home cook, the core library might be 30–50 ingredients. That's enough to build protocols for your standard meals, and it takes 20–30 minutes to set up.

You can always add more later. The library grows naturally as you build new protocols.

---

### Editing and Organizing

To edit an ingredient, click the **Edit** button on its card. You can update any field — NCV score, cost, nutrition data, notes.

To delete an ingredient, click **Delete**. Note: if the ingredient is used in any protocols, deleting it will remove it from those protocols. Be careful with deletions if you have active protocols.

You can filter your library by NCV category using the filter chips at the top: All / Green / Yellow / Red. This is useful for a quick audit of how your ingredient mix looks across the three tiers.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/ingredients — show the ingredient list with NCV filter chips at the top]

> [SCREEN: Click "Add Ingredient" — form opens]

> [SCREENSHOT: Full ingredient form with all fields labeled: Name, NCV score, Unit, Calories, Protein, Carbs, Fat, Fiber, Cost per unit, Brand, Store, Notes]

> [SCREEN: Type "Chicken breast" in the Name field]

> [SCREEN: Click the NCV dropdown — show the three options (Green / Yellow / Red) — select "Green"]

> [SCREEN: Click the USDA search field — type "chicken breast" — show search results appearing]

> [SCREEN: Click on a result — show the calorie and macro fields auto-populate]

> [SCREEN: Fill in the cost field: "$0.45" per oz (as an example)]

> [SCREEN: Click Save — ingredient card appears in the library with a Green badge]

> [SCREENSHOT: Chicken breast ingredient card with callouts: NCV badge (Green), Calories/100g, Protein, Cost]

> [SCREEN: Add a second ingredient — this time use the barcode field (type a barcode number) — show it auto-filling from Open Food Facts]

> [SCREEN: Click the "Green" filter chip — show library filtering to only Green ingredients]

> [SCREEN: Click the "Red" filter chip — show Red ingredients]

> [SCREEN: Click "All" to reset — end lesson]

---

## Key Takeaways

- Every ingredient needs: Name, NCV score, serving unit, and calories — macros and cost are optional but useful
- Use USDA database search to auto-fill nutrition data for most whole foods
- Use the barcode field for packaged products (Open Food Facts)
- Start with the ingredients in your 5–10 most common meals — add more as you build protocols
- Cost data feeds the per-meal cost calculation in protocols
- Filter by NCV tier (Green/Yellow/Red) to audit your ingredient library at a glance
