# Tabbed Analytics: Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Focus Analytics                    [7d] [30d] [90d] [All Time] │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────┬────────┬──────────┬─────────────┐                   │
│  │Overview│ Trends │ Pomodoro │ Performance │  ← Tab Navigation │
│  └────────┴────────┴──────────┴─────────────┘                   │
│                                                                   │
│  [Tab Content Area]                                              │
│                                                                   │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ 123 sessions│  45.2 hours │ 89 pomodoros│    $1,234   │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Tab 1: Overview
```
┌─ Key Metrics ─────────────────────────────────────────┐
│  ⏱️ Total: 45.2h    🎯 Avg: 27m    📈 Best: 2h 15m   │
│  💰 Revenue: $1,234                                   │
└───────────────────────────────────────────────────────┘

┌─ Goal Progress ───────────────────────────────────────┐
│  Today:     [████████░░] 80%  (240m / 300m)          │
│  This Week: [██████░░░░] 60%  (1800m / 3000m)        │
└───────────────────────────────────────────────────────┘

┌─ Insights ────────────────────────────────────────────┐
│  📊 You've completed 123 sessions, 45 hours total     │
│  ⏱️ Your avg session is 27m (good for focused tasks) │
│  🍅 89 sessions used Pomodoro (check Pomodoro tab!)  │
│  🎯 You're 80% toward today's goal. Keep going!       │
└───────────────────────────────────────────────────────┘
```

## Tab 2: Trends
```
┌─ Daily Focus Time ────────────────────────────────────┐
│      ▁▃▅▇█▇▅▃▁  (Bar Chart)                          │
│  Shows: Daily hours over time period                  │
└───────────────────────────────────────────────────────┘

┌─ Time of Day ─────────────────────────────────────────┐
│  6am ▁ 9am █ 12pm ▇ 3pm ▅ 6pm ▃ 9pm ▁  (Bar Chart)  │
│  💡 Peak hours: 9am-12pm (schedule important work!)   │
└───────────────────────────────────────────────────────┘

┌─ Day of Week ─────────────────────────────────────────┐
│  Mon █ Tue ▇ Wed ▅ Thu ▃ Fri ▁ Sat ░ Sun ░           │
│  📊 Weekday focus > weekend (good work/life balance)  │
└───────────────────────────────────────────────────────┘
```

## Tab 3: Pomodoro (Priority!)
```
┌─ Effectiveness ───────────────────────────────────────┐
│  🍅 89 Pomodoros  │  ⏱️ 25m work  │  ☕ 5m break     │
│  💰 $847 revenue  │  ⭐ 4.2/5 quality                 │
└───────────────────────────────────────────────────────┘

┌─ What This Means ─────────────────────────────────────┐
│  ✅ Your 25m work intervals are perfect!              │
│  ✅ 5m breaks give your brain time to recharge        │
│  💡 Keep this rhythm going - it's working well!       │
└───────────────────────────────────────────────────────┘

┌─ Pomodoro vs Regular ─────────────────────────────────┐
│  🍅 With breaks:    4.2 quality  │  $847 revenue     │
│  ⏱️ Without breaks: 3.8 quality  │  $387 revenue     │
│  Winner: Pomodoro! 11% higher quality + 2x revenue   │
└───────────────────────────────────────────────────────┘
```

## Tab 4: Performance
```
┌─ Work Categories ─────────────────────────────────────┐
│  #1 Coding       ████████████░░ 15h  ⭐4.5           │
│  #2 Meetings     ████████░░░░░░  8h  ⭐3.2           │
│  #3 Design       ██████░░░░░░░░  6h  ⭐4.8           │
│  📊 Coding has highest quality (focus here!)          │
└───────────────────────────────────────────────────────┘

┌─ Template Performance ────────────────────────────────┐
│  Template           Used    Time    Quality   Last    │
│  Deep Work         12×     18h     ⭐4.7      Today   │
│  Quick Tasks       45×     9h      ⭐3.9      Today   │
│  💡 "Deep Work" = highest quality (use more!)         │
└───────────────────────────────────────────────────────┘

┌─ Quality Ratings ─────────────────────────────────────┐
│           4.2 Average                                  │
│           ⭐⭐⭐⭐☆                                    │
│  ⭐⭐⭐⭐⭐  ████████░░  45%                           │
│  ⭐⭐⭐⭐    ██████░░░░  35%                           │
│  ⭐⭐⭐      ████░░░░░░  20%                           │
└───────────────────────────────────────────────────────┘
```

## Quality Rating Flow

```
User clicks "Stop & Save" on focus timer
         ↓
┌──────────────────────────────┐
│   How'd It Go? ⭐⭐⭐⭐⭐    │  ← Modal appears
│                               │
│   Rate this session:          │
│   [⭐] [⭐] [⭐] [⭐] [⭐]    │
│                               │
│   😊 Good                     │
│   Productive session          │
│                               │
│   [Skip]  [Submit]            │
└──────────────────────────────┘
         ↓
   Quality saved to database
         ↓
   Visible in Performance tab
```

## File Structure

```
app/dashboard/engine/analytics/
├── page.tsx (main tabbed page)
└── components/
    ├── OverviewTab.tsx
    ├── TrendsTab.tsx
    ├── PomodoroTab.tsx
    └── PerformanceTab.tsx

components/focus/
└── QualityRatingModal.tsx

lib/utils/
└── focusAnalytics.ts (query utilities)
```

## Key Features

✅ **Tab Navigation**: Click tabs to switch views  
✅ **Time Range Filter**: 7d/30d/90d/all at top right  
✅ **Quick Stats**: Always visible at bottom  
✅ **Quality Prompts**: Every session gets rated  
✅ **Portfolio Quality**: Professional Recharts  
✅ **Mobile Responsive**: Works on all devices  
✅ **6th Grade Explanations**: Blue boxes with tips  
✅ **Manager Insights**: Purple boxes with KPIs  
✅ **Vendor Metrics**: Business intelligence  

## Why This Design Wins

1. **Reduced Cognitive Load**: One thing at a time (tabs)
2. **Clear Mental Model**: Overview → Details → Optimization
3. **Progressive Disclosure**: Start simple, drill deeper
4. **Portfolio Showcase**: Shows React expertise + data viz
5. **User Choice**: Let users explore what matters to them
6. **Scalable**: Easy to add 5th tab later
