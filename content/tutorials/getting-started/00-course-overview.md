# Course Overview: Getting Started with CentenarianOS

## Teacher Setup Checklist

Use this file as your reference when creating the course in the Teaching Dashboard.

### Course Settings
| Field | Value |
|-------|-------|
| **Title** | Getting Started with CentenarianOS |
| **Description** | Your first stop on CentenarianOS — understand the platform, explore the pricing plans, try the demo, take a full dashboard tour, and learn where every module lives. Every lesson is free — no account required to watch. |
| **Price type** | Free |
| **Navigation mode** | CYOA |
| **Category** | Tutorial |
| **Cover image** | Use a screenshot of the /pricing page or the dashboard home |
| **Tags** | tutorial, getting-started, pricing, demo, onboarding |

### Module Structure
Create these modules (chapters) in this order:

1. **Welcome** — 2 lessons (set as linear; mandatory intro)
2. **Platform Tour** — 3 lessons

### Per-Lesson Settings
- Set **is_free_preview = true** on ALL lessons
- Lesson type: **text** (paste script body as text_content, or use video once recorded)
- After creating all lessons, run **Generate Embeddings** so the CYOA crossroads has semantic options

### CYOA Strategy
- Lessons 01 and 02 flow linearly (Welcome)
- After Lesson 02, the CYOA crossroads opens
- Semantic embeddings will cluster:
  - Demo + Dashboard Tour together (03, 04)
  - Module Map as a reference (05)

### Lessons in This Course

| # | Lesson | What You'll Learn |
|---|--------|-------------------|
| 01 | What Is CentenarianOS? | Platform overview, the 5 nav groups, philosophy |
| 02 | Understanding Pricing & Plans | Monthly vs Lifetime, what's included, free access, the signup flow |
| 03 | Exploring the Demo Account | One-click demo login, pre-loaded data, what to explore first |
| 04 | Your Dashboard Tour | Sidebar, top bar, module pages, settings, mobile layout |
| 05 | The Module Map | Every module, which nav group it's in, brief descriptions, and reference links |
| 06 | Interactive Walkthroughs | Module tours, feature pages, demo login, re-taking tours from Settings |

### After Publishing
1. Test in incognito — all lessons should load without a 403
2. Complete Lesson 02 and verify the crossroads API returns options
3. Share the course URL: /academy/[courseId]
