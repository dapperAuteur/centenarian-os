# Lesson 11: Multi-Stop Routes

**Course:** Mastering Travel Tracking
**Module:** Advanced Trips
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

A multi-stop route is a trip with intermediate stops — not just A to B, but A to B to C to D. Each leg of the route is its own trip record with independent distance, cost, and mode of transport. The route ties them together as a single journey.

---

### When to Use Multi-Stop Routes

Use a route when:
- You're taking a road trip with planned stops (SF → Fresno → Vegas)
- You commute through multiple waypoints
- You combine transport modes on one journey (drive to train station, train to city, walk to office)

Single-leg trips (A to B with no stops) don't need routes — just log them as regular trips.

---

### Creating a Multi-Stop Route

Navigate to `/dashboard/travel` and click **Add Trip**. The unified trip form opens with 2 stops by default (a simple A→B trip).

To create a multi-stop route, click **+ Add Stop**. Once you have 3 or more stops, the form title changes to "Multi-Stop Route" and route-level fields appear:

- **Route Name** — a descriptive label (e.g., "SF to Vegas Road Trip")
- **Date** — the date of the journey
- **Budget** (optional) — set a spending target for the whole route
- **Brand** (optional) — tag the route with a business brand for P&L tracking
- **Visibility** — private, shared, or public

---

### Adding Legs

Each pair of consecutive stops creates a leg. For each leg, fill in:

- **Vehicle** — select from Your Vehicles or Public Transport (plane, train, bus, ferry, rideshare)
- **Origin / Destination** — auto-populated from stop order; supports saved contact locations
- **Distance** — miles for this leg
- **Cost** — fuel/ticket/fare cost (optional; legs with cost > $0 create linked finance transactions)

Each leg also has collapsible **Purpose & Details** and **Booking Details** sections for tax tagging, calories, confirmation numbers, seat assignments, and more.

Legs are ordered by `leg_order` within the route. The first leg starts from stop 1, and each subsequent leg starts where the previous one ended.

---

### Cost Tracking Per Leg

If a leg has a cost greater than $0, the system can create a linked financial transaction for that leg. This means each stop-to-stop segment has its own expense record in your Finance module.

This is useful for multi-modal trips where each leg has a different cost structure — gas for the driving segment, a train ticket for the rail segment, etc.

---

### Viewing a Route

The route detail page at `/dashboard/travel/routes/[id]` shows:
- Route summary: name, date, total distance (sum of all legs), total cost
- A map of the route (if map content is available)
- Each leg listed in order with distance, mode, cost, and origin/destination
- Links to individual trip records for each leg

---

### Example Route Data

Here's what a 3-stop route looks like:

**Route:**
```json
{
  "name": "SF to Vegas Road Trip",
  "date": "2026-03-15",
  "notes": "Spring break road trip — overnight in Fresno"
}
```

**Legs:**
```json
[
  { "leg_order": 1, "origin": "San Francisco, CA", "destination": "Fresno, CA", "mode": "car", "distance_miles": 185, "cost": 32.50 },
  { "leg_order": 2, "origin": "Fresno, CA", "destination": "Bakersfield, CA", "mode": "car", "distance_miles": 112, "cost": 19.00 },
  { "leg_order": 3, "origin": "Bakersfield, CA", "destination": "Las Vegas, NV", "mode": "car", "distance_miles": 283, "cost": 48.00 }
]
```

**Total: 580 miles, $99.50 in fuel**

---

### Map Content for Routes

A route can include map data to visualize the journey:

```json
{
  "center": [36.5, -118.5],
  "zoom": 6,
  "markers": [
    { "lat": 37.7749, "lng": -122.4194, "title": "San Francisco", "description": "Starting point" },
    { "lat": 36.7378, "lng": -119.7871, "title": "Fresno", "description": "Overnight stop" },
    { "lat": 35.3733, "lng": -119.0187, "title": "Bakersfield", "description": "Fuel stop" },
    { "lat": 36.1699, "lng": -115.1398, "title": "Las Vegas", "description": "Final destination" }
  ],
  "lines": [
    { "coordinates": [[37.7749, -122.4194], [36.7378, -119.7871]], "color": "#3B82F6", "label": "Leg 1: SF → Fresno (185 mi)" },
    { "coordinates": [[36.7378, -119.7871], [35.3733, -119.0187]], "color": "#10B981", "label": "Leg 2: Fresno → Bakersfield (112 mi)" },
    { "coordinates": [[35.3733, -119.0187], [36.1699, -115.1398]], "color": "#EF4444", "label": "Leg 3: Bakersfield → Vegas (283 mi)" }
  ]
}
```

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel — show the Routes section]

> [SCREEN: Click "+ New Route" — fill in name, date, notes — save]

> [SCREEN: Add Leg 1: SF → Fresno, car, 185 miles, $32.50]

> [SCREEN: Add Leg 2: Fresno → Bakersfield, car, 112 miles, $19.00]

> [SCREEN: Add Leg 3: Bakersfield → Vegas, car, 283 miles, $48.00]

> [SCREENSHOT: Route detail page — callouts: Route summary (total 580 mi, $99.50), Legs in order, Map visualization]

> [SCREEN: Click into Leg 1 — show the individual trip record with finance link]

---

## Key Takeaways

- Multi-stop routes group sequential trip legs under one journey name
- Each leg is its own trip record with independent distance, cost, and mode
- Legs with costs can create linked financial transactions
- Route detail page shows total distance/cost and an ordered leg list
- Use for road trips, multi-modal commutes, and any journey with waypoints
