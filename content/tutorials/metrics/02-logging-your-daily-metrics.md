# Lesson 02: Logging Your Daily Metrics

**Course:** Mastering Health Metrics
**Module:** Daily Logging
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Logging your health metrics takes about 60 seconds once you have the habit. This lesson walks through the exact workflow — opening the page, filling in your numbers, and saving. We'll also cover the 7-day summary strip and what to do if you miss a day.

---

### Opening the Metrics Page

Navigate to `/dashboard/metrics`. The page loads with today's form — if you've already logged today, the form will be pre-filled with your existing values. If not, the fields will be empty.

---

### The 7-Day Summary Strip

At the top of the page, before the form, you'll see a row of stat cards showing your 7-day averages:

- **Avg RHR** — average resting heart rate over the last 7 days
- **Avg Steps** — average daily steps
- **Avg Sleep** — average sleep hours
- **Avg Activity** — average active minutes

These are baseline reference points. They update daily as you log. Over time, you use them to spot deviations — a resting HR that's 6 bpm above your 7-day average is a signal worth noting.

---

### Core Metrics Form

Below the summary strip, the Core Metrics form shows four fields:

**Resting HR (bpm)** — Enter your resting heart rate. If you have a smartwatch, this is typically available in the morning summary. If you're measuring manually, take your pulse for 60 seconds after waking before getting out of bed.

**Steps** — Total steps for today. Your phone's health app, Garmin, Apple Watch, or Fitbit all track this. Enter the end-of-day total.

**Sleep hours** — Hours of sleep last night. Enter as a decimal: 6 hours 45 minutes = 6.75. Round to the nearest quarter hour if you're estimating.

**Activity minutes** — Minutes of deliberate movement for today. This is not steps — it's time spent in moderate or vigorous physical activity (training, a brisk walk, a bike commute, yard work). Your training sessions from the Engine or Travel module can inform this number.

---

### Notes Field

At the bottom of the core form, there's an optional **Notes** field. Use it for anything relevant that the numbers don't capture: "Sick — sore throat, low energy", "First day back from travel", "Slept on the couch, poor sleep quality despite hours logged", "Deload week — intentionally lower activity." These notes show in your history and can help explain anomalous data later.

---

### Saving

Click **Save Today's Log**. A confirmation message appears. The 7-day summary strip updates to reflect today's entry.

If you need to correct a value after saving, just navigate back to the metrics page for that date (use the date selector at the top of the page), update the fields, and save again. The second save overwrites the first.

---

### Logging for a Past Date

The date selector at the top of the metrics page lets you navigate to any past date. If you missed logging yesterday, click the back arrow to go to yesterday's date, fill in your values from memory or your device, and save.

The most important thing is consistent data — a 3-day-old entry is better than no entry. Logging retroactively preserves the dataset.

---

### What to Do When You Don't Have All the Data

You don't need to fill in every field every day. Log what you have. The system handles missing fields gracefully — blank fields are stored as null and excluded from averages. A partial log is better than no log.

If you don't have a resting HR reading today, leave it blank. If you forgot your step count, leave it blank. The important thing is that the data you do have gets recorded.

---

### Building the Habit

Most users find the easiest workflow is:
1. Morning: log Resting HR (from waking, or from your device's overnight reading) and Sleep hours
2. Evening: log Steps, Activity minutes, and any Notes

Some prefer to do it all at once in the evening when the day is complete. Either is fine — what matters is that it gets done.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/metrics — page loads with empty form for today]

> [SCREENSHOT: Metrics page — callouts: 7-day summary strip (4 stat cards), Core Metrics form (4 input fields + notes), Save button]

> [SCREEN: Click the 7-day summary strip stat cards — show the average values displayed clearly]

> [SCREEN: Type "58" in Resting HR field]

> [SCREEN: Type "8742" in Steps field]

> [SCREEN: Type "7.5" in Sleep hours field]

> [SCREEN: Type "45" in Activity minutes field]

> [SCREEN: Type "Good energy day — trained in morning" in Notes]

> [SCREEN: Click "Save Today's Log" — confirmation message appears]

> [SCREENSHOT: After save — confirmation message visible, 7-day summary strip updated with new average]

> [SCREEN: Click the back arrow on the date selector — navigate to yesterday — show yesterday's empty form]

> [SCREEN: Fill in a couple of values for yesterday — save — navigate back to today]

> [SCREEN: End on today's logged metrics page — end lesson]

---

## Key Takeaways

- Core Metrics form: Resting HR, Steps, Sleep hours (decimal), Activity minutes, optional Notes
- 7-day summary strip shows rolling averages — updates immediately after each save
- Save overwrites — logging twice on the same date updates, doesn't duplicate
- Date selector at top lets you log past dates retroactively
- Leave fields blank if you don't have the data — nulls are excluded from averages
- Morning + evening is the natural split: HR/sleep in morning, steps/activity in evening
