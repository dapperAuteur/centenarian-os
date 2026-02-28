# Lesson 1: The Data Hub — Your Data Command Center

**Course:** Data Hub Guide
**Module:** Getting Started
**Duration:** ~4 min
**Lesson type:** text
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Your data lives across ten modules — finance, health, travel, equipment, workouts, and more. The Data Hub brings every import and export into one centralized page so you never have to hunt for the right button.

---

### What Is the Data Hub?

The Data Hub lives at **Dashboard > Life > Data Hub** (or `/dashboard/data`). It shows a grid of cards — one for every module that supports bulk data — with three actions per card:

- **Import** — opens the import page where you upload a CSV or paste a Google Sheets URL
- **Export All** — downloads all your data for that module as a CSV file
- **Template** — downloads a pre-filled CSV template with example rows

---

### Modules Available

| Module | What You Can Import/Export |
|--------|--------------------------|
| **Finance** | Transactions — income, expenses, transfers |
| **Health Metrics** | Daily logs — RHR, steps, sleep, activity, body comp |
| **Trips** | All trip logs — car, bike, walk, transit, flight |
| **Fuel Logs** | Fill-ups — gallons, cost, MPG, station |
| **Maintenance** | Vehicle service records and reminders |
| **Vehicles** | Your fleet — cars, bikes, trucks, boats |
| **Equipment** | Gear, tools, and merchandise |
| **Contacts** | Vendors, customers, and saved locations |
| **Tasks** | Planner tasks — daily, weekly, recurring |
| **Workouts** | Workout logs with exercises |

---

### Quick Access from Dashboards

You don't have to visit the Data Hub every time. Each module dashboard also has Import and Export buttons in its header:

- **Finance** — Import + Export buttons in the action bar
- **Health Metrics** — Import + Export next to the date
- **Travel** — Import Data + Export Trips in the quick links grid
- **Equipment** — Import + Export next to Add Item
- **Planner** — Import + Export in the view controls bar
- **Workouts** — Import + Export next to Quick Log / New Template

---

### Export Filter Parameters

Each export URL supports optional query parameters for filtered downloads:

```
/api/finance/export?from=2026-01-01&to=2026-01-31
/api/travel/trips/export?mode=bike&trip_category=fitness
/api/equipment/export?category_id=abc123
/api/planner/export?tag=work&completed=false
```

You can type these directly in your browser or bookmark them for regular use.

---

## Screen Recording Notes

> [SCREEN: Navigate to Dashboard > Life > Data Hub]

> [SCREENSHOT: Data Hub page showing 10 module cards with Import, Export, Template buttons]

> [SCREEN: Click Export All on Finance card — show CSV download]

> [SCREEN: Click Template on Trips card — show template download]

> [SCREEN: Navigate to Workouts dashboard — show Import + Export buttons in the header]

---

## Key Takeaways

- The Data Hub is a single page for all your data import/export needs
- Each module card has Import, Export, and Template buttons
- Dashboard pages also have their own Import/Export buttons for quick access
- Export URLs support date ranges and module-specific filters
