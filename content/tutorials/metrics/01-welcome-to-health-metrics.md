# Lesson 01: Welcome to Health Metrics

**Course:** Mastering Health Metrics
**Module:** Introduction
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Longevity is a long game. The data you track today won't mean much in isolation — but a year from now, those daily logs become a dataset that shows you patterns most people never see. When your energy tanked in September, what was your sleep doing? When your focus was sharpest, what did your HRV look like? These questions are only answerable if you tracked the data.

The Health Metrics module is where that data lives.

---

### What Health Metrics Tracks

The module tracks up to 14 data points per day, organized into three tiers:

---

### Tier 1: Core Metrics

Always available — no unlock required. These are the baseline health signals most people can track without any special device:

- **Resting Heart Rate (bpm)** — Your resting HR on waking. One of the most sensitive daily indicators of recovery, stress, and illness. Most smartwatches log this automatically.
- **Steps** — Total steps for the day. A simple proxy for overall movement.
- **Sleep hours** — Hours of sleep the previous night (decimal format: 7.5 = 7 hours 30 minutes).
- **Activity minutes** — Minutes of moderate-to-vigorous activity logged for the day.

---

### Tier 2: Enrichment Metrics

Optional — each requires acknowledgment before logging. These are more advanced metrics that require a wearable or device capable of measuring them:

- **Sleep score** — Composite sleep quality score (0–100), typically from Oura, WHOOP, or Garmin
- **HRV (ms)** — Heart rate variability in milliseconds. A high-signal recovery and autonomic nervous system indicator
- **SpO2 (%)** — Blood oxygen saturation
- **Active calories** — Calories burned above resting metabolic rate
- **Stress score** — Device-computed stress level (0–100)
- **Recovery score** — Device-computed daily readiness (0–100)

---

### Tier 3: Body Composition

Locked by default — each metric requires an explicit acknowledgment before it can be logged. Body composition data is sensitive and optional:

- **Weight (lbs)**
- **Body fat (%)**
- **Muscle mass (lbs)**
- **BMI**

The unlock requirement for body composition metrics is intentional. These numbers can be triggering for some people. The system asks you to explicitly opt in before any body composition field appears in your log.

---

### The Daily Logging Workflow

Navigate to `/dashboard/metrics`. You'll see:

1. A **7-day summary strip** at the top — average values for your core metrics over the last 7 days
2. The **Core Metrics form** — four fields, always visible
3. The **Enrichment Metrics section** — shows unlocked metrics, with lock icons on metrics you haven't enabled
4. The **Body Composition section** — locked until acknowledged

Fill in the values you have for today, click **Save Today's Log**, and you're done. One entry per day — if you log again the same day, it updates the existing entry.

---

### Where This Data Goes

Everything you log in the Health Metrics module flows into:

- **The AI weekly review** — the Energy & Recovery section is built almost entirely from this data. Sleep hours, resting HR, HRV, and pain levels from the Engine all factor into Gemini's coaching summary.
- **The Correlations dashboard** — the correlation engine surfaces relationships between your health data and your focus, nutrition, and task completion data.
- **The Analytics dashboard** — shows your 7, 30, and 90-day averages alongside other module stats.

The more consistently you log, the more the system can tell you.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/metrics — show the full page]

> [SCREENSHOT: Health Metrics dashboard — callouts: 7-day summary strip at top, Core Metrics form (4 fields), Enrichment Metrics section (some locked), Body Composition section (locked)]

> [SCREEN: Hover over the 7-day summary strip — show the average values for RHR, Steps, Sleep, Activity]

> [SCREEN: Scroll down to show all three sections of the form]

> [SCREEN: End on the full metrics page — end lesson]

---

## Key Takeaways

- Three metric tiers: Core (always on), Enrichment (acknowledgment required), Body Composition (locked by default, explicit unlock)
- 14 total trackable metrics per day
- One log per day — saves/updates on each submit
- Data feeds directly into: AI weekly review (Energy & Recovery), Correlations dashboard, Analytics
- No wearable required — all metrics can be entered manually; wearables automate entry
