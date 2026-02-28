# Course Overview: Mastering Equipment Tracking

## Teacher Setup Checklist

Use this file as your reference when creating the course in the Teaching Dashboard.

### Course Settings
| Field | Value |
|-------|-------|
| **Title** | Mastering Equipment Tracking |
| **Description** | Learn how to use CentenarianOS's Equipment module to catalog your gear, track purchase costs, monitor value over time, and link items to trips, workouts, and transactions. Every lesson is free — no account required to watch. |
| **Price type** | Free |
| **Navigation mode** | CYOA |
| **Category** | Tutorial |
| **Cover image** | Use a screenshot of the /dashboard/equipment hub page |
| **Tags** | tutorial, equipment, assets, valuations, inventory |

### Module Structure
Create these modules (chapters) in this order:

1. **Getting Started** — 2 lessons (set as linear; mandatory intro)
2. **Managing Equipment** — 2 lessons
3. **Valuations** — 1 lesson
4. **Connections** — 2 lessons

### Per-Lesson Settings
- Set **is_free_preview = true** on ALL lessons
- Lesson type: **text** (paste script body as text_content, or use video once recorded)
- After creating all lessons, run **Generate Embeddings** so the CYOA crossroads has semantic options

### CYOA Strategy
- Lessons 01 and 02 flow linearly (Getting Started)
- After Lesson 02, the CYOA crossroads will offer the first topic choice
- Semantic embeddings will naturally cluster:
  - Managing lessons together (03, 04)
  - Valuations lesson (05) near managing cluster
  - Connection lessons together (06, 07)

### Lessons in This Course

| # | Lesson | What You'll Learn |
|---|--------|-------------------|
| 01 | Welcome to Equipment Tracking | Module overview, hub dashboard, what each section does |
| 02 | Setting Up Categories | Default categories, creating custom categories, managing sort order |
| 03 | Adding Your First Item | The equipment form — every field, photos, condition, notes |
| 04 | Linking Purchase Transactions | Connecting equipment to existing financial transactions |
| 05 | Tracking Value Over Time | Adding valuations, the value chart, depreciation math |
| 06 | Cross-Module Activity Links | Linking equipment to trips, workouts, tasks, and more |
| 07 | The Equipment Summary Dashboard | Summary cards, category breakdown, ROI calculation |

### After Publishing
1. Test in incognito — all lessons should load without a 403
2. Complete Lesson 02 and verify the crossroads API returns 4 options
3. Share the course URL: /academy/[courseId]
