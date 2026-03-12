# Lesson 06: Recording a Trip

**Course:** Mastering Travel Tracking
**Module:** Trips & Activities
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

A fuel fill-up tells you how efficient your vehicle is. A trip tells you where you went and how far. Together, these two data streams give you a complete picture of how you're using your vehicle — and how much each journey actually costs.

This lesson covers manual trip logging: entering a trip directly into CentenarianOS after you've completed it.

---

### What Counts as a Trip?

A trip is any journey you want to remember, analyze, or track. It could be:
- A 1,500-mile road trip across three states
- A 4-mile bike commute to the office
- A weekly errand run around town
- A hiking trail you drove to

The key fields are mode of transport, distance, and date. Everything else is optional but adds useful context.

---

### Navigating to Trips

Go to `/dashboard/travel` or `/dashboard/travel/trips`. You'll see your trip history — or an empty state if this is your first trip.

Click **Add Trip** to open the unified trip form.

---

### The Unified Trip Form

CentenarianOS uses one form for all trips — whether it's a simple A→B drive or a multi-stop journey. A 2-stop trip is a simple trip; add more stops for a multi-stop route. Here are the fields for each leg:

**Vehicle** — Select from two groups: **Your Vehicles** (personal cars, bikes) and **Public Transport** (pre-loaded planes, trains, buses, ferries, rideshare). The vehicle selection auto-sets the travel mode.

**Origin** — Starting point for this leg. Supports saved contact locations for quick selection.

**Destination** — Endpoint for this leg. Same contact location support.

**Date** — The date of the trip. Defaults to today.

**Distance** — In miles. Enter the distance for this leg.

**Cost** (optional) — Fuel cost, ticket price, or fare. Legs with cost > $0 can create linked finance transactions.

**Notes** (optional) — Anything you want to remember about this leg.

**Duration** (optional) — How long the trip took in hours and minutes. Used to calculate average speed when you're curious about that.

---

### Saving the Trip

Fill in the required fields — Vehicle, Date, Mode, and Distance — and click **Save**.

The trip appears in your history immediately. You'll see the distance, mode, and date in the list view.

---

### How Trip Data Powers Your Analytics

Here's why logging trips matters beyond just having a record:

**Bike savings** — Every bike trip you log gets compared against your car's cost per mile. If your car costs $0.18 per mile to fuel, and you rode your bike 8 miles instead of driving, the system shows you saved $1.44 on that trip. Small amounts, but they add up over a year.

**Miles by mode** — Over time, you'll see a breakdown of how many miles you drove vs. biked vs. walked in a given period. This is motivating data for people trying to drive less.

**Route patterns** — If you log the same route regularly (your commute, a favorite trail), you'll see it appear repeatedly in your history, making it easy to filter and analyze that specific journey.

---

### Logging vs. Importing

Manual trip logging is great for ad-hoc trips or routes your Garmin doesn't cover (like a car journey). For recurring activities like bike commutes, runs, and hikes that you already track with a Garmin device, the import feature is a much faster option — we'll cover that in the next lesson.

Most users end up using a combination: import Garmin activities weekly, and manually log car trips that don't show up in Garmin data.

---

### Tax Tagging

The trip form includes a **Tax purpose** field. This is optional, but it's useful if you ever need to document mileage for tax purposes.

The four options are:
- **Personal** (default) — Most trips. No special treatment.
- **Business** — Driving to a client site, a work conference, a job interview. The IRS allows a standard mileage deduction for business use of a personal vehicle. Tagging these trips makes it easy to pull a mileage report at year's end.
- **Medical** — Driving to doctor's appointments, physical therapy, etc. Also potentially deductible.
- **Charitable** — Mileage driven for volunteer work.

Most trips are Personal, so it defaults to that and stays out of your way. But if you do any business driving, get in the habit of tagging those trips as Business from the start. At tax time, you can filter the trip list to "Business" and get a clean mileage log without any extra work.

---

### Travel vs. Fitness

If your mode is Bike, Walk, Run, or another human-powered option, the trip form shows one additional field: **Travel or Fitness**.

This distinction matters for the bike savings calculation:

- **Travel** — You chose the bike (or your feet) instead of driving. A commute to work on your bike, a grocery run on foot, biking to a friend's house. These trips represent real car-trip substitutions — they count toward your savings.
- **Fitness** — A workout. A Saturday trail ride, a training run, an evening walk for exercise. These trips have health value, but they're not replacing a car trip. Counting them as "savings" would be misleading.

When you log a bike trip and mark it Travel, the system adds it to your bike savings total. Mark it Fitness, and it's logged for your activity history but doesn't affect the savings number.

Car, bus, train, plane, ferry, and rideshare trips don't show this toggle — they're always Travel by definition.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/trips — show trip list (empty or with existing trips)]

> [SCREEN: Click "Log Trip" — trip form opens]

> [SCREENSHOT: Full trip form with all fields labeled: Vehicle, Date, Mode, Distance, Start, End, Route Name, Notes, Duration]

> [SCREEN: Click the Vehicle dropdown — show vehicle list — select the car vehicle]

> [SCREEN: Click the Mode dropdown — show options: Car, Bike, Walk, Run, Hike — select "Car"]

> [SCREEN: Type "284" in the Distance field]

> [SCREEN: Type "Denver, CO" in Start and "Salt Lake City, UT" in End]

> [SCREEN: Type "I-70 West" in Route Name]

> [SCREEN: Type "Mountain passes, light traffic" in Notes]

> [SCREEN: Click Save — trip appears in list]

> [SCREENSHOT: Trip list row showing the logged trip with distance and mode icon highlighted]

> [SCREEN: Log a second trip — this time select Mode: Car — scroll down to show the Tax purpose dropdown — click it — show all four options: Personal, Business, Medical, Charitable — select "Business"]

> [SCREENSHOT: Tax purpose dropdown with all four options visible]

> [SCREEN: Save the car trip — it appears in the list with a "Business" badge in the Tags column]

> [SCREEN: Log a third trip — select Mode: Bike, Distance: 4.2]

> [SCREENSHOT: Bike trip form showing the Travel / Fitness toggle appearing below the mode selector — highlight the helper text "Travel counts toward commute savings. Fitness is for workouts."]

> [SCREEN: Select "Travel" on the toggle — fill in Route: "Morning commute" — save]

> [SCREEN: Log a fourth trip — Mode: Bike, Distance: 12 — this time select "Fitness" on the toggle — Route: "Saturday trail ride" — save]

> [SCREEN: Show trip list — the morning commute bike trip shows a savings amount; the Saturday ride shows an orange "Fitness" badge and no savings amount]

> [SCREENSHOT: Trip list with all four trips — callouts labeling: Business badge (car trip), no badge (personal car trip), savings amount (travel bike trip), Fitness badge (fitness bike trip)]

> [SCREEN: Click on a trip row to show the detail/edit view]

---

## Key Takeaways

- A trip needs: vehicle, date, mode of transport, and distance — everything else is optional
- Mode selection (Car vs. Bike) determines which analytics bucket the trip goes into
- **Tax purpose** (Personal / Business / Medical / Charitable) tags trips for IRS mileage logs — default is Personal
- **Travel vs. Fitness** toggle (shown for bike, walk, run): only Travel trips count toward bike savings — Fitness trips are for workouts, not commute savings
- Bike trips marked Fitness appear in your history but don't inflate your savings calculation
- Log car trips manually; use the Garmin import for fitness activities (next lesson)
- Start/end locations and notes are free text — use them for context you'll want later
