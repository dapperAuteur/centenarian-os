# Lesson 07: Importing Activities from Garmin

**Course:** Mastering Travel Tracking
**Module:** Trips & Activities
**Duration:** ~7 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

If you use a Garmin device, you're already tracking a lot of activity data — bike rides, runs, walks, hikes. The import feature in CentenarianOS lets you bring that data in and convert it into trips automatically.

Instead of manually logging every bike commute, you export a week's worth of activities from Garmin, upload the file here, and CentenarianOS does the rest.

This lesson walks you through the full process: exporting from Garmin, uploading here, and understanding what gets imported and what gets skipped.

---

### What Gets Imported

CentenarianOS imports four activity types from Garmin:

- **Cycling** — becomes a Bike trip
- **Walking** — becomes a Walk trip
- **Running** — becomes a Run trip
- **Hiking** — becomes a Hike trip

Everything else is intentionally skipped: Strength Training, HIIT, Yoga, Indoor Cycling, Swimming, and other gym-based activities. These don't involve travel or distance in a meaningful way, so they don't belong in the Travel module.

This is a deliberate design choice — the Travel module is about movement through the world, not exercise sessions.

---

### Step 1: Export Your Activities from Garmin Connect

Open Garmin Connect — either the mobile app or the website at connect.garmin.com.

**On the website:**
1. Go to **Activities** in the left sidebar
2. Find the activity you want to export, or use the bulk export option
3. For a single activity: click the activity → click the gear icon → **Export to GPX** or **Export Original**
4. For a bulk export: go to **Account Settings** → **Data Export** → **Export Your Data**

The bulk export option generates a ZIP file containing all your activity files. This can take a few minutes to generate and will arrive by email or be downloadable from the account settings page.

**What format to use:**
CentenarianOS accepts the standard Garmin export format. The bulk export ZIP works best for importing multiple activities at once.

**On the mobile app:**
The mobile app has a more limited export interface. For importing multiple activities, the website export is recommended.

---

### Step 2: Navigate to the Import Page

In CentenarianOS, go to `/dashboard/travel/import`.

You'll see the Garmin import interface: a file upload area and some information about supported formats.

---

### Step 3: Upload Your File

Click or drag your exported file into the upload zone. You can upload either:
- A single activity file
- The full Garmin export ZIP (recommended for bulk imports)

Click **Import Activities**. The system processes the file, identifies all supported activity types, and converts them to trips.

---

### Step 4: Review the Import Results

After processing, you'll see a summary of what was imported:

- **Activities imported** — the count of trips successfully created
- **Activities skipped** — the count of activities that were ignored (Strength, HIIT, etc.)
- **New trips** — a list of the individual trips just created

Each imported activity becomes a trip in your trip history with:
- Date from the activity timestamp
- Mode based on activity type (Cycling → Bike, Running → Run, etc.)
- Distance from the GPS track data
- Duration from the activity's elapsed time

---

### After Import: Checking Your Trips

Navigate to `/dashboard/travel/trips` to see the newly imported trips in your history. They'll show up mixed in with any manually logged trips, sorted by date.

You can edit any imported trip to add notes, a route name, or start/end locations that the GPS data didn't capture.

---

### Dealing with Duplicates

If you import the same Garmin export file twice, CentenarianOS checks for duplicate activities before inserting. Activities with the same date, type, distance, and duration won't be imported a second time.

If you're not sure whether an activity was already imported, check your trip history for that date before re-importing.

---

### Keeping Up With Imports

Most Garmin users find a weekly import cadence works well: every Sunday, export the past week's activities and import them. This keeps your trip history current without requiring daily manual logging.

You could also do a one-time bulk import for the entire year's Garmin history when you first set up the module, then switch to a weekly cadence going forward.

---

## Screen Recording Notes

> [SCREEN: Open a browser tab and navigate to connect.garmin.com — show the Activities page]

> [SCREENSHOT: Garmin Connect Activities page with the Export button/gear icon highlighted on a single activity]

> [SCREEN: Show the Account Settings → Data Export option on the Garmin website]

> [SCREENSHOT: Data Export page with "Export Your Data" button labeled — add callout: "This generates a ZIP of all activities"]

> [SCREEN: Switch back to CentenarianOS — navigate to /dashboard/travel/import]

> [SCREENSHOT: Import page with the upload zone highlighted and "Supported: Garmin export ZIP" labeled]

> [SCREEN: Drag a sample Garmin export ZIP into the upload zone — show it populating]

> [SCREEN: Click "Import Activities" — show processing spinner]

> [SCREEN: Import results summary appears — highlight "Activities imported: 12", "Activities skipped: 4 (Strength, HIIT)"]

> [SCREENSHOT: Results screen with callouts: "Imported" (green) vs. "Skipped" (gray) categories listed]

> [SCREEN: Click "View Trips" or navigate to /dashboard/travel/trips — show the newly imported trips in the list]

> [SCREENSHOT: Trip list with several imported trips, mode icons (bike, run, walk) visible — label "Imported from Garmin"]

> [SCREEN: Click on one imported trip — show the detail view, point out that GPS distance and duration were auto-populated]

> [SCREEN: Click Edit on that trip — show adding a route name and notes — save]

---

## Key Takeaways

- Garmin exports Cycling, Walking, Running, and Hiking activities — all become trips in CentenarianOS
- Strength Training, HIIT, Yoga, and indoor activities are intentionally skipped
- Use the bulk ZIP export from connect.garmin.com for importing multiple activities at once
- Duplicate detection prevents the same activity from being imported twice
- A weekly import cadence (every Sunday) keeps trip history current with minimal effort
