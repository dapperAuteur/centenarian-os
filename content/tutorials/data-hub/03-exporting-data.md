# Lesson 3: Exporting Data — Full, Date Range & Filtered

**Course:** Data Hub Guide
**Module:** Getting Started
**Duration:** ~4 min
**Lesson type:** text
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Your data belongs to you. CentenarianOS makes it easy to export everything — or just a filtered slice — as a downloadable CSV file. Use exports for backups, analysis in spreadsheets, or migrating to another tool.

---

### Full Export

The simplest export: click **Export All** on any module card in the Data Hub. This downloads every record you have for that module as a CSV file.

The file is named with the module and today's date, for example:
- `trips-export-2026-02-28.csv`
- `finance-export-2026-02-28.csv`

---

### Date Range Export

Most modules support `from` and `to` query parameters to export a specific date range:

```
/api/finance/export?from=2026-01-01&to=2026-01-31
/api/health-metrics/export?from=2026-02-01&to=2026-02-28
/api/travel/trips/export?from=2025-06-01&to=2025-12-31
/api/planner/export?from=2026-01-01&to=2026-03-31
/api/workouts/logs/export?from=2026-01-01&to=2026-02-28
```

Type these URLs directly in your browser's address bar, or bookmark them.

---

### Filtered Export

Some modules support additional filters beyond date ranges:

| Module | Filter Parameters | Example |
|--------|-------------------|---------|
| **Trips** | `mode`, `trip_category` | `?mode=bike&trip_category=fitness` |
| **Fuel Logs** | `vehicle_id` | `?vehicle_id=abc-123` |
| **Maintenance** | `vehicle_id` | `?vehicle_id=abc-123` |
| **Vehicles** | `include_retired` | `?include_retired=true` |
| **Equipment** | `category_id` | `?category_id=xyz-456` |
| **Contacts** | `type` | `?type=vendor` |
| **Tasks** | `tag`, `completed` | `?tag=work&completed=false` |

You can combine date range and filter parameters:

```
/api/travel/trips/export?from=2026-01-01&to=2026-06-30&mode=car&trip_category=business
```

---

### What's in the Export?

Each CSV includes all fields for that module. Here's what to expect:

| Module | Key Columns |
|--------|-------------|
| **Finance** | date, amount, type, description, vendor, category, account |
| **Health Metrics** | logged_date, resting_hr, steps, sleep_hours, activity_min, hrv_ms, spo2_pct, weight_lbs |
| **Trips** | date, mode, origin, destination, distance_miles, cost, vehicle, co2_kg |
| **Fuel** | date, vehicle, odometer_miles, gallons, total_cost, mpg_calculated |
| **Maintenance** | date, vehicle, service_type, cost, vendor, next_service_date |
| **Vehicles** | type, nickname, make, model, year, ownership_type |
| **Equipment** | name, category, brand, purchase_price, current_value, condition |
| **Contacts** | name, contact_type, location_label, address, lat, lng |
| **Tasks** | date, activity, description, tag, priority, completed, estimated_cost |
| **Workouts** | date, name, exercise_name, sets_completed, reps_completed, weight_lbs |

---

### Tips for Working with Exports

1. **Open in Google Sheets** — drag the downloaded CSV into Google Drive, then open with Sheets
2. **Pivot tables** — use the exported data to create custom reports and charts
3. **Regular backups** — bookmark your export URLs and download monthly
4. **Re-import after edits** — export, edit in a spreadsheet, then re-import via the Data Hub

---

## Screen Recording Notes

> [SCREEN: Click Export All on the Finance card — show CSV download]

> [SCREEN: Open the exported CSV in Google Sheets — show the data]

> [SCREEN: Type a date-range URL in the browser: /api/travel/trips/export?from=2026-01-01&to=2026-01-31]

> [SCREEN: Show the filtered export downloading]

> [SCREEN: Type a combined filter URL: /api/planner/export?tag=work&completed=false]

> [SCREEN: Open the result in a spreadsheet — show filtered task data]

---

## Key Takeaways

- Export All downloads every record for a module as CSV
- Add `?from=` and `?to=` for date-range filtering
- Module-specific filters let you export exactly the data you need
- Combine date ranges with filters for precision exports
- Use exported CSVs for backups, analysis, or re-import after edits
