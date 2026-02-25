# Lesson 08: Trip History and Bike Savings

**Course:** Mastering Travel Tracking
**Module:** Trips & Activities
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

You've logged some trips — either manually or via Garmin import. Now let's look at what all that trip data can tell you, with a special focus on one of the most interesting calculations in the module: bike savings.

---

### Navigating to Trip History

Go to `/dashboard/travel/trips`. Your trip history is sorted by date, newest first. Each row shows:
- Date
- Mode of transport (with an icon: car, bike, run, walk, hike)
- Route name (if you added one)
- Distance
- Duration (if logged)
- For bike trips: a savings amount

---

### Filtering Your Trips

At the top of the trip list, you'll find filter controls arranged in two rows of chips:

**Mode row** — Show only a specific type of trip. Click "Bike" to see all your bike trips, "Car" for car trips, and so on. Useful when you want to analyze just one mode.

**Tag row** — Additional filters for specific use cases:
- **Business** — Shows only trips tagged with the Business tax purpose. Great for pulling your IRS mileage log: filter to Business, set a date range for the tax year, and you have your deductible mileage.
- **Medical** — Same idea, for medical mileage deductions.
- **Fitness** — Shows only bike/walk/run trips that were marked as fitness activities (workouts), as opposed to commutes or errands. Useful for reviewing your training volume.

**Date range** — Filter to a specific period: last 7 days, last 30 days, this month, this year, or a custom range.

**Vehicle filter** — If you have multiple vehicles, filter to see trips associated with a specific one.

These filters work together — you can show only Bike trips tagged Fitness from the last 30 days, for example. A "Clear filters" link resets everything.

---

### Understanding the Bike Savings Calculation

Here's the idea behind bike savings: every mile you ride a bike as a trip substitute is a mile you didn't drive a car. CentenarianOS calculates what that drive would have cost you based on your actual fuel data.

**The formula:**

`savings = bike travel miles × car cost per mile`

Where `car cost per mile` is calculated as:

`car cost per mile = owned vehicle fuel spend ÷ owned vehicle car miles`

For example: if you spent $200 on gas over 1,000 car miles in your personal vehicle, your car costs you $0.20 per mile to fuel. Ride your bike 10 miles on a commute (marked Travel), and you saved $2.00 in fuel.

Two important qualifiers:

**Only "Travel" bike trips count.** If you marked a bike trip as Fitness (a workout), it's excluded from the savings calculation. A Saturday trail ride is exercise — it's not a substituted car trip. Only trips where you chose the bike over a car — commutes, errands, trips around town — count toward savings.

**Only your owned vehicles count.** If you log fuel for a rental car or a borrowed vehicle, that data is excluded from the cost-per-mile calculation. The savings comparison should reflect your personal cost of owning and fueling your car, not a one-off rental.

---

### Why This Number Is Useful

Most people dramatically underestimate how much they're saving by cycling. A $2 savings sounds small, but across a year of regular commuting:

- 3 bike commutes per week × 8 miles per commute = 24 bike miles per week
- 24 miles × $0.20/mile = $4.80 per week
- $4.80 × 52 weeks = **$249.60 saved per year in fuel alone**

And that's just the direct fuel cost. When you factor in reduced wear on tires, brakes, and engine, the real savings are higher.

CentenarianOS shows you this calculation per trip and in aggregate on your dashboard — so you can watch the number grow over time.

---

### The Trips Dashboard Summary

At the top of the trips page, summary cards show:

**Total car miles** — All logged car trips combined.
**Total bike miles** — All logged bike trips combined.
**Total bike savings** — Cumulative fuel savings from all bike trips.
**Trips this month** — Count of trips logged in the current calendar month.

These numbers update every time you log or import a new trip.

---

### Trip Detail View

Click any trip row to open the detail view. Here you'll see everything about that trip:
- Full start and end locations
- Route name and notes
- Duration and average speed (if duration was logged)
- Savings amount (for bike trips)
- The Garmin activity it was imported from (if applicable)

From the detail view, you can click **Edit** to update any field, or **Delete** to remove the trip.

---

### Looking for Patterns

A good habit: at the end of each month, filter to "this month" and review:
1. How many car trips vs. bike trips?
2. Is the ratio trending toward more bike and less car over time?
3. What's the cumulative bike savings this year?

For people who commute by bike even occasionally, this data is surprisingly motivating. Seeing "$312 saved this year" on screen has a way of making you reach for the bike helmet a bit more often.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/trips — show a populated trip list with mixed modes]

> [SCREENSHOT: Trip list with callouts labeling: Date column, Mode icon column, Distance column, Savings column (bike trips only)]

> [SCREEN: Click the "Bike" mode chip — show list filtering to only bike trips]

> [SCREEN: Click the "Fitness" tag chip — show list filtering to only fitness bike trips — note that none of these show a savings amount]

> [SCREENSHOT: Fitness-only filtered view — callout on orange Fitness badges, callout noting "no savings column for fitness trips"]

> [SCREEN: Clear the Fitness filter — click the "Business" tag chip — show only business-tagged trips]

> [SCREENSHOT: Business filter active — callout: "Use this view for your IRS mileage log"]

> [SCREEN: Click "Clear filters" to reset]

> [SCREEN: Click the date range selector — select "Last 30 days" — show filtered results]

> [SCREEN: Click back to "All" mode and "All time" date range]

> [SCREENSHOT: Summary cards at top — label each: Total Car Miles, Total Bike Miles, Total Bike Savings, Trips This Month]

> [SCREEN: Click on a bike trip row — show the detail view]

> [SCREENSHOT: Trip detail view with callout on the savings amount, explaining the formula: "Bike miles × car cost/mile"]

> [SCREEN: Click on a car trip row — show the detail view — note that savings is not shown for car trips]

> [SCREEN: Click Edit on a trip — show the pre-filled form — update the route name — save]

> [SCREEN: Filter to "This month", mode "Bike" — show the summary updating to reflect the filter]

> [SCREENSHOT: Filtered view showing only bike trips this month, with a running total of savings for the period]

---

## Key Takeaways

- Bike savings = **Travel** bike miles × (owned vehicle fuel spend ÷ owned vehicle car miles) — calculated from your real data
- Only trips marked **Travel** count toward savings — Fitness trips (workouts) are excluded so they don't inflate the number
- Only **owned vehicles** feed the cost-per-mile calculation — rental and borrowed vehicles are excluded
- Filter by mode chips (Bike, Car, etc.) or tag chips (**Business**, **Medical**, **Fitness**) to slice your data
- Business filter = your IRS mileage log — use it at tax time for your deduction
- Summary cards show total car miles, total bike miles, cumulative savings, and trips this month
- Click any trip row to view details, edit fields, or delete the entry
- Review monthly: track whether you're shifting toward more bike trips over time
