# Lesson 07: Understanding Your Metrics

**Course:** Mastering Health Metrics
**Module:** Interpretation
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Tracking numbers is only useful if you understand what they're telling you. This lesson covers what each metric actually means, what ranges to pay attention to, and how your metrics data connects to the rest of CentenarianOS — specifically the AI weekly review and the correlations engine.

---

### Resting Heart Rate

**What it is:** The number of times your heart beats per minute at complete rest, typically measured first thing in the morning.

**Healthy ranges:** For adults, 60–100 bpm is considered normal. Athletes often measure 40–60 bpm. Lower is generally better — it indicates a stronger, more efficient cardiovascular system.

**What changes in it mean:**
- Elevated RHR (5–10+ bpm above your personal baseline) on a given morning often indicates: poor sleep, illness onset, dehydration, high training load, alcohol, or elevated stress
- Sustained downward trend over weeks: improving cardiovascular fitness
- Sudden spike after a stable period: investigate what changed (new training load, illness, life stress)

**Key insight:** Track your personal baseline, not the population average. A 65 bpm morning that's normal for you is very different from a 65 bpm that's 8 bpm above your usual 57.

---

### Steps

**What it is:** Total steps taken throughout the day.

**Target ranges:** Research links 7,000–10,000+ daily steps with significantly lower all-cause mortality. The specific number matters less than avoiding the <3,000 "sedentary day" territory.

**What it measures:** Ambient movement and light activity. Steps are not a substitute for structured exercise — a 10,000-step day with no resistance training is still missing a critical longevity input — but consistent step counts indicate you're not sedentary by default.

---

### Sleep Hours

**What it is:** Total hours of sleep the previous night.

**Target ranges:** 7–9 hours is the consensus recommendation for adults. Below 6 hours chronically is associated with significant negative health outcomes. Above 9 hours regularly may indicate sleep quality issues or illness.

**What to watch:**
- Consistent under-7 hours: a recovery debt that accumulates. Energy ratings and HRV often reflect it within 2–3 days
- Short-term dips (travel, illness, deadline crunch): acceptable. The weekly review will flag them
- Compare sleep hours against sleep score (if tracked) — 8 hours of poor-quality sleep is not equivalent to 7 hours of high-quality sleep

---

### HRV

**What it is:** The millisecond variation between consecutive heartbeats. Higher variation = healthier autonomic nervous system response.

**Baseline vs. trends:** HRV is highly individual. A "good" HRV of 55 ms for one person might be low for another. Track your own baseline, not population averages. Most devices establish your personal baseline over 2–3 weeks.

**What changes in it mean:**
- HRV 10–20% below your baseline: your body is under stress. Could be overtraining, illness onset, poor sleep, or psychological stress
- Sustained HRV decline over multiple days: accumulating load; consider a recovery day or reduced training intensity
- Rising HRV trend over weeks: improving fitness and/or recovery quality

**Practical use:** Many athletes use morning HRV to decide training intensity for the day. Low HRV → easy session or rest. High HRV → harder session is safe.

---

### Sleep Score, Recovery Score, Stress Score

**Sleep Score:** Device-computed quality rating, typically 0–100. Most devices consider deep sleep proportion, REM sleep, sleep consistency, and disturbances. 85+ is high quality; below 70 warrants attention.

**Recovery Score (WHOOP Recovery %, Oura Readiness, Garmin Body Battery):** Daily readiness rating based on HRV, sleep, and other signals. Low recovery (below 33% on WHOOP, below 60 on Oura) suggests your body needs easier demands today — not a reason to skip training entirely, but a reason to reduce intensity.

**Stress Score:** Continuous autonomic stress load. Most useful for identifying high-stress days that don't feel subjectively stressful — and for confirming what you already know on obviously hard days.

---

### Body Composition

**Weight:** Daily fluctuations of 1–3 lbs are normal. Weekly averages are meaningful. Monthly trends are strategic. Use a 7-day rolling average when reading your weight data.

**Body Fat % and Muscle Mass:** These are the metrics that actually matter for longevity, not weight in isolation. Body recomposition — losing fat while maintaining or gaining muscle — may show no weight change but significant body fat and muscle mass change. Track all three together for a complete picture.

**Muscle Mass:** Prioritize this one. Sarcopenia (age-related muscle loss) accelerates after 40 if untrained. Tracking muscle mass over years tells you whether your training is working against the natural decline.

---

### How Metrics Feed the Weekly Review

The AI weekly review (accessible from `/dashboard/weekly-review`) pulls your health data alongside focus, nutrition, tasks, and travel. The **Energy & Recovery** section of your weekly review is built from this data:

- Average sleep hours for the week
- Average resting HR for the week vs. your historical baseline
- Average HRV for the week
- Any elevated pain entries from the Engine Pain Log
- Your daily energy ratings from the Engine debrief

Gemini writes a coaching summary based on these numbers. If your HRV averaged 12% below your baseline and your energy ratings were 2–3 all week, the review will name that pattern and suggest recovery as the priority focus for the coming week.

---

### The Correlations Dashboard

Once you have 30+ days of consistent data, the Correlations dashboard (`/dashboard/correlations`) becomes valuable. It automatically discovers statistical relationships in your data — for example:

- "Days with sleep score above 80 correlate with focus quality ratings above 4.0 (r=0.71)"
- "Resting HR above 65 correlates with task completion below 60% (r=-0.62)"
- "Days with HRV above your baseline correlate with nutrition NCV score above 3.5 (r=0.58)"

These aren't insights anyone told the system to look for — they emerge from your actual data. That's what makes them actionable.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/metrics — show a date with all core + some enrichment metrics logged]

> [SCREENSHOT: Logged metrics for a day — callouts pointing to each metric with a brief label of what it represents]

> [SCREEN: Navigate to the 7-day summary strip — discuss the averages]

> [SCREEN: Navigate to /dashboard/weekly-review — show the Energy & Recovery section]

> [SCREENSHOT: Weekly review Energy & Recovery section — callouts: Sleep average, RHR average, HRV average, Pain log reference, Energy rating average — all pulling from health metrics data]

> [SCREEN: Navigate to /dashboard/correlations — show one or two discovered correlations]

> [SCREENSHOT: Correlations dashboard with a scatter plot — callout: "Auto-discovered from 30+ days of data across modules"]

> [SCREEN: End on the correlations page — end lesson and the course]

---

## Key Takeaways

- Track your personal baselines, not population averages — deviations from your norm matter most
- RHR: elevated >5–10 bpm above baseline = stress/illness/overtraining signal
- HRV: 10–20% below baseline = load signal; use it to modulate training intensity
- Sleep: hours vs. quality (score) — both matter and complement each other
- Body composition: track weight, body fat %, and muscle mass together; weekly averages over daily numbers
- Health metrics feed the AI weekly review Energy & Recovery section directly
- After 30+ days, the Correlations dashboard surfaces cross-module patterns in your data
