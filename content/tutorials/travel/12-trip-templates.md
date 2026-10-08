# Lesson 12: Trip Templates & Quick Logging

**Course:** Mastering Travel Tracking
**Module:** Advanced Trips
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

If you take the same trip regularly — a daily commute, a weekly grocery run, a recurring bike route — trip templates let you save it once and log it again with one tap. A template keeps the distance and time of every leg, so a round trip or a multi-stop route logs the same miles and minutes each time.

---

### What a Template Saves

A template is saved from a trip you log. It keeps:
- The template name (the trip's name)
- Every stop, and for each leg: mode, vehicle, distance, duration, cost, and purpose
- Whether it's a round trip
- Trip category (travel/fitness), tax category (personal/business/medical/charitable), brand, and notes

A trip with one leg is saved as a single-leg template (origin, destination, and that leg's details). A trip with more than one leg, including every round trip, is saved as a multi-stop template.

---

### Saving a Template

1. Go to Dashboard → Travel (or Trip History) and click **Add Trip**.
2. Enter your stops with each leg's mode, miles, minutes, and cost. Tick **Round trip (return to start)** if you come back to where you started.
3. Give the trip a **Trip Name**, such as "Gym run" or "Saturday Errands". A template needs a name.
4. Tick **Save as reusable template** and save.

The trip is logged, and the template is saved from it with the distance and time of every leg. For a round trip, that includes the return leg the form adds for you.

---

### How Stops Are Stored

The first stop is where you start. Every later stop holds the leg that arrives there: its mode, vehicle, miles, minutes, cost, and purpose.

A round trip from Home to the Gym is three stops: Home → Gym → Home. The Gym stop holds the way there and the last Home stop holds the way back, so the template totals 10 miles and 24 minutes for a 5-mile, 12-minute trip each way.

---

### Using a Template

There are three ways to use a template:

1. **Quick log.** In Trip History, open **My Templates** and press the play button on a template. It logs the trip for today with every leg's distance and time. A message confirms what was logged, for example "Logged Gym run: 10.0 mi · 24 min". If a leg can't be saved, nothing is saved and the message says why.
2. **Quick Re-log.** On the Travel dashboard, the Quick Re-log card lists your templates with their total miles and time. Tap one to log it for today.
3. **Load from template.** In Add Trip, pick a template from **Load from template**. Every stop and leg fills in, and you can change anything (the date, a detour, the cost) before you save.

A multi-stop template logs a route with one trip per leg, and the route shows the totals. A single-leg template logs one trip. If a template is marked as a round trip but its stops don't end where they started, Quick log adds a return leg using the outbound distance, time, and cost added together, the same rule Add Trip uses.

Quick log uses each leg's saved vehicle while it is still one of yours or a public transport vehicle. It doesn't create a finance transaction for a leg's cost, but Add Trip does. To record the expense too, use **Load from template** and save through Add Trip.

---

### Reading a Template Card

Each card in My Templates shows:
- Where it goes: "Home ↔ Gym" for a round trip, "Home → Office" for one way, or the number of stops for a longer route
- The total miles and time Quick log will record, for example "10.0 mi · 24 min"
- A **Round trip** or **Multi-stop** label
- How many times you've used it

The Add Trip template list shows the same totals next to each name.

---

### Editing and Deleting Templates

In Trip History, open My Templates:
- **Edit** (pencil): rename the template and change its stops (each leg's location, mode, miles, minutes, and cost), round trip, purpose (commute, leisure, work, errand, exercise, or other), category, tax category, brand, and notes. Under the stops, a line shows what Quick log will record, and when a return leg will be added. Changes only affect future uses, not trips you already logged.
- **Delete** (trash can): removes the template. Trips you already logged from it are not affected.

Round-trip and multi-stop templates saved before October 2026 stored each leg's details one stop too early, so they logged too few miles and minutes. If a template's totals look wrong, open Edit Template and correct each leg's miles and minutes.

---

### Example Template Data

**Single-leg template:**
```json
{
  "name": "Weekday Commute",
  "origin": "Home",
  "destination": "Office",
  "mode": "train",
  "distance_miles": 12.5,
  "duration_min": 40,
  "is_round_trip": false,
  "trip_category": "travel",
  "tax_category": "business",
  "is_multi_stop": false
}
```

**Round-trip template** (logs 10.0 mi · 24 min):
```json
{
  "name": "Gym run",
  "is_multi_stop": true,
  "is_round_trip": true,
  "stops": [
    { "stop_order": 0, "location_name": "Home" },
    { "stop_order": 1, "location_name": "Gym", "mode": "car", "distance_miles": 5, "duration_min": 12 },
    { "stop_order": 2, "location_name": "Home", "mode": "car", "distance_miles": 5, "duration_min": 12 }
  ]
}
```

**Multi-stop template** (logs 9.5 mi · 31 min):
```json
{
  "name": "Saturday Errands",
  "is_multi_stop": true,
  "stops": [
    { "stop_order": 0, "location_name": "Home" },
    { "stop_order": 1, "location_name": "Grocery Store", "mode": "car", "distance_miles": 3.2, "duration_min": 10 },
    { "stop_order": 2, "location_name": "Hardware Store", "mode": "car", "distance_miles": 1.8, "duration_min": 7 },
    { "stop_order": 3, "location_name": "Home", "mode": "car", "distance_miles": 4.5, "duration_min": 14 }
  ]
}
```

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel — click Add Trip]

> [SCREEN: Enter Home → Gym, car, 5 miles, 12 minutes — tick Round trip — show "Return leg auto-added: 5.0 mi · 12 min"]

> [SCREEN: Name the trip "Gym run" — tick "Save as reusable template" — save]

> [SCREEN: Go to Trip History — open My Templates — show the "Gym run" card with "Home ↔ Gym · 10.0 mi · 24 min" and the Round trip label]

> [SCREEN: Press the play button — show "Logged Gym run: 10.0 mi · 24 min" and the new route with two legs]

> [SCREEN: Back on the Travel dashboard — tap "Gym run" in Quick Re-log]

> [SCREEN: Open Add Trip — choose "Gym run" in Load from template — show every stop and leg filled in]

> [SCREEN: Press the pencil on the template — show Edit Template with each leg's miles and minutes and the Quick log total]

---

## Key Takeaways

- Save a template by ticking "Save as reusable template" when you log a trip with a name
- Templates keep every leg's distance and time, including a round trip's return leg
- Log a template with Quick log (My Templates), Quick Re-log (Travel dashboard), or Load from template (Add Trip)
- Template cards show the total miles and time Quick log will record
- Edit or delete templates without affecting trips you already logged
