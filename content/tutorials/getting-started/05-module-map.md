# Lesson 05: The Module Map — What Lives Where

**Course:** Getting Started with CentenarianOS
**Module:** Platform Tour
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

This lesson is a reference. It lists every module in CentenarianOS, what it does, and where to find it. Bookmark this lesson and come back whenever you need to find something.

---

### Operate Group

| Module | Path | What It Does | Paid? |
|--------|------|-------------|-------|
| **Daily Tasks** | `/dashboard/planner` | Daily planner with week, 3-day, and daily views. Create one-off and recurring tasks. Assign contacts, locations, and financial tracking to tasks. | Yes |
| **Engine** | `/dashboard/engine` | Focus timer (simple + Pomodoro), session templates, daily debrief (energy, wins, challenges), pain/body check logging. Analytics across all sessions. | Yes |
| **Weekly Review** | `/dashboard/weekly-review` | AI-generated summary of your week — tasks completed, focus hours, spending, health data. Powered by Gemini. | Yes |
| **Roadmap** | `/dashboard/roadmap` | Multi-level goal hierarchy: Roadmap → Goal → Milestone → Task. Archive/restore with 30-day retention. Category tags and target dates. | Yes |

---

### Health Group

| Module | Path | What It Does | Paid? |
|--------|------|-------------|-------|
| **Fuel** | `/dashboard/fuel` | Ingredient library with NCV (Nutrient Cost Value) framework. Meal logging, cost tracking, USDA and Open Food Facts API integration. Auto inventory management. | Yes |
| **Metrics** | `/dashboard/metrics` | Daily health log — resting heart rate, steps, sleep hours, activity minutes. 3-tier system: Core, Enrichment (per-metric unlock), Body Composition (locked, requires disclaimer). | Yes |
| **Wearables** | `/dashboard/settings/wearables` | OAuth connections: Oura, WHOOP, Garmin (auto-sync daily). CSV imports: Apple Health, Google Health, InBody, Hume Health. | Yes |
| **Workouts** | `/dashboard/workouts` | Exercise tracking and logging. | Yes |
| **Correlations** | `/dashboard/correlations` | Cross-metric analysis — find relationships between nutrition, sleep, focus, and other tracked data. | Yes |
| **Analytics** | `/dashboard/analytics` | Trends and insights across all health and performance data. | Yes |

---

### Life Group

| Module | Path | What It Does | Paid? |
|--------|------|-------------|-------|
| **Finance** | `/dashboard/finance` | Financial accounts (checking, savings, credit card, loan, cash). Transaction tracking with vendors, categories, and account assignment. Budget categories with monthly limits. Brand/business P&L tracking. CSV import/export. Saved contacts with autocomplete. | Yes |
| **Travel** | `/dashboard/travel` | Vehicle profiles, fuel logs with MPG calculation, receipt OCR (Gemini Vision), trip logging (manual + Garmin import), multi-stop routes, trip templates, round trips, vehicle maintenance, bike savings calculator. | Yes |
| **Equipment** | `/dashboard/equipment` | Catalog gear and possessions. Categories, purchase price, current value, valuation history with charts. Link to financial transactions. Cross-module activity links. Summary dashboard with depreciation and ROI. | Yes |

---

### Learn Group

| Module | Path | What It Does | Paid? |
|--------|------|-------------|-------|
| **Blog** | `/dashboard/blog` | Write, edit, and publish articles with rich text editor and Cloudinary media. Public blog pages with likes, saves, and sharing. | Free |
| **Recipes** | `/dashboard/recipes` | Create and publish recipes. Import recipes from any URL (JSON-LD scraping). Public recipe pages with likes and saves. | Free |
| **Academy** | `/academy` | Course catalog with search, filters, and sorting. Enroll in courses (free or paid). Lesson types: video, audio, text, slides, quiz. Rich media: chapter markers, transcripts, maps, documents, podcast links. CYOA navigation. Progress tracking, assignments, discussions, and learning paths. | Free (catalog + free courses) |
| **Live** | `/live` | Live streaming sessions — scheduled events with embedded video. | Free |

---

### AI Group (Admin Only)

| Module | Path | What It Does | Paid? |
|--------|------|-------------|-------|
| **Coach** | `/dashboard/coach` | AI-powered coaching assistant. Uses your data to provide personalized guidance. | Admin |
| **Gems** | `/dashboard/gems` | AI data consultant — query your data with natural language. | Admin |

---

### Cross-Module Features

These features work across multiple modules:

**Saved Contacts** — a shared vendor/customer/location directory. Used in Finance (vendor autocomplete), Travel (trip origin/destination), and Planner (task contacts). Contacts can have multiple sub-locations.

**Activity Links** — bidirectional connections between records in different modules. Link a task to a trip, a transaction to equipment, a recipe to a workout. Available on equipment detail pages, task edit modals, and other module detail views.

**Contact Locations** — sub-locations within a saved contact. A vendor can have multiple addresses (e.g., "Main Office", "Warehouse"). Used in Travel for trip endpoints and in Planner for task locations.

---

### Quick Reference: All Nav Paths

```
/dashboard/planner       — Daily Tasks
/dashboard/engine        — Focus Engine
/dashboard/weekly-review — Weekly Review
/dashboard/roadmap       — Roadmap & Goals
/dashboard/fuel          — Fuel & Nutrition
/dashboard/metrics       — Health Metrics
/dashboard/settings/wearables — Wearable Connections
/dashboard/workouts      — Workouts
/dashboard/correlations  — Correlations
/dashboard/analytics     — Analytics
/dashboard/finance       — Financial Dashboard
/dashboard/travel        — Travel & Vehicles
/dashboard/equipment     — Equipment Tracker
/dashboard/blog          — Blog
/dashboard/recipes       — Recipes
/academy                 — Academy
/live                    — Live Sessions
/dashboard/billing       — Billing & Subscription
/pricing                 — Pricing Plans
/demo                    — Demo Account
/tech-roadmap            — Product Roadmap
```

---

## Screen Recording Notes

> [SCREEN: Show the dashboard sidebar with all groups expanded]

> [SCREEN: Click through one module from each group — Daily Tasks, Fuel, Finance, Academy, Coach — show each hub page briefly]

> [SCREENSHOT: Sidebar with all groups labeled — callout per group: "Operate (4)", "Health (6)", "Life (3)", "Learn (4)", "AI (2)"]

> [SCREEN: Navigate to /dashboard/finance — show a saved contact autocomplete in action]

> [SCREEN: Navigate to /dashboard/equipment/[id] — show the ActivityLinker component with cross-module links]

> [SCREEN: End on the dashboard main page]

---

## Key Takeaways

- 5 nav groups: Operate (4 modules), Health (6), Life (3), Learn (4), AI (2 admin-only)
- Free modules: Blog, Recipes, Academy, Live
- Everything else requires Monthly ($10/mo) or Lifetime ($100)
- Cross-module features: Saved Contacts, Activity Links, Contact Locations
- All paths are bookmarkable — use the quick reference list above

---

## Map Content (conceptual module map)

If this lesson is rendered with the MapViewer, use this `map_content` JSON to show modules as markers clustered by nav group:

```json
{
  "center": [39.8283, -98.5795],
  "zoom": 4,
  "markers": [
    { "lat": 47.6062, "lng": -122.3321, "title": "Operate: Daily Tasks", "description": "Planner with week/3-day/daily views" },
    { "lat": 47.6162, "lng": -122.3121, "title": "Operate: Engine", "description": "Focus timer, debrief, pain log" },
    { "lat": 47.5962, "lng": -122.3521, "title": "Operate: Weekly Review", "description": "AI-generated weekly summaries" },
    { "lat": 47.6262, "lng": -122.3421, "title": "Operate: Roadmap", "description": "Goal hierarchy: Roadmap → Goal → Milestone → Task" },
    { "lat": 37.7749, "lng": -122.4194, "title": "Health: Fuel", "description": "Nutrition tracking with NCV framework" },
    { "lat": 37.7649, "lng": -122.4094, "title": "Health: Metrics", "description": "RHR, steps, sleep, activity minutes" },
    { "lat": 37.7849, "lng": -122.4294, "title": "Health: Wearables", "description": "Oura, WHOOP, Garmin sync" },
    { "lat": 33.4484, "lng": -112.0740, "title": "Life: Finance", "description": "Accounts, transactions, budgets, brands" },
    { "lat": 33.4384, "lng": -112.0640, "title": "Life: Travel", "description": "Vehicles, fuel, trips, maintenance" },
    { "lat": 33.4584, "lng": -112.0840, "title": "Life: Equipment", "description": "Gear catalog, valuations, activity links" },
    { "lat": 25.7617, "lng": -80.1918, "title": "Learn: Academy", "description": "Course catalog, enrollment, CYOA navigation" },
    { "lat": 25.7717, "lng": -80.1818, "title": "Learn: Blog", "description": "Write and publish articles" },
    { "lat": 25.7517, "lng": -80.2018, "title": "Learn: Recipes", "description": "Create, import, share recipes" }
  ],
  "polygons": [
    { "coordinates": [[47.59, -122.36], [47.63, -122.36], [47.63, -122.30], [47.59, -122.30]], "color": "#8B5CF6", "fillColor": "#8B5CF620", "label": "Operate Cluster" },
    { "coordinates": [[37.76, -122.44], [37.79, -122.44], [37.79, -122.40], [37.76, -122.40]], "color": "#10B981", "fillColor": "#10B98120", "label": "Health Cluster" },
    { "coordinates": [[33.43, -112.09], [33.46, -112.09], [33.46, -112.06], [33.43, -112.06]], "color": "#F59E0B", "fillColor": "#F59E0B20", "label": "Life Cluster" },
    { "coordinates": [[25.74, -80.21], [25.78, -80.21], [25.78, -80.17], [25.74, -80.17]], "color": "#3B82F6", "fillColor": "#3B82F620", "label": "Learn Cluster" }
  ]
}
```
