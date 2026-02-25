# Lesson 01: Welcome to the Fuel Module

**Course:** Mastering Your Fuel
**Module:** Getting Started
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** linear → lesson 02 next

---

## Narrator Script

The Fuel module is your personal nutrition operating system. It tracks what you eat, how much it costs, and most importantly — how nutrient-dense your diet is. It's not a calorie counter. It's a food quality tracker built around a simple but powerful framework: the NCV score.

In this welcome lesson, we'll take a quick tour of every section in the module so you know what's available before you start building anything.

---

### The Philosophy

Most nutrition apps focus on hitting macros or staying under a calorie budget. CentenarianOS takes a different angle: it asks how nutrient-dense your food is relative to its calorie load.

The idea comes from longevity research. People who live well into their 90s and beyond tend to eat food that delivers a lot of nutritional value for relatively few calories — vegetables, legumes, whole grains, lean proteins. The Fuel module is designed to make that kind of eating easy to track and understand over time.

You'll hear more about the NCV framework in the next lesson. For now, let's walk the map.

---

### Module Overview

Navigate to `/dashboard/fuel`. You'll see the Fuel dashboard — a summary page with live stats and navigation cards for each sub-module.

**Ingredient Library** (`/dashboard/fuel/ingredients`) — Your personal database of foods and their nutritional data. Every ingredient you use in a protocol must first exist here. You can add ingredients manually, look them up in the USDA database, or scan a barcode using Open Food Facts data.

**Protocols** (`/dashboard/fuel/protocols`) — Your personal meal templates. A protocol is like a recipe you use repeatedly: a smoothie, a standard lunch bowl, a favorite dinner. Each protocol lists its ingredients, calculates nutrition totals automatically, and assigns an NCV score.

**Meal Log** (`/dashboard/fuel/meals`) — Your daily eating record. Log what you ate and when — either by selecting a protocol you made, or logging a restaurant meal with location details. The meal log is where your daily nutrition story gets written.

**Inventory** (`/dashboard/fuel/inventory`) — Track how much of each ingredient you have on hand. When you log a meal using a protocol, the system automatically subtracts the ingredients used. When you're running low on something, you'll get an alert.

**Meal Prep** (`/dashboard/fuel/meal-prep`) — For batch cooks. If you make a large pot of soup on Sunday for the whole week, log it here as a batch. Track how many servings you made and how many you have left.

**Recipe Ideas** (`/dashboard/fuel/recipe-ideas`) — An AI-powered feature that looks at your current inventory and suggests three recipes you could make right now using what you have. Powered by Gemini, optimized for longevity nutrition.

---

### How It All Connects

Here's the typical workflow:

1. Add your staple ingredients to the **Ingredient Library**
2. Create a **Protocol** for each meal you eat regularly
3. Set up **Inventory** for the ingredients you stock
4. Each week, **Log your meals** — protocol-based for home cooking, restaurant entries for eating out
5. When you batch cook, record it in **Meal Prep**
6. When you want inspiration, hit **Recipe Ideas**

Over time, the Fuel dashboard shows you your average NCV score, how many meals you've logged, your weekly food cost, and trends that tell you whether your diet is improving.

---

### Who This Is For

The Fuel module works best for people who cook at home at least a few times a week and want more clarity on food quality — not just calories. If you eat out exclusively, the restaurant logging feature still lets you keep a record, though the nutrition depth is reduced.

Ready to understand the scoring system that ties everything together? The next lesson covers the NCV framework — and it will make everything you build here more meaningful.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/fuel — show the full dashboard with stats cards and module navigation]

> [SCREENSHOT: Full fuel dashboard with callouts labeling: Ingredient Library card, Protocols card, Meal Log card, Inventory card, Meal Prep card, Recipe Ideas card]

> [SCREEN: Click through each nav card briefly — show the empty state of each sub-page (about 3 seconds each)]

> [SCREEN: Return to /dashboard/fuel — pause on the stats cards at the top (Meals logged, Week cost, Active batches, Protocols)]

> [SCREENSHOT: Stats cards area with labels pointing to each metric]

> [SCREEN: End on the dashboard home — transition to "Next: The NCV Framework"]

---

## Key Takeaways

- Fuel tracks food quality (NCV score), not just calories — the focus is nutrient density
- Six sub-modules: Ingredient Library, Protocols, Meal Log, Inventory, Meal Prep, Recipe Ideas
- The workflow: add ingredients → create protocols → log meals → track inventory → batch cook
- The NCV framework is the scoring system that connects it all — covered in the next lesson
