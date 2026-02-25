# Lesson 01: Welcome to Correlations & Analytics

**Course:** Mastering Correlations & Analytics
**Module:** Introduction
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

You've been logging data for weeks — health metrics, meals, focus sessions, tasks. Each module gives you useful information about its own domain. But the most powerful insights come from the spaces between modules. What happens to your focus when your sleep is poor? Does your task completion change on days you eat out? Does pain level affect your deep work output?

These cross-module patterns are exactly what Correlations and Analytics are designed to surface.

---

### Two Pages, Different Approaches

CentenarianOS has two separate insight pages. They approach the same goal — understanding your data — from different angles.

---

### The Correlations Page (`/dashboard/correlations`)

The Correlations page runs statistical analysis on your logged data and visualizes the results as scatter plots. Each chart shows the relationship between two specific metrics across all the days you've logged both.

For example: a scatter plot of "Sleep Hours vs. Energy Rating" puts a dot for every day you've logged both values — the dot's x-position represents sleep hours, the y-position represents energy. If the dots trend upward left-to-right, sleep and energy are positively correlated.

The math behind each chart is a **Pearson correlation coefficient** — a number between -1 and +1 that measures how strongly two metrics move together. The page shows this coefficient alongside the chart.

Above the charts, **AI Insights** from Gemini translate the strongest correlations into plain-language takeaways: "On days when you slept 7+ hours, your energy was 23% higher. Consider setting a consistent bedtime to maximize your alertness."

Six metric pairs are analyzed:
- Sleep Hours ↔ Energy Rating
- Daily Steps ↔ Energy Rating
- Pain Intensity ↔ Focus Minutes
- Green Meal % ↔ Energy Rating
- Sleep Hours ↔ Focus Minutes
- Resting HR ↔ Energy Rating

---

### The Analytics Page (`/dashboard/analytics`)

The Analytics page takes a different approach. Instead of scatter plots and raw statistics, it shows:

1. **Discovered Correlations** — four pre-defined behavioral patterns, checked against your data and reported if the pattern holds (with a confidence score based on sample size)
2. **Module stat cards** — headline numbers for Planner, Fuel, Engine, and Body tracking over a selected time range

The four behavioral correlations it checks:
- Green NCV days → higher energy
- High focus (3+ hours) → higher task completion
- High pain (4+/10) → reduced focus capacity
- Restaurant meals → lower task completion

These are hypothesis-based: the system asks "does this known pattern show up in your data?" If yes, it reports the finding with specifics ("Green NCV days average 4.2/5 energy vs. 3.6/5 on other days") and a suggestion.

---

### When to Use Each

**Use Correlations** when you want to explore the data mathematically — look at the scatter plots, check the coefficient strength, and see what Gemini says about the strongest relationships. Good for: understanding your personal patterns and validating or surprising your assumptions.

**Use Analytics** when you want a quick summary — "how did this period go across all modules?" and "are the well-known health patterns showing up in my data?" Good for: weekly or monthly review, getting a dashboard-level read on where you stand.

Many users check Analytics weekly and Correlations monthly.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/correlations — show the full page with scatter plots and AI insights]

> [SCREENSHOT: Correlations page — callouts: AI Insights section (3 plain-language insight cards), Metric Correlations section (scatter plot grid), Time range buttons (7d/30d/90d)]

> [SCREEN: Navigate to /dashboard/analytics — show the full page]

> [SCREENSHOT: Analytics page — callouts: Discovered Correlations section (correlation cards), four Module Stat cards (Planner/Fuel/Engine/Body), Time range selector, Export button]

> [SCREEN: End on the analytics page — end lesson]

---

## Key Takeaways

- Two insight pages with complementary approaches: Correlations (statistical) and Analytics (behavioral + summaries)
- Correlations: 6 metric pairs, scatter plots, Pearson coefficient, Gemini language insights
- Analytics: 4 pre-defined behavioral correlations + module stat cards for Planner, Fuel, Engine, Body
- Use Correlations for data exploration; use Analytics for periodic summaries
- Both require consistent logging across multiple modules — minimum 5–14 days before results appear
