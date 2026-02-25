# Lesson 09: Importing Recipes from the Web

**Course:** Mastering Your Fuel
**Module:** Recipes
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Found a recipe online you want to try? Instead of copying it manually, CentenarianOS can scrape the recipe directly from most food websites and import it into your recipe library in seconds.

---

### Where This Feature Lives

The recipe import feature is part of the **Recipes** section — the public recipe library, separate from your private Fuel protocols. You'll find it at `/dashboard/recipes` or through the Recipes section of the app.

This is worth clarifying: importing a recipe from the web brings it into your *public recipe library*, not your private Fuel protocols. From there, you can adapt it into a protocol if you want to use it for meal logging (covered in Lesson 11).

---

### How the Import Works

The import uses a web standard called **JSON-LD with schema.org/Recipe markup**. Most major recipe websites use this format to make their recipes machine-readable — it's the same data that shows up in Google search snippets with cooking times and star ratings.

CentenarianOS fetches the page at the URL you provide, finds the structured recipe data embedded in the page, and creates a new recipe record with the title, ingredients, instructions, servings, prep time, and cook time all pre-populated.

No copy-paste required.

---

### Using the Import Feature

Navigate to your Recipes section and find the **Import from URL** button.

Paste in the URL of the recipe page. Click **Import**.

The system fetches the page and extracts the recipe. If the import succeeds, you'll see a preview of the imported data:
- Recipe title
- Ingredient list (name + quantity for each ingredient)
- Instructions
- Servings, prep time, cook time

Review the import. Most of the time it's accurate, but sometimes a poorly formatted site produces incomplete data — double-check the ingredient list especially.

Click **Save** to add the recipe to your library. It's saved as a private draft by default — only you can see it.

---

### What Happens After Import

The imported recipe is now in your library like any other recipe. You can:

- **Edit it** — Clean up any formatting issues, adjust ingredient quantities, add notes
- **Change visibility** — Set it to Public if you want to share it with other CentenarianOS users
- **Add a cover photo** — Upload a photo or keep the default
- **Add nutrition data** — If you want NCV scoring, add nutrition info to the ingredients manually (imported recipes don't automatically connect to your ingredient library)

---

### When Import Doesn't Work

Not every website uses the standard recipe markup. Some sites encode their recipes in a way the scraper can't parse. If an import fails:

- You'll see an error message indicating no recipe data was found
- Try a different URL for the same recipe (some sites have multiple pages)
- If the recipe is on a non-standard site, you'll need to create it manually

Sites that work reliably: AllRecipes, Food Network, Serious Eats, NYT Cooking, Bon Appétit, BBC Good Food, Minimalist Baker, Cookie and Kate, most popular food blogs. Sites that sometimes fail: paywalled publications, personal blogs without proper markup, aggregator sites.

---

### Import vs. Manual Creation

For well-known recipe sites: always try the import first — it's much faster.

For recipes you found in a book, a newsletter, or a site that doesn't use standard markup: create the recipe manually using the recipe editor.

For meal protocols (recipes you plan to log for nutrition tracking): you'll still need to create a Fuel protocol with your library ingredients — the imported recipe won't automatically have NCV scores or inventory integration. Think of the import as a quick way to save a recipe for reference; building a protocol is how you activate it for tracking.

---

## Screen Recording Notes

> [SCREEN: Navigate to the Recipes section (e.g., /dashboard/recipes or wherever the public recipe library is)]

> [SCREEN: Find and click the "Import from URL" button]

> [SCREENSHOT: Import dialog with URL input field — callout: "Works with AllRecipes, Food Network, Serious Eats, and most major recipe sites"]

> [SCREEN: Paste in a URL from a known recipe site (e.g., an AllRecipes URL)]

> [SCREEN: Click Import — show a loading spinner]

> [SCREEN: Show the import preview: title, ingredients list, instructions, servings, prep time]

> [SCREENSHOT: Import preview with callouts: Title, Ingredient count, First few ingredients listed, Prep/Cook time, Servings]

> [SCREEN: Click Save — recipe appears in the library as a draft]

> [SCREEN: Click on the imported recipe to open it — show the full recipe view with ingredients and instructions]

> [SCREEN: Click Edit on the recipe — show the editor with pre-filled fields]

> [SCREENSHOT: Recipe editor showing imported data — callout: "Imported recipes save as private drafts — change visibility to share"]

> [SCREEN: Change visibility to "Public" — show the toggle/selector]

> [SCREEN: Click Save — end lesson]

---

## Key Takeaways

- Import a recipe from any URL using the "Import from URL" feature in the Recipes section
- Uses schema.org/Recipe structured data — works on AllRecipes, Food Network, Serious Eats, and most major food sites
- Imported recipes land in your library as private drafts — edit, add a photo, and publish when ready
- Import doesn't create a Fuel protocol — to use it for meal logging + NCV tracking, build a protocol manually
- If import fails, the site doesn't use standard recipe markup — create the recipe manually instead
