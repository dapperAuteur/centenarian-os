# Lesson 03: Pomodoro Mode

**Course:** Mastering the Engine
**Module:** Focus Sessions
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Pomodoro is a time-boxing method: you work in focused intervals separated by short breaks. The original technique uses 25-minute work blocks and 5-minute breaks, but the principle — structured alternation between effort and rest — is what matters, not the specific numbers.

CentenarianOS's Pomodoro mode implements this natively. You set the work interval, the break interval, and how many cycles to run. The timer manages the transitions automatically.

---

### When to Use Pomodoro Mode

Pomodoro works best when:
- You're doing work where starting is the hardest part
- You need permission to take breaks without losing momentum
- You're prone to over-working without adequate recovery
- The task is long enough that a single 45 or 90-minute block feels overwhelming

Simple mode works best when:
- You're already in flow and don't want interruptions
- The work requires deep sustained concentration (writing, coding, complex analysis)
- Breaks would disrupt your state more than help

Many users alternate: Pomodoro for administrative or reactive work, Simple for deep creative or analytical sessions.

---

### Starting a Pomodoro Session

From the session setup panel, select **Pomodoro** as the mode.

Three additional fields appear:

**Work interval** — The length of each focused work block. Default: 25 minutes. Common alternatives: 50 minutes (for longer focus windows with a 10-min break), 90 minutes (ultradian rhythm-based), or 45 minutes.

**Break interval** — The length of each break. Default: 5 minutes. For longer work intervals, increase the break proportionally (10 minutes for a 50-minute block, 15–20 minutes for a 90-minute block).

**Cycles** — How many work/break pairs to run. A standard Pomodoro session is 4 cycles (4 × 25/5 = 2 hours of work, 20 minutes of breaks, 2h20m total). You can set 1–8 cycles.

After setting the cycle configuration, the rest of the form is the same: Activity, optional Milestone/Task link, Notes.

---

### Running a Pomodoro Session

Click **Start**.

**Work phase:** The timer counts down through the work interval. Your activity is shown. No break prompt until the interval ends.

**Break prompt:** When the work interval ends, a notification sounds (if enabled) and the break timer starts. A visual indicator shows you're in break mode. You can skip the break if you're in flow and want to keep working.

**Cycle counter:** The UI shows which cycle you're on (e.g., "Cycle 2 of 4") and how many work intervals remain.

**Auto-start** (configurable): If enabled, breaks start automatically after the work interval ends without requiring you to click anything. Same for the next work interval after a break. This keeps you from "accidentally" extending breaks by not clicking. If disabled, each phase requires a manual start.

**Session end:** When all cycles complete, the completion screen appears — same as Simple mode. You rate quality, add end notes, and save.

---

### The Long Break

After every 4th work interval in a standard Pomodoro, the traditional method calls for a longer break (15–30 minutes). CentenarianOS implements this: if you complete 4 cycles, the final break is automatically extended to 4× the regular break length.

You can configure whether the long break triggers (some users prefer consistent break lengths throughout).

---

### Pomodoro Analytics

Pomodoro sessions log additional data compared to Simple sessions:
- Number of cycles completed
- Work intervals started vs. completed (if you stopped mid-cycle)
- Breaks taken vs. skipped

The **Pomodoro tab** in Engine Analytics shows your Pomodoro-specific metrics: average cycles per session, completion rate, skip rate, and your most common interval configuration.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/engine — click "Start a Focus Session"]

> [SCREEN: Session setup — click "Pomodoro" mode]

> [SCREEN: Pomodoro-specific fields appear: Work interval, Break interval, Cycles]

> [SCREENSHOT: Pomodoro setup form — callouts: Work interval (25 min), Break interval (5 min), Cycles (4), plus existing fields: Activity, Milestone, Task, Notes]

> [SCREEN: Type "Clear inbox + reply to outstanding emails" in Activity]

> [SCREEN: Set work interval to 25, break interval to 5, cycles to 4]

> [SCREEN: Click Start — work phase timer begins]

> [SCREENSHOT: Running Pomodoro UI — callouts: Work phase timer, Cycle counter ("Cycle 1 of 4"), "Skip Break" button, pause/stop]

> [SCREEN: Fast-forward or speed through — show work interval ending → break starting → break ending → next work interval]

> [SCREENSHOT: Break phase UI — callouts: Break timer, "Skip" option, "Next cycle" indicator]

> [SCREEN: Stop mid-session — completion screen appears]

> [SCREENSHOT: Completion screen for Pomodoro — callouts: Cycles completed (e.g., 1 of 4), Quality rating, Notes]

> [SCREEN: Rate quality, add end note, save — return to dashboard]

> [SCREEN: End on the dashboard — end lesson]

---

## Key Takeaways

- Pomodoro mode alternates work intervals and break intervals for a set number of cycles
- Default: 25 min work / 5 min break / 4 cycles — fully configurable
- Auto-start option keeps transitions automatic so you don't extend breaks by not clicking
- After 4 cycles: extended long break (4× regular break length) — configurable
- Skip any break if you're in flow — the timer won't force you to stop
- Pomodoro analytics tab shows: cycles per session, completion rate, skip rate, most-used interval config
- Use Pomodoro for tasks where starting is hard or breaks help; use Simple for sustained deep work
