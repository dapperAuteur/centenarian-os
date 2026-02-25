# Lesson 06: Data Export

**Course:** Mastering Correlations & Analytics
**Module:** Data Management
**Duration:** ~3 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Your data belongs to you. CentenarianOS gives you a direct export of everything the Analytics engine has computed — correlation findings, module stats, sample sizes, confidence scores — in a structured JSON file you can use anywhere.

---

### Exporting from the Analytics Page

Navigate to `/dashboard/analytics`. At the bottom of the page, there's a **Data Export** section with an **Export JSON** button.

Click **Export JSON**. A file named `analytics-YYYY-MM-DD.json` downloads immediately — the filename includes today's date so multiple exports stay organized.

The export reflects whatever time range you currently have selected (30, 60, or 90 days). To export a specific period, set the time range first, then click Export JSON.

---

### What's in the Export

The JSON file contains everything the Analytics engine computed for the selected period:

**Correlation findings:**
- All discovered correlations that met the threshold (category, insight text, sample size, confidence %, impact %)
- The raw metric averages behind each finding (e.g., green day avg energy: 4.2, non-green avg: 3.6)

**Module stats:**
- Planner: completion rate, total tasks completed, current streak
- Fuel: green days %, total meals, restaurant %, total cost
- Engine: total focus hours, avg energy rating, sessions per day
- Body: avg pain score, pain-free days %, total logged entries

**Metadata:**
- Time range
- Export date

---

### What You Can Do With It

**Share with a coach or physician.** If you're working with a health professional, the JSON export gives them a concise, structured view of your patterns and performance over the selected period. More useful than a verbal summary.

**Import into a spreadsheet.** Use `JSON to CSV` tools (free web utilities) to convert the export into a spreadsheet for custom calculations or visualization.

**Track over time.** Export monthly and keep the files. Over six months, you can compare exports and see how your correlation strengths and module stats have changed — a longitudinal record of your protocol changes and their effects.

**Personal archive.** Your data is stored in Supabase, but having local copies is good practice. Monthly exports ensure you have an offline record.

---

### CSV Export

The Analytics page also has a **CSV Export** button. This is currently in development — the button is visible but disabled. When released, it will provide a flat spreadsheet format directly from the page without requiring a JSON-to-CSV conversion step.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/analytics — scroll to the Data Export section at the bottom]

> [SCREENSHOT: Data Export section — callouts: Export JSON button, disabled CSV button with "coming soon" note]

> [SCREEN: Set time range to 90d — click Export JSON — file downloads]

> [SCREENSHOT: Downloaded file in browser or Finder — filename shows today's date]

> [SCREEN: Open the JSON file in a text editor or JSON viewer — show the structure]

> [SCREENSHOT: JSON file structure — callouts: "correlations" array (with category, text, confidence, impact), "moduleStats" object (planner, fuel, engine, body sections), "exportedAt" timestamp]

> [SCREEN: End on the JSON viewer — end lesson and the course]

---

## Key Takeaways

- Export JSON button at the bottom of /dashboard/analytics — exports the current time range selection
- Filename includes today's date: `analytics-YYYY-MM-DD.json`
- Export contains: discovered correlations (with raw averages), all four module stats, time range metadata
- Use cases: sharing with coaches/physicians, spreadsheet analysis, monthly archiving, longitudinal tracking
- CSV export is in development (visible but disabled on the page)
- Export before changing your time range if you want a specific period archived
