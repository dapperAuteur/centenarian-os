# Lesson 12: Trip Templates & Quick Logging

**Course:** Mastering Travel Tracking
**Module:** Advanced Trips
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

If you take the same trip regularly — a daily commute, a weekly grocery run, a recurring bike route — trip templates let you save the details once and log it again with one click. Templates support both single-leg and multi-stop trips.

---

### What Is a Trip Template?

A trip template is a saved trip configuration. It stores:
- Origin and destination
- Mode of transport
- Distance
- Vehicle (if applicable)
- Trip category (travel/fitness)
- Tax category (personal/business/medical/charitable)
- Whether it's a round trip
- Notes

For multi-stop templates, it also stores all intermediate stops.

---

### Creating a Template

Navigate to `/dashboard/travel` and find the **Templates** section. Click **+ New Template**.

Fill in the template form with the trip details you want to reuse. The form is identical to the regular trip form, with one addition: a **Template Name** field at the top.

Give it a descriptive name like "Weekday Commute" or "Saturday Bike Loop."

---

### Multi-Stop Templates

Toggle **Multi-Stop** on the template form to define intermediate stops. Each stop has:
- Location name
- Distance from previous stop
- Mode of transport

The `is_multi_stop` flag on the template tells the system to create a route (with multiple legs) instead of a single trip when you use the template.

---

### Using a Template

From the trip creation form, you'll see a **From Template** dropdown. Select a template, and all fields auto-fill with the saved values. Adjust the date (and optionally the cost, if fuel prices have changed), then save.

For multi-stop templates, the system creates:
1. A new route with the template name + today's date
2. Individual trip legs for each stop in the template

---

### Editing and Deleting Templates

Templates are managed from the Templates section:
- **Edit** — update any field. Changes only affect future uses, not past trips created from the template.
- **Delete** — removes the template. Past trips created from it are unaffected.

---

### Example Template Data

**Single-leg template:**
```json
{
  "name": "Weekday Commute",
  "origin": "Home",
  "destination": "Office",
  "mode": "car",
  "distance_miles": 12.5,
  "is_round_trip": true,
  "trip_category": "travel",
  "tax_category": "business",
  "vehicle_id": "vehicle-crv-2020",
  "is_multi_stop": false
}
```

**Multi-stop template:**
```json
{
  "name": "Saturday Errands",
  "is_multi_stop": true,
  "stops": [
    { "location": "Home", "distance_from_previous": 0 },
    { "location": "Grocery Store", "distance_from_previous": 3.2 },
    { "location": "Hardware Store", "distance_from_previous": 1.8 },
    { "location": "Home", "distance_from_previous": 4.5 }
  ]
}
```

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel — show the Templates section]

> [SCREEN: Click "+ New Template" — fill in: name "Weekday Commute", origin "Home", destination "Office", mode car, distance 12.5, round trip ON]

> [SCREEN: Save the template — show it appear in the templates list]

> [SCREEN: Navigate to trip creation — click "From Template" dropdown — select "Weekday Commute"]

> [SCREENSHOT: Trip form with auto-filled fields from template — callout: "All fields populated from template"]

> [SCREEN: Adjust the date — save the trip]

> [SCREEN: Create a multi-stop template with 3 stops — save]

---

## Key Takeaways

- Templates save trip configurations for repeated journeys
- Single-leg and multi-stop templates are supported
- Use "From Template" on the trip form to auto-fill all fields
- Multi-stop templates create routes with per-leg trip records
- Edit/delete templates without affecting past trips
