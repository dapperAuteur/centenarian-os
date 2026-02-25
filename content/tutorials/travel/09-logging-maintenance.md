# Lesson 09: Logging Vehicle Maintenance

**Course:** Mastering Travel Tracking
**Module:** Vehicle Maintenance
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Every vehicle needs maintenance. Oil changes, tire rotations, brake inspections, air filters, timing belts — over the life of a vehicle, you'll spend thousands of dollars on upkeep. The question is: do you have a record of it?

Most people don't. They rely on the windshield sticker from the last oil change, a vague memory of when the brakes were done, or whatever the shop told them last time.

CentenarianOS's maintenance tracker gives you a complete, searchable log of every service record for every vehicle you own. This lesson covers how to add a record.

---

### Navigating to Maintenance

Go to `/dashboard/travel/maintenance`. You'll see the maintenance history for your vehicles, grouped or sorted by date. At the top right, click **Log Maintenance**.

---

### The Maintenance Form

**Vehicle** — Select the vehicle this maintenance was performed on.

**Date** — When the service was done. Default is today; change it if you're logging something from last week.

**Service type** — A dropdown of common maintenance types:
- Oil Change
- Tire Rotation
- Air Filter
- Cabin Filter
- Spark Plugs
- Brake Inspection
- Brake Pads/Rotors
- Battery
- Transmission Service
- Coolant Flush
- Timing Belt / Chain
- Wiper Blades
- Other

If your service isn't on the list, select **Other** and describe it in the notes field.

**Mileage at service** — The odometer reading when this work was done. This is the most important field — it's what tells you when the next service is due.

For example, if you got an oil change at 42,000 miles and the shop recommends every 5,000 miles, your next oil change is at 47,000. When your odometer crosses that number (visible on your vehicle profile), you'll know you're due.

**Cost** — What you paid. Include parts and labor if it was at a shop.

**Shop / Performed by** — Where or who did the work. Examples: "Quick Lube on Main St", "Self — driveway", "Dealer service dept."

**Notes** — Any additional details. Brand of oil used, which tires were rotated, what the shop recommended for next time.

---

### Saving the Record

Fill in the required fields — Vehicle, Date, Service Type, and Mileage — then click **Save**. The record appears in your maintenance history.

---

### The Value of Detailed Notes

When you bring your vehicle to a new shop, they always ask: "When was the last time you changed the oil? When were the brakes done?" Most people guess. With CentenarianOS, you can pull up your phone and tell them exactly — date, mileage, shop, and what was done.

Good notes also help you notice patterns. If your air filter needs replacement every 12,000 miles but you're replacing it at 9,000, something is wrong — unusual dust exposure, or you're getting upsold at the shop.

---

### What About Service Reminders?

CentenarianOS doesn't send automatic maintenance reminders (no push notifications), but the maintenance history page makes it easy to see at a glance when something was last done. In the next lesson, we'll look at how to read the maintenance history and spot what's coming due.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/maintenance — show maintenance list (empty or with a few entries)]

> [SCREEN: Click "Log Maintenance" — form opens]

> [SCREENSHOT: Full maintenance form with all fields labeled: Vehicle, Date, Service Type, Mileage, Cost, Shop, Notes]

> [SCREEN: Click Vehicle dropdown — select the car]

> [SCREEN: Click Service Type dropdown — show the full list of options — select "Oil Change"]

> [SCREEN: Type "42,710" in the Mileage field]

> [SCREEN: Type "42.50" in the Cost field]

> [SCREEN: Type "Quick Lube — 5th Ave" in the Shop field]

> [SCREEN: Type "5W-30 synthetic, next due at 47,710 miles" in the Notes field]

> [SCREEN: Click Save — record appears in maintenance list]

> [SCREENSHOT: Maintenance list row showing the oil change entry with mileage highlighted in a callout]

> [SCREEN: Log a second entry — select "Tire Rotation", same vehicle, mileage 42,710, cost $25, notes "Full rotation, all 4 tires"]

> [SCREEN: Save — show both records in the list]

> [SCREENSHOT: Maintenance list with two entries, service type icons visible if applicable]

> [SCREEN: Click Edit on the oil change record — show pre-filled form — click Cancel]

---

## Key Takeaways

- Log every service with: Vehicle, Date, Service Type, and Mileage at service
- Mileage at service is the key field — it tells you when the next service is due
- Use the Notes field for shop recommendations, product details, and next-due mileage
- The maintenance log is your vehicle's history document — useful at trade-in and with new shops
- Service reminders are manual — check the history page to see what's coming due next
