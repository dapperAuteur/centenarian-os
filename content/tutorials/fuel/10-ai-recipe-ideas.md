# Lesson 10: AI Recipe Ideas

**Course:** Mastering Your Fuel
**Module:** Recipe Ideas
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

One of the most common friction points in healthy eating: you open the fridge, you have ingredients, but you don't know what to make. The AI Recipe Ideas feature solves exactly that. It looks at what you currently have in inventory and suggests three recipes you could cook right now.

---

### Navigating to Recipe Ideas

Go to `/dashboard/fuel/recipe-ideas`. You'll see a button to generate ideas and, if you've generated them before, your most recent suggestions.

---

### Generating Ideas

Click **Generate Recipe Ideas**. The system sends your current inventory state to Gemini (Google's AI model) and asks for recipe suggestions that:

1. Use at least 5 ingredients you currently have on hand
2. Prioritize ingredients with Green NCV scores
3. Align with longevity nutrition principles — nutrient-dense, minimally processed
4. Are practical to make with a standard kitchen

In a few seconds, three suggestions appear. Each one includes:
- A recipe name
- A brief description of the dish
- The key ingredients it uses from your inventory
- Why it fits the longevity nutrition approach

---

### How the AI Uses Your Inventory

The AI doesn't just randomly generate recipes — it specifically anchors on what you have. If your inventory shows a lot of spinach, chickpeas, and olive oil, you'll see Mediterranean-inspired suggestions that use those. If you have sweet potatoes and black beans running low and chicken at high stock, it'll lean toward chicken-forward dishes.

This makes the feature most useful when your inventory is well-maintained. The better your inventory data, the more relevant the suggestions.

---

### Saving a Recipe Idea as a Draft

If one of the suggestions looks worth trying, click **Save as Draft**. This creates a new recipe record in your recipe library with the AI's title and description. It starts as a draft — you can flesh it out with exact ingredient quantities, instructions, and a photo before sharing it.

Saving as a draft is a good starting point for building a new protocol:
1. AI suggests the recipe
2. You save as draft
3. You cook it and refine the quantities
4. You build a Fuel protocol from the final version
5. You log it going forward with full nutrition tracking

---

### Regenerating

Not happy with the three suggestions? Click **Generate Recipe Ideas** again. The AI generates a fresh set each time — it won't repeat the same suggestions from the previous run (though it might suggest similar dishes if your inventory hasn't changed).

Inventory changes affect the suggestions. If you just restocked a different set of ingredients, the new ideas will reflect that.

---

### What the AI Is Optimized For

The prompt sent to the AI explicitly asks for longevity-focused, nutrient-dense suggestions. This means:

- It prefers whole foods over processed ones
- It biases toward vegetables, legumes, and lean proteins
- It avoids suggesting dishes that are primarily high-calorie, low-nutrient
- It's not going to suggest "use your leftover chips to make nachos" even if chips are in your inventory

This makes the feature different from a generic "what can I make with these ingredients" tool. The bias is toward the kind of eating that CentenarianOS is built around.

---

### Limitations

A few things to keep in mind:

- The AI doesn't know your cooking skill level or equipment — suggestions may occasionally involve techniques or tools you don't have
- Ingredient quantities in suggestions are approximate — treat them as a starting point, not a precise recipe
- The AI doesn't know your taste preferences — some suggestions will miss the mark; regenerate if needed
- This feature requires an active internet connection to call the Gemini API

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/recipe-ideas — show the empty state or previous suggestions]

> [SCREEN: Click "Generate Recipe Ideas" — show a loading spinner]

> [SCREEN: Three recipe suggestions appear — pan down to show all three]

> [SCREENSHOT: Three recipe cards with callouts: Recipe name, Description, Key ingredients used, "Longevity note" or nutrition rationale]

> [SCREEN: Click on one suggestion to expand or view details — show the full description and ingredient list]

> [SCREEN: Click "Save as Draft" on one suggestion — show confirmation message]

> [SCREEN: Navigate to the Recipes section — show the saved draft appears in the library]

> [SCREENSHOT: Recipe library with the new AI-generated draft visible, marked as "Draft"]

> [SCREEN: Return to /dashboard/fuel/recipe-ideas — click "Generate Recipe Ideas" again — show a new set of three suggestions]

> [SCREENSHOT: New set of suggestions — point out they're different from the first set]

> [SCREEN: End on the suggestions page — end lesson]

---

## Key Takeaways

- AI Recipe Ideas generates three recipe suggestions based on your current inventory using Gemini
- Suggestions prioritize Green NCV ingredients and longevity nutrition principles
- The better your inventory data, the more relevant the suggestions
- Save any suggestion as a draft to your recipe library — edit it, add a photo, then publish or build into a protocol
- Regenerate for a fresh set any time — suggestions change with each generation
- Optimized for nutrient-dense, whole-food cooking — won't suggest junk food even if you have junk food in inventory
