# Lesson 04: Creating a Protocol

**Course:** Mastering Your Fuel
**Module:** Protocols
**Duration:** ~7 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

A protocol is a meal template. If you make the same smoothie every morning, the same grain bowl for lunch most days, or rotate through a handful of go-to dinners — each of those is a protocol.

Protocols do three things:
1. They let you log a meal in seconds by just selecting the protocol instead of listing every ingredient
2. They automatically calculate the nutrition totals and NCV score for that meal
3. They feed into your inventory tracking, decrementing ingredient stock each time you log the meal

Let's build one from scratch.

---

### Navigating to Protocols

Go to `/dashboard/fuel/protocols`. You'll see your protocol cards, or an empty state if this is your first one.

Click **New Protocol** to open the protocol builder.

---

### Protocol Name and Metadata

**Name** — What you call this meal. Something descriptive and personal: "Morning green smoothie", "Standard lunch bowl", "Tuesday salmon". You'll be selecting this by name when you log meals, so make it recognizable.

**Description** (optional) — A short description of the meal. Useful if you ever want to publish it as a public recipe later — give it a few words of context.

**Servings** — How many servings this protocol makes. If your smoothie makes one serving, put 1. If your soup batch makes four portions, put 4. The nutrition and cost totals are shown per serving based on this number.

**Prep time / Cook time** (optional) — In minutes. Not used in calculations, but useful for your own reference.

---

### Building the Ingredient List

This is where the protocol gets its nutritional content. Click **Add Ingredient** to start.

A search field appears — type the name of an ingredient from your library and select it. Then specify:

**Quantity** — How much of this ingredient goes into the recipe. For example: 100 (if your unit is grams), 1.5 (if your unit is cups), 2 (if your unit is "whole" for eggs).

**Unit** — The unit for this ingredient in this recipe. It defaults to the unit you set when you added the ingredient to your library, but you can change it here if needed.

Once you add the ingredient, the form shows its contribution to the total: calories, protein, carbs, fat, and how much it adds to the cost.

Add as many ingredients as the recipe needs. The totals update live as you add each one.

---

### Understanding the NCV Score

As you build the ingredient list, watch the NCV score indicator in the form. It calculates the overall score for the protocol based on a calorie-weighted average of all ingredient NCV scores.

If most of your ingredients are Green and the calories are primarily from Green-scored items, the protocol scores Green. Mix in significant Yellow or Red ingredients and the score shifts accordingly.

The NCV score is a useful signal for building meals. If a protocol you thought was healthy shows up as Yellow, look at which ingredients are pulling the score down — often it's a sauce, a dressing, or a grain that can be swapped for a higher-quality version.

---

### Saving the Protocol

Once your ingredient list is complete, click **Save**. The protocol card appears in your library with:
- Name and description
- NCV badge (Green / Yellow / Red)
- Total calories per serving
- Total protein per serving
- Estimated cost per serving

All of these are calculated automatically from the ingredients you added.

---

### Editing Protocols

To update a protocol, click **Edit** on its card. The builder reopens with all your current ingredients pre-filled. You can add, remove, or adjust quantities.

If the cost of an ingredient changes (you buy a different brand, or prices shift), update the cost in your ingredient library — the protocol costs will recalculate automatically the next time you open them.

---

### Protocols vs. Public Recipes

A protocol is private — it's for your personal meal logging. It doesn't have cooking instructions, just an ingredient list with quantities.

If you want to share a protocol with others, you can publish it as a public recipe. The publish feature converts your protocol into a full recipe that can have instructions, a cover photo, tags, and a visibility setting (public, authenticated-only, etc.). We cover that in Lesson 11.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/protocols — show existing protocol cards or empty state]

> [SCREEN: Click "New Protocol" — protocol builder modal opens]

> [SCREENSHOT: Full protocol form with all fields labeled: Name, Description, Servings, Prep Time, Cook Time, Ingredient list area]

> [SCREEN: Type "Morning Green Smoothie" in the Name field, "1" in Servings]

> [SCREEN: Click "Add Ingredient" — search field appears — type "spinach" — select from library]

> [SCREEN: Enter quantity: 60, unit: grams — show the calories and NCV contribution appear]

> [SCREEN: Add a second ingredient: "Banana", quantity: 1, unit: whole — show totals updating]

> [SCREEN: Add a third ingredient: "Greek yogurt", quantity: 150, unit: grams]

> [SCREENSHOT: Ingredient list with three items — callouts: each ingredient's calorie contribution, NCV badge per ingredient, total at the bottom]

> [SCREEN: Point to the NCV score indicator — show it displaying "Green"]

> [SCREEN: Click Save — protocol card appears in the list]

> [SCREENSHOT: Protocol card with callouts: NCV badge (Green), Total calories, Protein, Cost per serving]

> [SCREEN: Click Edit on the card — show the pre-filled form — add one more ingredient — save]

> [SCREEN: End on the protocol card — end lesson]

---

## Key Takeaways

- A protocol is a private meal template — ingredient list + quantities for a meal you eat regularly
- Protocols auto-calculate nutrition totals and NCV score from the ingredients you add
- Cost per serving is calculated from ingredient costs you entered in the library
- The NCV score is a calorie-weighted average of all ingredient NCV tiers
- Protocols are used when logging meals — select the protocol, and nutrition is auto-filled
- To share with others, publish a protocol as a public recipe (Lesson 11)
