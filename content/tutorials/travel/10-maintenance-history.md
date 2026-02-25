# Lesson 10: Maintenance History and What's Due Next

**Course:** Mastering Travel Tracking
**Module:** Vehicle Maintenance
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa (final lesson — crossroads will offer a recap or explore other modules)

---

## Narrator Script

You've been logging maintenance records. This final lesson shows you how to read your maintenance history and use it to stay ahead of what's coming due.

---

### Navigating to Maintenance History

Go to `/dashboard/travel/maintenance`. This is your full maintenance log — every service record you've entered, sorted by date (newest first by default).

---

### Reading the History List

Each row in the list shows:
- **Date** — When the service was performed
- **Vehicle** — Which vehicle
- **Service type** — Oil Change, Tire Rotation, etc.
- **Mileage** — Odometer at service
- **Cost** — What you paid
- **Shop** — Where the work was done

You can click any row to see the full details, including your notes.

---

### Filtering the History

At the top of the list, you'll find filters:

**Vehicle filter** — Show maintenance for only one vehicle. Essential if you have multiple.

**Service type filter** — Show only a specific type. Want to see all your oil changes and nothing else? Select Oil Change from the dropdown.

**Date range** — Filter to a specific period.

These filters help you answer questions like: "When was the last time I rotated these tires?" — filter to Tire Rotation, newest first, and the answer is the first entry.

---

### Tracking What's Due Next

CentenarianOS doesn't automatically calculate due dates (different vehicles have different service intervals based on manufacturer specs, driving conditions, and oil type). But here's a practical workflow for manual tracking:

**Step 1: Find the last service date and mileage**

Filter to the service type you're checking. Look at the most recent entry — note the mileage.

**Step 2: Add the service interval**

Use the standard intervals as a starting point:
- Oil Change: every 5,000–7,500 miles (synthetic oil) or 3,000 miles (conventional)
- Tire Rotation: every 5,000–7,500 miles
- Air Filter: every 12,000–15,000 miles
- Cabin Filter: every 12,000–15,000 miles
- Brake Inspection: every 10,000–15,000 miles
- Spark Plugs: every 30,000–100,000 miles (varies widely)

Your shop's recommendations (which you saved in the Notes field) take priority over these general numbers.

**Step 3: Compare to current odometer**

Check your vehicle profile on the Travel dashboard — it shows the current odometer reading (updated from your latest fuel log). If your current mileage is within 500 miles of the next service point, schedule it.

---

### The Full Vehicle Service View

Click on a specific vehicle from your Travel dashboard (or filter the maintenance history to one vehicle). You'll see all maintenance for that vehicle in chronological order — essentially the complete service history.

This view is useful when:
- Buying or selling a vehicle — print or export the history
- Taking the vehicle to a new shop — pull up the history on your phone
- Comparing service costs over time — is one vehicle getting more expensive to maintain?

---

### Editing and Deleting Records

Click **Edit** on any record to correct a date, cost, mileage, or note. Click **Delete** to remove a record that was logged in error.

There's no bulk delete — records are removed one at a time to prevent accidental data loss.

---

### You've Completed the Travel Module

Congratulations — you've covered the entire Travel module:

- Setting up vehicles
- Logging fuel fill-ups manually and via OCR
- Reading your MPG and cost trends
- Recording trips manually and importing from Garmin
- Understanding bike savings
- Logging maintenance and reviewing service history

The Travel module is a long-game tool. The more consistently you log data, the more useful it becomes. MPG trends that take six months to appear can reveal maintenance issues before they turn into expensive repairs. Bike savings that build up over a year become genuinely motivating.

Start logging, stay consistent, and let the data work for you.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/maintenance — show a populated list with 5+ entries across different service types]

> [SCREENSHOT: Maintenance list with all columns labeled: Date, Vehicle, Service Type, Mileage, Cost, Shop]

> [SCREEN: Click the Service Type filter dropdown — select "Oil Change" — list filters to only oil changes]

> [SCREENSHOT: Filtered list showing only oil change records, newest first — add callout: "Last oil change: 42,710 miles"]

> [SCREEN: Click the Vehicle filter — show filtering to a single vehicle when multiple exist]

> [SCREEN: Clear filters to show all maintenance again]

> [SCREEN: Click on one maintenance record — show the detail view with notes visible]

> [SCREEN: Navigate to /dashboard/travel — show the vehicle card with current odometer]

> [SCREENSHOT: Vehicle card with odometer highlighted, plus a side callout showing the math: "Last oil change: 42,710 → Next due: 47,710 → Current: 44,200 → 3,510 miles to go"]

> [SCREEN: Navigate back to /dashboard/travel/maintenance — click Edit on a record — update the Notes field — save]

> [SCREEN: Show the Delete option on a record — click Delete — show the confirmation dialog — click Cancel (don't actually delete)]

> [SCREEN: End on the full maintenance history list — pause on a well-populated list to show what consistent logging looks like]

> [SCREENSHOT: Full view of a populated maintenance history — label it "Your vehicle's complete service history"]

---

## Key Takeaways

- Filter by vehicle and service type to quickly find when something was last done
- Use the Notes field to record shop recommendations for next-due mileage
- Compare the most recent service mileage + interval against your current odometer to know what's due
- The maintenance history is your vehicle's service document — valuable at trade-in and with new shops
- Consistent logging over time is where the real value emerges
