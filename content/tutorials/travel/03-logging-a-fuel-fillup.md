# Lesson 03: Logging a Fuel Fill-Up

**Course:** Mastering Travel Tracking
**Module:** Fuel Logs
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Every time you fill up your tank, you have a small window of opportunity: you're standing at the pump, the receipt is in your hand, and all the data you need is right there. This lesson teaches you how to capture that data in CentenarianOS — either by typing it in manually or by photographing your receipt (we'll cover the photo option in the next lesson).

Let's walk through a manual fuel log entry from start to finish.

---

### Navigating to Fuel Logs

From your Travel dashboard, click **Fuel** in the navigation, or go directly to `/dashboard/travel/fuel`. This is your fuel log history — every fill-up you've ever logged, sorted by date, newest first.

At the top right, you'll see the **Log Fill-Up** button. Click it.

---

### The Fuel Log Form

The form has several fields. I'll go through each one and explain what it's asking for.

**Vehicle** — A dropdown of your vehicles. Select the one you just filled up. If you only have one vehicle, it'll be pre-selected.

**Date** — Defaults to today. If you're logging a fill-up from yesterday or last week, change it here.

**Odometer reading** — This is the number on your odometer *at the time of the fill-up*, not the miles since your last fill-up. For example, if your odometer reads 42,710 miles, enter 42,710.

This number is used to calculate how many miles you drove since your last fill-up, which is then divided by gallons to give you your MPG. So accuracy here matters.

**Gallons** — How many gallons you pumped. This is always on your receipt — look for the "Gallons" or "Volume" line.

**Price per gallon** — The pump price per gallon. Also on your receipt.

**Total cost** — The total dollar amount you paid. Most forms will auto-calculate this from gallons × price, but you can override it if the numbers don't match your receipt exactly.

**Trip A** (optional) — Some vehicles have a resettable trip odometer called Trip A. If you reset it at every fill-up, enter that reading here. Trip A represents the miles driven since your last fill-up — a slightly different way to measure distance than subtracting odometer readings.

**Trip B** (optional) — A second resettable trip odometer, often used to track miles over a longer period like a month. Enter it if you track it.

**Notes** (optional) — Free text. Useful for things like "topped off for road trip" or "E85 blend" or "used premium by mistake."

---

### Saving the Entry

Once you've filled in the required fields — Vehicle, Date, Odometer, Gallons — click **Save**.

The entry appears in your fuel log history immediately. You'll see the MPG calculated automatically based on this fill-up's odometer reading vs. your previous one.

On your first ever fuel log, MPG won't be shown — there's no previous data point to compare against. After your second log, you'll start seeing the calculation.

---

### Reading Your Fuel Log History

Each row in the fuel log shows:
- Date of fill-up
- Vehicle
- Odometer at fill-up
- Gallons and price per gallon
- Total cost
- **Calculated MPG** — the star of the show

Over time, a drop in MPG might signal it's time for an air filter or oil change. An unusually high cost per mile might mean it's worth evaluating whether you're driving more than you need to.

---

### A Note on Consistency

For MPG calculations to be accurate, log every fill-up — not just some of them. If you skip a fill-up, the system doesn't know the gap exists and will calculate a wildly incorrect MPG. Think of it like a habit: every pump → open the app, log the fill-up. The next lesson will make this even faster using receipt scanning.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/fuel — show empty fuel log or existing logs]

> [SCREEN: Click "Log Fill-Up" button — form opens]

> [SCREENSHOT: Full fuel log form with all fields labeled: Vehicle, Date, Odometer, Gallons, Price/gallon, Total, Trip A, Trip B, Notes]

> [SCREEN: Click the Vehicle dropdown — show vehicle options — select "Daily Driver"]

> [SCREEN: The date field — leave as today]

> [SCREEN: Click into Odometer field — type "42,710"]

> [SCREEN: Click into Gallons field — type "11.4"]

> [SCREEN: Click into Price per gallon — type "3.89"]

> [SCREEN: Show Total auto-populate to "$44.35" or similar]

> [SCREEN: Click into Trip A — type "341.2"]

> [SCREEN: Leave Trip B and Notes empty]

> [SCREEN: Click Save — entry appears in log list]

> [SCREENSHOT: Fuel log row showing the entry with calculated MPG highlighted in a callout]

> [SCREEN: Show the log list with 2+ entries so MPG is visible on the newer entry]

> [SCREEN: Hover over or click on a log entry to show detail/edit options]

---

## Key Takeaways

- Log fill-ups consistently for accurate MPG calculations — skipping one skews the math
- The odometer reading is the full odometer number, not miles since last fill-up
- Trip A and Trip B are optional resettable odometers — enter them if your vehicle has them
- MPG is auto-calculated once you have two data points
- The next lesson covers the OCR receipt scanner — a faster way to enter this same data
