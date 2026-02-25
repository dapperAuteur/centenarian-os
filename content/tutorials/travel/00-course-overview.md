# Course Overview: Mastering Travel Tracking

## Teacher Setup Checklist

Use this file as your reference when creating the course in the Teaching Dashboard.

### Course Settings
| Field | Value |
|-------|-------|
| **Title** | Mastering Travel Tracking |
| **Description** | Learn how to use CentenarianOS's Travel module to track fuel costs, trips, vehicle maintenance, and activity imports from Garmin. Every lesson is free — no account required to watch. |
| **Price type** | Free |
| **Navigation mode** | CYOA |
| **Category** | Tutorial |
| **Cover image** | Use a screenshot of the /dashboard/travel dashboard |
| **Tags** | tutorial, travel, vehicles, fuel, garmin |

### Module Structure
Create these modules (chapters) in this order:

1. **Getting Started** — 2 lessons (set as linear; these are the mandatory intro)
2. **Fuel Logs** — 3 lessons
3. **Trips & Activities** — 3 lessons
4. **Vehicle Maintenance** — 2 lessons

### Per-Lesson Settings
- Set **is_free_preview = true** on ALL lessons
- Lesson type: **text** (paste script body as text_content, or use video once recorded)
- After creating all lessons, run **Generate Embeddings** so the CYOA crossroads has semantic options

### CYOA Strategy
- Lessons 01 and 02 flow linearly into each other (Getting Started)
- After Lesson 02, the CYOA crossroads will offer the learner their first topic choice
- The semantic embeddings will naturally cluster:
  - Fuel Log lessons together (03, 04, 05)
  - Trip lessons together (06, 07, 08)
  - Maintenance lessons together (09, 10)
- This means learners who finish any one section will be suggested a related section next

### After Publishing
1. Test in incognito — all lessons should load without a 403
2. Complete Lesson 02 and verify the crossroads API returns 4 options
3. Share the course URL: /academy/[courseId]
