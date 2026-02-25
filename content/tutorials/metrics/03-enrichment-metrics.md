# Lesson 03: Enrichment Metrics

**Course:** Mastering Health Metrics
**Module:** Advanced Tracking
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The core metrics give you the baseline. Enrichment metrics give you depth. HRV, SpO2, sleep score, recovery score — these are the signals that most wearables track automatically, and they tell you things resting HR and sleep hours alone can't.

This lesson covers what each enrichment metric means, when to care about it, and how to unlock it in your metrics log.

---

### What Enrichment Metrics Are

Enrichment metrics are six additional data points available in the Health Metrics module. They're not locked — they're just disabled by default because most people don't have access to all of them from day one. Each one requires a brief acknowledgment before it appears in your log form.

The six enrichment metrics:

---

### Sleep Score (0–100)

A composite quality score for your sleep from the previous night. This is different from sleep hours — it's a device-computed quality rating that accounts for sleep stages, consistency, and disturbances.

**Source:** Oura Ring, WHOOP, Garmin devices, Fitbit. Each device has its own algorithm and scale, but most score 0–100 with 85+ being high quality.

**Why it matters:** Eight hours of fragmented light sleep is very different from six hours of deep, unbroken sleep. Sleep hours tells you duration; sleep score tells you quality. Tracking both gives you a complete picture.

---

### HRV (Heart Rate Variability, in milliseconds)

The variation in time between consecutive heartbeats. Counterintuitively, more variation is better — high HRV indicates your nervous system is in a parasympathetic (recovery, calm) state. Low HRV indicates stress, fatigue, illness, or overtraining.

**Source:** Oura, WHOOP, Garmin, Apple Watch (overnight HRV average). Most devices report it in milliseconds (e.g., 55 ms).

**Why it matters:** HRV is one of the most sensitive early-warning signals in sports science. A significant HRV drop (10–20% below your baseline) on a given morning often indicates that your body is under stress before you consciously feel it. Tracking trends over weeks matters more than any single reading.

---

### SpO2 — Blood Oxygen Saturation (%)

The percentage of hemoglobin in your blood that's carrying oxygen. Normal range for healthy adults: 95–100%.

**Source:** Most Oura, Garmin, and Apple Watch models with blood oxygen monitoring.

**Why it matters:** For most users at sea level, SpO2 rarely deviates significantly. It's most useful for: detecting sleep apnea risk (regular overnight dips below 90%), monitoring at altitude, or tracking illness recovery.

---

### Active Calories

Calories burned above your resting metabolic rate. This is your output from movement and exercise — different from total daily calories burned (which includes your baseline metabolism).

**Source:** Any fitness tracker that monitors heart rate during activity.

**Why it matters:** Active calories give you a consistent measure of your physical output day to day, independent of body weight. Useful for tracking training volume across different activity types.

---

### Stress Score (0–100)

A device-computed measure of autonomic nervous system stress throughout the day. Low scores = calm. High scores = elevated stress load. Computed from HRV patterns, heart rate, and sometimes galvanic skin response.

**Source:** Garmin (Body Battery stress), some WHOOP metrics.

**Why it matters:** Stress score is useful for days when you feel fine subjectively but your body data says otherwise — or the reverse. It's a more continuous measure than single-point readings.

---

### Recovery Score (0–100)

A composite daily readiness score. "How ready is your body for today's demands?" High = ready to train hard. Low = prioritize recovery.

**Source:** WHOOP (Recovery %), Oura (Readiness Score), Garmin (Body Battery).

**Why it matters:** Recovery score tells you what you should do with today's effort. Consistent low recovery scores while maintaining training load is a sign of accumulated fatigue. The weekly review uses this data to recommend training adjustments.

---

### Unlocking an Enrichment Metric

In the Enrichment Metrics section on the metrics page, each metric you haven't unlocked shows with a lock icon and an **Unlock** button.

Click **Unlock** on any enrichment metric. A brief modal appears describing what the metric tracks and asking you to acknowledge that you have access to data for it (or understand you'll enter it manually). Click **Acknowledge & Unlock**. The metric field immediately appears in your daily log form.

You can unlock as many or as few enrichment metrics as you track. Only unlock the ones you actually have data for — a field you can't fill in adds friction without adding value.

---

### Logging Enrichment Metrics

Once unlocked, the enrichment metric fields appear in the form alongside your core metrics. Fill in the values you have for today and save with the rest of your log. The save covers everything in one button click.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/metrics — scroll to the Enrichment Metrics section]

> [SCREENSHOT: Enrichment Metrics section — some metrics locked (lock icon + Unlock button), some already unlocked — callouts: Lock icon, Unlock button, already-unlocked field example]

> [SCREEN: Click "Unlock" on the HRV metric]

> [SCREENSHOT: Unlock modal — callouts: Metric name, description, "Acknowledge & Unlock" button]

> [SCREEN: Click "Acknowledge & Unlock" — modal closes — HRV field appears in the form]

> [SCREENSHOT: HRV field now visible in form — callout: "Field appears immediately after unlock"]

> [SCREEN: Type "62" in the HRV field]

> [SCREEN: Unlock Sleep Score similarly — fill in "84"]

> [SCREEN: Click Save Today's Log — all fields save together]

> [SCREEN: Navigate to the analytics or 7-day summary — show HRV appearing in averages]

> [SCREEN: End on the metrics form with enrichment fields visible — end lesson]

---

## Key Takeaways

- Six enrichment metrics: Sleep Score, HRV (ms), SpO2 (%), Active Calories, Stress Score (0–100), Recovery Score (0–100)
- Each requires a one-time acknowledgment unlock before appearing in the log form
- Only unlock metrics you have data for — empty fields add friction without value
- HRV is the highest-signal metric: trends over weeks matter more than single readings
- Sleep Score and Sleep hours complement each other: duration vs. quality
- Recovery Score drives the training adjustment section of the AI weekly review
- All enrichment metrics save together with core metrics on a single "Save Today's Log" click
