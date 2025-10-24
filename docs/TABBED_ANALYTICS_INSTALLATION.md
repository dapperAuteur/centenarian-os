# Tabbed Analytics Installation Guide

## What You're Getting

✅ Migration 009 already run (tags, quality_rating, template_id columns)  
✅ 4-tab analytics dashboard (Overview, Trends, Pomodoro, Performance)  
✅ Quality rating prompt on every session stop  
✅ Professional Recharts visualizations  
✅ Tag-based insights + template performance  

---

## Files Provided

1. **app-dashboard-engine-analytics-page-tabbed.tsx** → Main analytics page with tabs
2. **OverviewTab.tsx** → Key metrics + goal progress + insights
3. **TrendsTab.tsx** → Charts (daily, weekly, time-of-day, day-of-week)
4. **PomodoroTab.tsx** → Pomodoro effectiveness metrics
5. **PerformanceTab.tsx** → Tags, templates, quality analysis
6. **QualityRatingModal.tsx** → Star rating modal
7. **focus-page-quality-update.txt** → Code to add to focus timer
8. **focusAnalytics.ts** → Analytics utility functions

---

## Installation Steps (20 minutes)

### Step 1: Add Analytics Utilities (2 min)

```bash
# Copy analytics utilities
cp focusAnalytics.ts lib/utils/focusAnalytics.ts
```

### Step 2: Create Components Directory (1 min)

```bash
# Create directory for tab components
mkdir -p app/dashboard/engine/analytics/components
```

### Step 3: Install Tab Components (5 min)

```bash
# Copy all tab components
cp OverviewTab.tsx app/dashboard/engine/analytics/components/
cp TrendsTab.tsx app/dashboard/engine/analytics/components/
cp PomodoroTab.tsx app/dashboard/engine/analytics/components/
cp PerformanceTab.tsx app/dashboard/engine/analytics/components/
```

### Step 4: Replace Analytics Page (2 min)

```bash
# BACKUP your existing analytics page first!
cp app/dashboard/engine/analytics/page.tsx app/dashboard/engine/analytics/page.tsx.backup

# Replace with new tabbed version
cp app-dashboard-engine-analytics-page-tabbed.tsx app/dashboard/engine/analytics/page.tsx
```

### Step 5: Add Quality Rating Modal (3 min)

```bash
# Create components/focus directory if it doesn't exist
mkdir -p components/focus

# Copy quality modal
cp QualityRatingModal.tsx components/focus/
```

### Step 6: Update Focus Timer (7 min)

**This is the most important step for quality ratings to work!**

Open `app/dashboard/engine/focus/page.tsx` and apply changes from `focus-page-quality-update.txt`:

1. **Import QualityRatingModal** (line ~10):
```typescript
import QualityRatingModal from '@/components/focus/QualityRatingModal';
```

2. **Add state variables** (line ~30, with other useState):
```typescript
const [showQualityModal, setShowQualityModal] = useState(false);
const [pendingSessionEnd, setPendingSessionEnd] = useState<{
  sessionId: string;
  elapsedSeconds: number;
  revenue: number;
  notes: string;
} | null>(null);
```

3. **Replace stopSession function** (~line 150):
```typescript
const stopSession = async () => {
  if (!currentSessionId) return;
  
  const revenueEarned = (elapsedSeconds / 3600) * hourlyRate;

  // Store session data and show quality modal
  setPendingSessionEnd({
    sessionId: currentSessionId,
    elapsedSeconds: elapsedSeconds,
    revenue: revenueEarned,
    notes: notes,
  });
  setShowQualityModal(true);
};
```

4. **Add handleQualityRating function** (after stopSession):
```typescript
const handleQualityRating = async (rating: number) => {
  if (!pendingSessionEnd) return;

  try {
    // If in Pomodoro mode and currently working, save the current work interval
    if (timerMode === 'pomodoro' && pomodoroPhase === 'work' && currentIntervalStart) {
      const newWorkInterval: WorkInterval = {
        start: currentIntervalStart,
        end: new Date().toISOString(),
        duration: currentPhaseSeconds,
      };
      const finalWorkIntervals = [...workIntervals, newWorkInterval];

      const netWorkDuration = calculateNetWorkDuration(finalWorkIntervals, breakIntervals);
      const revenueEarned = (netWorkDuration / 3600) * hourlyRate;

      await supabase
        .from('focus_sessions')
        .update({
          end_time: new Date().toISOString(),
          duration: pendingSessionEnd.elapsedSeconds,
          net_work_duration: netWorkDuration,
          revenue: revenueEarned,
          notes: pendingSessionEnd.notes || null,
          work_intervals: finalWorkIntervals,
          break_intervals: breakIntervals,
          quality_rating: rating,
        })
        .eq('id', pendingSessionEnd.sessionId);
    } else {
      // Simple mode
      await supabase
        .from('focus_sessions')
        .update({
          end_time: new Date().toISOString(),
          duration: pendingSessionEnd.elapsedSeconds,
          revenue: pendingSessionEnd.revenue,
          notes: pendingSessionEnd.notes || null,
          quality_rating: rating,
        })
        .eq('id', pendingSessionEnd.sessionId);
    }

    // Reset state
    setShowQualityModal(false);
    setPendingSessionEnd(null);
    setIsRunning(false);
    setCurrentSessionId(null);
    setElapsedSeconds(0);
    setNotes('');
    setTargetDuration(null);
    setPomodoroPhase('work');
    setCurrentPhaseSeconds(0);
    setCompletedIntervals(0);
    setWorkIntervals([]);
    setBreakIntervals([]);
    setCurrentIntervalStart(null);
    
    await loadData();
  } catch (error) {
    console.error('Failed to save quality rating:', error);
  }
};
```

5. **Add modal to JSX** (at the end, before closing `</div>`):
```typescript
{/* Quality Rating Modal */}
<QualityRatingModal
  isOpen={showQualityModal}
  onClose={() => {
    setShowQualityModal(false);
    setPendingSessionEnd(null);
  }}
  onSubmit={handleQualityRating}
/>
```

---

## Testing Checklist

### Test Analytics Page (5 min)

1. Visit `/dashboard/engine/analytics`
2. ✅ Should see 4 tabs: Overview, Trends, Pomodoro, Performance
3. ✅ Overview tab shows key metrics
4. ✅ Trends tab shows charts (if you have session data)
5. ✅ Pomodoro tab shows effectiveness (if you have Pomodoro sessions)
6. ✅ Performance tab shows tags/templates/quality

### Test Quality Rating (5 min)

1. Start a focus session
2. Wait 1-2 minutes
3. Click "Stop & Save"
4. ✅ Quality rating modal should appear
5. ✅ Click stars to rate (1-5)
6. ✅ Submit rating
7. ✅ Session should save with quality rating
8. ✅ Go to analytics → Performance tab → should see quality stats

---

## What Each Tab Shows

### 📊 Overview Tab
**For everyone**: Quick summary of how you're doing
- Total focus time, avg session length, revenue
- Today's goal progress + this week's goal progress
- Natural language insights
- Quick action buttons

### 📈 Trends Tab
**For pattern recognition**: Visualize when you work
- Daily focus time (bar chart)
- Weekly focus time (line chart)
- Time of day distribution (when you work best)
- Day of week distribution (weekday vs weekend)
- Revenue over time (if tracking billable hours)

### 🍅 Pomodoro Tab
**For technique effectiveness**: Does Pomodoro help?
- Total pomodoros completed
- Average work length vs break length
- Pomodoro vs regular sessions comparison
- Work/break balance visualization
- Optimization recommendations

### 🏆 Performance Tab
**For quality analysis**: What work produces best results?
- Work categories (tag breakdown with pie chart)
- Template performance table (usage + quality)
- Quality rating distribution (1-5 stars)
- Average quality score

---

## Troubleshooting

### "Cannot find module '@/lib/utils/focusAnalytics'"
- Ensure you copied `focusAnalytics.ts` to `lib/utils/`
- Restart your Next.js dev server

### "Cannot find module '@/components/focus/QualityRatingModal'"
- Ensure you copied `QualityRatingModal.tsx` to `components/focus/`
- Check file name spelling (case-sensitive)

### Tabs not showing
- Check browser console for errors
- Ensure all 4 tab components are in `app/dashboard/engine/analytics/components/`
- Verify imports at top of main analytics page

### Quality modal not appearing
- Check that you added ALL 5 changes to focus page
- Verify `showQualityModal` state exists
- Check `stopSession` function was replaced correctly
- Look for errors in browser console

### No data showing in charts
- Need at least 1 completed session (with `end_time` set)
- Pomodoro tab needs Pomodoro sessions specifically
- Performance tab needs sessions with tags, templates, or quality ratings

### Migration errors
- You already ran migration 009, so this shouldn't be an issue
- If you see column errors, verify migration ran: 
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'focus_sessions';
  ```
- Should see: `tags`, `quality_rating`, `template_id`

---

## Next Steps

After installation:

1. **Use focus timer for 7 days** with quality ratings
2. **Add tags to sessions** (edit existing sessions in Sessions page)
3. **Create templates** for common workflows
4. **Review analytics weekly** to spot patterns
5. **Optimize schedule** based on peak hours data

---

## Benefits Summary

### For 6th Graders
- See when you work best (morning person? night owl?)
- Track if taking breaks helps you focus
- Rate how well you did (like video game scores!)
- Colorful charts make data fun

### For Hiring Managers
- Resource allocation visibility (where time goes)
- Productivity pattern identification (capacity planning)
- Quality metrics (output assessment)
- Structured work vs unstructured work comparison
- Evidence for performance reviews

### For Vendors
- Billable hour tracking with quality data
- Template ROI (which workflows are most efficient)
- Client communication (quality ratings = confidence)
- Project forecasting (historical patterns)
- Portfolio evidence (consistent quality over time)

---

## Support

If you run into issues:
1. Check browser console for errors
2. Verify all files copied correctly
3. Ensure migration 009 ran successfully
4. Test with a fresh session (start → stop → rate quality)
