# Lesson 11: Publishing a Protocol as a Public Recipe

**Course:** Mastering Your Fuel
**Module:** Protocols / Recipes
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Your protocols are private — meal templates you've built for your own tracking. But if you've created something worth sharing, you can publish any protocol as a public recipe. This bridges your personal Fuel module to the community recipe library where other CentenarianOS users can find, save, and cook your recipes.

---

### The Difference Between a Protocol and a Public Recipe

A **protocol** is a private meal template. It has an ingredient list, quantities, and nutrition calculations — but no instructions, no story, no photo. It's built for speed: you created it to log meals quickly, not to share.

A **public recipe** is a full recipe record: title, description, rich cooking instructions (with formatting), a cover photo, ingredient list with nutritional data, tags, and visibility controls. It's built for sharing.

Publishing converts your protocol into a starting point for a public recipe. It copies the ingredient list and basic metadata, then opens the recipe editor so you can add the details a shared recipe needs.

---

### How to Publish a Protocol

Navigate to `/dashboard/fuel/protocols`. Find the protocol you want to publish and click the **Publish** button on its card.

This sends the protocol data to the recipe creation system and opens the recipe editor with:
- The protocol name pre-filled as the recipe title
- The ingredient list imported (names and quantities)
- A blank description and blank instructions

From here, treat it like writing a new recipe:

1. **Write a description** — A few sentences about the dish. What makes it special? Who would enjoy it? When do you make it?

2. **Add instructions** — Step-by-step directions for actually cooking the recipe. Protocols don't have instructions (they're meal templates, not recipe cards), so you'll need to write these fresh. Be specific: temperatures, timing, technique.

3. **Set tags** — Tag the recipe with relevant categories: #breakfast, #high-protein, #meal-prep, #vegetarian, etc. Tags make it discoverable in the recipe library.

4. **Add a cover photo** — Upload a photo of the finished dish. Recipes with photos get significantly more engagement. You can upload from your device or take a photo directly from your phone.

5. **Set visibility** — Choose who can see it:
   - **Draft** — Only you can see it (good for work-in-progress)
   - **Private** — Only accessible via direct link
   - **Authenticated only** — Any logged-in CentenarianOS user
   - **Public** — Anyone, including search engines

Click **Save** to publish.

---

### Nutrition Data on Public Recipes

When a protocol is published as a recipe, the system attempts to carry over the nutritional calculations from the protocol. The NCV score and macro totals from your ingredient library are shown on the recipe card.

However, the public recipe's ingredient list is denormalized — it doesn't link back to your private ingredient library. This means if you update your ingredient costs or nutrition data later, the published recipe won't automatically update. If you edit the recipe's ingredient list directly, you can update the nutrition data there.

---

### Managing Your Published Recipes

After publishing, the recipe lives in your recipe library at `/dashboard/recipes` (or wherever recipes are accessible from your dashboard). You can:

- **Edit** it any time — update instructions, swap photos, change visibility
- **Unpublish** it by changing visibility back to Draft or Private
- **See engagement stats** — view count, likes, saves from other users
- **Delete** it if you no longer want it in the library

The original protocol in your Fuel module is unaffected by publishing. It continues to work for meal logging exactly as before — publishing creates a copy, it doesn't move the protocol.

---

### Why Publish?

A few reasons users publish their protocols:

- **Community contribution** — Your healthy meal templates can help others with similar nutrition goals
- **Sharing with friends and family** — Send a direct link to a recipe you love
- **Building a personal recipe collection** — Public recipes are searchable and shareable; private protocols aren't
- **Teacher-created content** — If you're a teacher on the platform, publishing recipes builds your public presence and can earn engagement metrics

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel/protocols — show a protocol card with the Publish button visible]

> [SCREENSHOT: Protocol card with callout on the "Publish" button — note: "This creates a public recipe from your private protocol"]

> [SCREEN: Click the Publish button on a protocol — transition to the recipe editor with pre-filled data]

> [SCREENSHOT: Recipe editor with the imported ingredient list, blank description field, and blank instructions — callouts showing which fields are pre-filled vs. need to be written]

> [SCREEN: Type a description: "My go-to post-workout smoothie. High protein, loaded with greens, takes 2 minutes to make."]

> [SCREEN: Add instructions in the rich text editor — a few simple steps]

> [SCREEN: Click the Tags field — add tags: breakfast, smoothie, high-protein]

> [SCREEN: Click the cover photo uploader — show the upload interface]

> [SCREEN: Set visibility to "Public" using the visibility selector]

> [SCREEN: Click Save — recipe is published]

> [SCREEN: Navigate to the recipe library — find the newly published recipe]

> [SCREENSHOT: Published recipe card showing: title, cover photo, NCV badge, tags, like/save buttons]

> [SCREEN: Click on the recipe — show the full public recipe view with description, ingredients, and instructions]

> [SCREEN: Return to /dashboard/fuel/protocols — show the original protocol is still there, unchanged]

> [SCREEN: End — end lesson]

---

## Key Takeaways

- Publishing converts a private Fuel protocol into a shareable public recipe
- The protocol's ingredient list is copied to the recipe — you add description, instructions, tags, and a photo
- Visibility controls who can see it: Draft → Private → Authenticated only → Public
- The original protocol is unaffected — publishing creates a copy, not a transfer
- Nutrition data from the protocol carries over; update it in the recipe editor if the ingredient list changes
- Public recipes are visible in the community recipe library and support likes, saves, and engagement stats
