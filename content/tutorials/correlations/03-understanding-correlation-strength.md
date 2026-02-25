# Lesson 03: Understanding Correlation Strength

**Course:** Mastering Correlations & Analytics
**Module:** Correlations
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The correlation coefficient is the most important number on the Correlations page. Understanding what it means — and what it doesn't mean — is the difference between acting on real insight and chasing statistical noise.

---

### What the Correlation Coefficient Means

The correlation coefficient (written as **r**) measures how consistently two metrics move together. It ranges from **-1 to +1**:

- **r = +1.0** — Perfect positive correlation. Every time Metric A goes up, Metric B goes up by a predictable amount. This never happens with real biological data.
- **r = +0.7 or higher** — Strong positive correlation. A clear, consistent relationship. When Metric A is higher, Metric B tends to be noticeably higher. Actionable.
- **r = +0.4 to +0.7** — Moderate positive correlation. A real relationship exists but other factors are also in play. Worth noting, but act with some caution.
- **r = +0.1 to +0.4** — Weak positive correlation. There may be a slight relationship, but it's not strong enough to base decisions on.
- **r ≈ 0** — No relationship. The two metrics appear to be independent.
- **r = -0.4 to -0.7** — Moderate negative correlation. When A goes up, B tends to go down.
- **r = -0.7 or lower** — Strong negative correlation. A clear inverse relationship. Expected for pairs like pain↔focus (more pain = less focused work) or RHR↔energy (higher RHR = lower energy).

The system uses these thresholds:
- **r ≥ 0.70** → "Strong" (green)
- **r ≥ 0.40** → "Moderate" (amber)
- **r < 0.40** → "Weak" (gray)

---

### Sample Size: Why It Matters

The coefficient alone doesn't tell you if the correlation is reliable. A **+0.80** from 6 data points is much less trustworthy than a **+0.65** from 45 data points. Small samples can produce dramatic-looking coefficients by chance.

The sample size is shown on every scatter plot card ("14 days", "31 days"). When interpreting:

- **< 10 days** — treat with significant skepticism. One unusual day can swing the coefficient dramatically.
- **10–20 days** — real signal starting to emerge, but still early.
- **20–30 days** — a month of data. Correlations at this level are meaningful.
- **30+ days** — reliable. Patterns you see at this sample size are likely real for your data.

A "Moderate" correlation at 45 days is worth acting on. A "Strong" correlation at 7 days may be noise.

---

### Correlation vs. Causation

This is the most important caveat to understand. A correlation tells you that two metrics move together. It doesn't tell you why.

Example: you might see a strong positive correlation between daily steps and energy rating. This could mean:
- More walking causes higher energy (movement → energy production)
- Higher energy causes more walking (energized people move more)
- A third factor causes both (good weather → more energy and more walking)
- All three simultaneously

The correlation page doesn't distinguish between these explanations. It reports the statistical relationship and the AI suggests interpretations based on likelihood, but only you can investigate the true mechanism.

The right response to a correlation isn't "I'll walk more and my energy will increase." The right response is "There's a pattern worth exploring — let me consciously vary my walking on days when energy feels low and see if the relationship holds."

---

### Correlations That Should Exist vs. Ones That Surprise You

Some correlations are expected from the research literature:
- Sleep hours positively correlating with energy — well established
- Pain negatively correlating with focus — intuitive
- Resting HR negatively correlating with energy — known

These aren't revelations, but seeing them in your own data is valuable confirmation that your data is being logged accurately and the system is working.

The more interesting correlations are the ones that surprise you or that don't match the expected direction. A negative correlation between steps and energy (more walking → lower energy) might indicate overtraining. A very weak sleep↔energy correlation might suggest sleep quality (rather than duration) is the real variable — check your sleep score data.

---

### What to Do with a Strong Correlation

1. **Check the sample size** — is it ≥ 20 days?
2. **Read the AI insight** — does the interpretation match what you'd expect?
3. **Look at the scatter plot visually** — are there obvious outlier points pulling the coefficient in one direction?
4. **Test it deliberately** — change one variable intentionally for 2–3 weeks and track the other
5. **Update your protocol** — if the correlation holds under intentional testing, build it into your health behavior

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/correlations — show a scatter plot with a strong positive correlation]

> [SCREENSHOT: Strong correlation chart — callouts: r coefficient (green, ≥0.70), strength label "Strong", sample size "28 days", dots trending upward clearly]

> [SCREEN: Compare with a weak correlation scatter plot]

> [SCREENSHOT: Weak correlation chart — callouts: r coefficient (gray, <0.40), dots scattered randomly with no clear trend, "Weak" label]

> [SCREEN: Point to the sample size on both charts — discuss why sample size matters]

> [SCREENSHOT: Two charts side by side showing same r value but different sample sizes — callout: "Same coefficient, very different reliability based on sample size"]

> [SCREEN: Show a negative correlation (e.g., pain vs focus)]

> [SCREENSHOT: Negative correlation chart — callouts: Negative r value, dots trending down-right, "This is expected — more pain → less focus"]

> [SCREEN: End on the correlations page — end lesson]

---

## Key Takeaways

- r ranges from -1 to +1: Strong (≥0.70, green), Moderate (≥0.40, amber), Weak (<0.40, gray)
- Sample size is critical: <10 days = treat as noise; 30+ days = reliable signal
- Correlation ≠ causation — the page shows what moves together, not why
- Expected correlations (sleep↔energy) confirm your data quality; unexpected ones are discoveries
- Strong correlation → check sample size → read AI insight → test deliberately → update protocol if it holds
