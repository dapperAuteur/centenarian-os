# Lesson 04: The Analytics Dashboard

**Course:** Mastering Correlations & Analytics
**Module:** Analytics
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Analytics page is a different kind of insight layer. Instead of asking "how do any two metrics relate statistically?", it asks "do the known health and productivity patterns show up in my data?" It also shows you module-level headline stats in one place.

---

### Navigating to Analytics

Navigate to `/dashboard/analytics`. The page has a time range selector (30, 60, or 90 days) and two sections below: Discovered Correlations and Module Stats.

---

### Time Range

The selector at the top controls both the correlation analysis and the module stats. **30 days** is the default. Switch to 60 or 90 for longer-trend analysis.

---

### Discovered Correlations Section

This section shows up to four behavioral correlations — pre-defined patterns that the system checks against your data. Unlike the Correlations page (which tests all metric pairs statistically), the Analytics engine checks four specific hypotheses:

---

#### 1. Green NCV Days → Energy

**What it checks:** On days when you logged Green-rated meals, was your energy rating higher than on non-green days?

**What it shows if found:** "Green NCV days average 4.2/5 energy vs. 3.6/5 on other days — a **+17% difference**."

**Confidence:** Based on how many green days you've logged. Requires ≥5 green days in the window.

---

#### 2. High Focus (3+ hours) → Task Completion

**What it checks:** On days when you logged 3+ hours of focused work in the Engine, was your task completion rate in the Planner higher?

**What it shows if found:** "Days with 3+ hours focused work show **34% higher task completion** (87% vs 65%)."

**Why it matters:** Validates whether your deep work is actually translating into plan execution, or whether focus sessions and task completion are disconnected.

---

#### 3. High Pain (4+/10) → Reduced Focus

**What it checks:** On days with pain intensity ≥4 logged in the Engine pain log, was your focused work output lower?

**What it shows if found:** "High pain days (4+) reduce focus capacity by **28%** (34 vs 47 minutes average)."

**Why it matters:** If this pattern shows up in your data, it quantifies the cognitive cost of unmanaged pain — a compelling argument for prioritizing corrective protocols.

---

#### 4. Restaurant Meals → Task Completion

**What it checks:** On days with restaurant meals logged, is your task completion rate different from days with only home-cooked meals?

**What it shows if found:** "Days without restaurant meals show **18% higher task completion** (82% vs 67%)."

**Why it matters:** One of the less intuitive findings. If this pattern appears in your data, it may reflect decision fatigue, post-meal energy dips, or scheduling patterns (restaurant days = busier days with more disruptions).

---

### Correlation Cards — What You See

Each discovered correlation displays as a card with:

- **Category badge** (top left) — color-coded: Nutrition (lime), Focus (sky), Pain (red), Completion (amber), Energy (fuchsia)
- **Confidence score** (top right) — percentage based on sample size:
  - 5–9 days: ~30% confidence
  - 10–14 days: ~50%
  - 15–19 days: ~70%
  - 20+ days: up to 95%
  - Color: green ≥70%, amber ≥50%, red <50%
- **Main insight text** — the specific numbers from your data
- **Sample Size and Impact** — at the bottom: how many days, and the % difference
- **Suggestion box** — one actionable recommendation based on the pattern's direction

A correlation card only appears if the pattern meets the minimum data threshold (≥5 qualifying days) and the effect size is >10–15% (a weak effect that could be noise isn't shown).

---

### Module Stats Cards

Four stat cards below the correlations show headline metrics across all modules for the selected time range:

**Planner Performance** (sky blue)
- Completion Rate — % of scheduled tasks completed
- Tasks Completed — total count
- Current Streak — consecutive days at 90%+ completion

**Fuel Quality** (lime green)
- Green Days % — days where all logged meals were Green NCV
- Total Meals — count of meals logged
- Weekly Cost — average weekly food spend

**Focus & Energy** (amber)
- Total Focus Hours — sum of all session minutes
- Avg Energy Rating — your Engine debrief average (x/5)
- Sessions/Day — average number of focus sessions per day

**Body Tracking** (red)
- Avg Pain Score — average intensity across all pain log entries
- Pain-Free Days % — days with pain ≤1/10
- Total Logged — combined body tracking entries

---

### Data Export

At the bottom of the Analytics page, a **Export JSON** button downloads a file containing all your correlation data and module stats for the current time range. The filename includes the date: `analytics-2026-02-25.json`.

Use this for: personal records, sharing with a coach or doctor, or importing into a spreadsheet for custom analysis.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/analytics — show the full page]

> [SCREENSHOT: Analytics page — callouts: Time range selector (30/60/90d), Discovered Correlations section header, Module Stats cards row]

> [SCREEN: Zoom into a correlation card — show all its elements]

> [SCREENSHOT: Single correlation card close-up — callouts: Category badge (colored), Confidence score (%), Main insight text (specific numbers), Sample Size, Impact %, Suggestion box]

> [SCREEN: Change time range from 30d to 90d — show how confidence scores change]

> [SCREENSHOT: Same correlation at 30d vs 90d — confidence increases with more data — callout: "More data = higher confidence"]

> [SCREEN: Scroll to module stats cards]

> [SCREENSHOT: Four module stat cards — callouts: Planner (completion rate, tasks, streak), Fuel (green days, meals, cost), Engine (focus hours, energy, sessions/day), Body (pain score, pain-free %, logged)]

> [SCREEN: Click Export JSON — show download]

> [SCREEN: End on the module stats section — end lesson]

---

## Key Takeaways

- Analytics checks 4 pre-defined behavioral hypotheses: Green meals→energy, High focus→completion, High pain→focus, Restaurant meals→completion
- Correlation cards show: category, confidence %, specific numbers from your data, sample size, impact %, and one suggestion
- Confidence scoring: 5 days = ~30%, 20+ days = up to 95% — only trust high-confidence findings
- Cards only appear when effect size is >10–15% — weak effects are filtered out
- Module stats give you a single-view summary of Planner, Fuel, Engine, and Body performance for the period
- Export JSON downloads all correlation and stats data for external use
