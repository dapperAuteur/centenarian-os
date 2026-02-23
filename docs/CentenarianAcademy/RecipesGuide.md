# CentenarianOS Recipes — User Guide

## What Is the Recipes Module?

Recipes is your personal and public cooking library inside CentenarianOS. Create, share, and discover longevity-focused recipes — complete with nutrition tracking, ingredient analysis, and NCV (Nutritional Caloric Value) scoring that tells you at a glance whether a meal is nutrient-dense or calorie-dense.

Your recipes live at `/recipes` and can be shared publicly with the entire CentenarianOS community.

---

## Getting Started

Navigate to **Dashboard → Recipes** (or go to `/dashboard/recipes`). From here you can:
- View and manage all your recipes
- See analytics on which recipes get the most views
- Browse recipes you've liked or saved from other cooks

---

## Creating a Recipe

### Step 1 — New Recipe

Click **New Recipe** from Dashboard → Recipes, or go to `/dashboard/recipes/new`.

### Step 2 — Add the Basics

- **Title** — Be specific: "Lemon Garlic Salmon with Wild Rice" not "Salmon Dish." Up to 300 characters.
- **Description** — A 1–3 sentence overview (up to 500 characters) that explains why this recipe is worth making and who it's for. This appears in recipe cards on the public listing.
- **Cover Image** — Upload a photo of the finished dish. Photos dramatically increase clicks. Recommended: shoot in natural light, landscape orientation.

### Step 3 — Set Recipe Details

| Field | Description |
|---|---|
| **Servings** | Number of portions the recipe makes (required for per-serving nutrition) |
| **Prep Time** | Minutes to prepare before cooking |
| **Cook Time** | Minutes of active cooking time |

### Step 4 — Build Your Ingredient List

This is the most powerful part of the recipe builder. Each ingredient is looked up in the USDA Food Data Central database or Open Food Facts to automatically pull nutrition data.

**To add an ingredient:**
1. Type the ingredient name in the search field (e.g., "wild salmon," "olive oil," "brown rice")
2. Select the matching item from the dropdown results
3. Enter the quantity and unit (grams, oz, cups, tbsp, tsp, pieces, etc.)
4. The ingredient's nutrition values are auto-populated and scaled to your quantity

**Units supported:** g, kg, oz, lb, ml, L, cup, tbsp, tsp, piece, slice, whole, and more.

**Manual entry:** If an ingredient isn't in the database, you can enter it manually with custom nutrition values.

**Reorder:** Drag ingredients up and down to match your recipe's order of assembly.

**Edit or remove:** Click the pencil icon to edit quantity/unit, or the trash icon to remove.

### Step 5 — Write the Instructions

The instructions editor is a full rich-text editor (same as the Blog):
- Use **numbered lists** for step-by-step directions
- Use **headings** to separate prep, cooking, and plating sections
- Use **bold** to highlight critical steps or temperatures
- Embed images inline if you have process photos

### Step 6 — Add Additional Media

Beyond the cover image, you can upload a media gallery — multiple photos showing prep steps, or a video walkthrough. Go to the **Media** tab and upload images or videos (Cloudinary storage). Each media item can have an optional caption.

### Step 7 — Add Tags

Tag your recipe so others can find it. Examples: `high-protein`, `anti-inflammatory`, `meal-prep`, `omega-3`, `gluten-free`, `under-30-minutes`. Use 3–8 tags. Tags appear on the public listing page and are filterable.

### Step 8 — Set Visibility and Publish

| Visibility | Who Can See |
|---|---|
| **Draft** | Only you |
| **Public** | Everyone, including non-logged-in visitors |
| **Scheduled** | Goes public automatically at a set date/time |

Click **Publish** to make your recipe live.

---

## Understanding the NCV Score

Every recipe gets an automatic **NCV (Nutritional Caloric Value) score** based on how nutrient-dense the calories are.

| Score | Meaning | Example |
|---|---|---|
| **Green** | High nutrient density — protein and fiber are high relative to calories | Salmon + vegetables |
| **Yellow** | Moderate — balanced macros | Mixed grain bowl |
| **Red** | Calorie-dense with lower protein/fiber ratio | Pastries, heavy sauces |

**How it's calculated:** NCV = (total protein grams + total fiber grams) ÷ total calories. A higher ratio means more nutritional "work" per calorie.

NCV is not a judgment — context matters. A pre-workout meal might be high-carb (Yellow) by design. Use NCV as one signal, not the whole picture.

---

## Nutrition Panel

After adding ingredients, the **Nutrition Panel** shows:

- **Total calories, protein, carbs, fat, fiber** for the whole recipe
- **Per-serving breakdown** (calculated from your serving count)
- **NCV badge** (Green / Yellow / Red)

Nutrition updates live as you add or modify ingredients. You don't need to calculate anything manually.

---

## Importing a Recipe from a Website

Found a recipe on another website you want to save and adapt? Use the import feature:

1. Go to **Dashboard → Recipes** and click **Import Recipe** (or `/dashboard/recipes/import`)
2. Paste the full URL of the recipe page
3. Click **Import**
4. CentenarianOS automatically reads the recipe's structured data (schema.org/Recipe format) and fills in:
   - Title, description
   - Ingredients (parsed from the ingredient list)
   - Prep time, cook time, servings
   - Instructions
5. Review the imported recipe — adjust quantities, look up USDA nutrition data for each ingredient, and add your own notes
6. Publish or save as draft

**Works with:** Most major recipe websites (AllRecipes, Food Network, NYT Cooking, etc.) that use structured recipe markup. Results may vary on sites that don't use standard markup.

---

## Cloning Another User's Recipe

On any public recipe, you'll see a **Clone** button. Cloning copies the entire recipe (title, ingredients, instructions, media) to your own account as a draft. This is useful for:
- Adapting a community recipe to your dietary needs
- Using a recipe as a template and making it your own
- Keeping a local copy of a favorite you want to preserve

After cloning, you own the copy and can edit it freely. The original recipe is not affected.

---

## Recipe Analytics

Every published recipe has an analytics view accessible from Dashboard → Recipes → (click on recipe) → Analytics.

| Metric | What It Means |
|---|---|
| **Views** | Total times the recipe was opened |
| **Country** | Where viewers are located |
| **Referrer** | What website or search engine sent them |
| **Shares** | Copy link, email, and LinkedIn shares |

Use analytics to see which of your recipes resonate most with the community.

---

## Liking, Saving, and Sharing

**As a reader:**
- **Like** (heart icon) — tells the cook their recipe is appreciated
- **Save** (bookmark icon) — adds to your personal saved recipes list at Dashboard → Recipes → Saved

**Sharing:**
- **Copy link** — copies the full recipe URL
- **Email** — opens email client with pre-filled subject
- **LinkedIn** — opens LinkedIn share dialog

---

## Using Recipes with the Fuel / Meal Planner

Recipes integrate with the platform's Fuel tracking feature. On any recipe detail page, click **Add to Fuel** to log the recipe as a meal or plan it into your meal schedule. When added, the nutrition totals from the recipe are carried over automatically — no re-entering macros.

---

## Tips for High-Quality Recipes

1. **Be precise with ingredients** — Use grams for dry goods (more accurate than cups) when you care about nutrition precision.
2. **Aim for Green NCV** — The Centenarian community is longevity-focused. High protein, high fiber recipes get more engagement.
3. **Include a "why"** — In your description or opening instruction paragraph, briefly explain the longevity angle: "Wild salmon provides EPA/DHA which supports cardiovascular health…"
4. **Add a process photo** — Even one mid-cook photo in the gallery dramatically improves recipe credibility.
5. **Tag for discoverability** — Think about what someone would search to find your recipe. Use both diet-style tags (`keto`, `mediterranean`) and ingredient tags (`blueberry`, `turmeric`).
6. **Cross-link with your blog** — Write a blog post about the recipe's health benefits and link to the recipe. Write a recipe and link it from a relevant blog post.

---

## Frequently Asked Questions

**Can I make a recipe private after publishing?**
Yes. Edit the recipe and change Visibility to Draft. It will be removed from the public listing immediately.

**Does nutrition data account for cooking losses?**
No — raw ingredient values are used. Cooking can reduce some nutrients (water-soluble vitamins) and change weights. For most purposes raw values give you a reliable estimate.

**What if an ingredient isn't in the USDA database?**
You can add it manually and enter your own nutrition values. Use the nutrition label from the product packaging.

**How do I delete a recipe?**
From Dashboard → Recipes, click the menu (three dots) on the recipe and select Delete. This permanently removes the recipe and its media.

**Can I see who liked or saved my recipe?**
Currently you can see counts (like count, save count) but not individual user names.

**Is there a limit to how many recipes I can create?**
No limit. Create as many as you like.

**Can two people collaborate on a recipe?**
Currently recipes are single-author. You can clone and credit the original author in the description.
