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

CentenarianOS imports these Garmin activity types as trips:

- **Cycling** and **Indoor Cycling** — become Bike trips
- **Walking** — becomes a Walk trip
- **Running** and **Treadmill Running** — become Run trips
- **Hiking** — becomes a Walk trip (purpose: leisure)

Everything else is intentionally skipped: Strength Training, HIIT, Yoga, Swimming, and other gym-based activities. They are counted as "not travel activities" in the check, so you can see they were read and left out.

This is a deliberate design choice — the Travel module is about movement through the world, not exercise sessions.

---

### Step 1: Export Your Activities from Garmin Connect

Open Garmin Connect on the website at connect.garmin.com.

1. Go to **Activities** → **All Activities**
2. Scroll down far enough to load the activities you want (the list loads more as you scroll)
3. Click **Export CSV** at the top of the list

You get a file named `Activities.csv`. That is the file this import reads. It does not read GPX, FIT or the full account-export ZIP.

**On the mobile app:**
The mobile app has no CSV export, so use the website.

---

### Step 2: Navigate to the Import Page

In CentenarianOS, go to `/dashboard/travel/import`.

The **Garmin Activities CSV** card has a file picker, a **Check file** button and an **Import** button.

---

### Step 3: Choose Your File and Check It

Click the file area and choose `Activities.csv`. Then click **Check file**. Nothing is saved yet. The "Before you import" panel counts every row of the file:

- **New** — activities that will become trips
- **Already imported** — activities you imported before. An activity is recognised by its start time, so it is skipped even if you renamed it in Garmin Connect or changed the trip's date since
- **Listed twice in the file** — Garmin can upload one recording twice; only one copy counts
- **Look like trips you logged** — a trip you entered yourself (by hand, from a template or another CSV) with the same type, and a distance within 5% (at least 0.1 mile) or a time within 5 minutes. A round trip is compared both ways (it is stored one way and counted twice), and a multi-stop trip's legs are added up. A trip you logged that day with no distance or time counts too, and so does a close one dated a day before or after: a template logged late in the evening could carry the next day's date. Open **Possible matches** to see each one and why it matched. They are skipped unless you tick **Import possible matches too** (for example, two separate walks that day)
- **Unreadable rows** — rows without a readable date
- **Not travel activities** — the skipped types above

---

### Step 4: Import

Click **Import** (it shows how many activities will be added). The green result repeats the counts for what was saved. If a single row could not be saved, it is listed by its line number and the rest are still imported.

Each imported activity becomes a trip in your trip history with:
- Date from the activity's start time
- Mode based on activity type (Cycling → Bike, Running → Run, etc.)
- Distance, duration and calories from the CSV
- The activity's title, average heart rate (and steps for walks) in the notes

---

### After Import: Checking Your Trips

Navigate to `/dashboard/travel/trips` to see the newly imported trips in your history. They'll show up mixed in with any manually logged trips, sorted by date.

You can edit any imported trip to add notes, a route name, or start/end locations that the CSV didn't include.

---

### Dealing with Duplicates

Importing the same file again — or a newer export that overlaps an older one — adds nothing twice: **Check file** shows those activities as already imported. You don't need to trim the export to "only the new ones".

Duplicates made before this check existed are not deleted automatically. They can be listed with a read-only report and cleaned up after review.

---

### Keeping Up With Imports

Most Garmin users find a weekly import cadence works well: every Sunday, export the past week's activities and import them. This keeps your trip history current without requiring daily manual logging.

You could also do a one-time bulk import for the entire year's Garmin history when you first set up the module, then switch to a weekly cadence going forward.

---

## Screen Recording Notes

> [SCREEN: Open a browser tab and navigate to connect.garmin.com — show Activities → All Activities]

> [SCREENSHOT: All Activities list with the Export CSV link highlighted]

> [SCREEN: Switch back to CentenarianOS — navigate to /dashboard/travel/import]

> [SCREEN: Choose Activities.csv — click Check file]

> [SCREENSHOT: Before you import — callouts: New, Already imported, Listed twice in the file, Look like trips you logged, Not travel activities]

> [SCREEN: Open Possible matches — show one walk that matches a walk logged by hand]

> [SCREEN: Click Import — the green result repeats the counts]

> [SCREEN: Click Check file again on the same file — everything shows as already imported]

> [SCREEN: Navigate to /dashboard/travel/trips — show the newly imported trips in the list]

> [SCREENSHOT: Trip list with several imported trips, mode icons (bike, run, walk) visible — label "Imported from Garmin"]

---

## Key Takeaways

- Export `Activities.csv` from Garmin Connect (Activities → All Activities → Export CSV) on the website
- Cycling, Indoor Cycling, Walking, Running, Treadmill Running and Hiking become trips; gym activities are skipped
- Check file before Import: new, already imported, listed twice, possible matches with trips you logged
- An activity is recognised by its start time, so renamed or re-exported activities are never imported twice
- Possible matches with trips you logged are skipped unless you include them
- A weekly import cadence (every Sunday) keeps trip history current with minimal effort
