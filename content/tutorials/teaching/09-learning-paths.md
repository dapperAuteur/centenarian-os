# Lesson 09: Learning Paths

**Course:** Teaching on CentenarianOS
**Module:** Course Management
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Learning Paths let you group multiple courses into a curated sequence — giving students a clear progression from start to finish. You can build paths manually or let the AI suggest them based on your existing courses. This lesson covers both.

---

### What Are Learning Paths?

A learning path is a named, ordered sequence of your courses. Students can enroll in a path and the platform tracks their progress across all courses in it. Use paths to:
- Create structured curricula (e.g., "Foundations of Longevity — take these 4 courses in order")
- Group thematically related courses that work well together
- Give students a clear sense of "where to go next" after completing one course

---

### Navigating to Learning Paths

Click **Overview** in the teaching sidebar, then **Learning Paths** from the Quick Links. Or navigate directly to `/dashboard/teaching/learning-paths`.

---

### Creating a Path Manually

Click **New Path** (fuchsia, + icon). A form opens:

**Path Title** (required) — the name students will see. Example: "Foundations of Health Metrics" or "Executive Performance Protocol."

**Description** (optional) — a textarea to explain what students will achieve by completing all courses in the path.

Click **Create & Add Courses**. This creates the path and opens the path editor where you'll add courses to it.

---

### The Path Editor

The editor at `/dashboard/teaching/learning-paths/{id}` has two sections:

**Details** — title and description, editable inline. A **Save** button in the header records your changes (shows "Saved!" briefly after clicking).

**Courses in This Path** — the ordered list of courses currently in the path. Each course row shows:
- Drag handle and up/down arrows for reordering
- A position badge (1, 2, 3...)
- Course title and category
- **Required / Optional toggle** — click to toggle whether this course is required for path completion. Required courses must be finished for the path to count as complete; optional ones contribute to progress but aren't mandatory.
- Delete button (removes the course from the path, not from your catalog)

**Add Courses** — a grid of your published courses not yet in the path. Click any card to add it to the bottom of the sequence.

**Publish/Unpublish toggle** (header) — the same as individual courses. A Draft path is not visible in the student-facing paths catalog; a Published path is.

---

### Reordering Courses in a Path

Use the up/down arrows to move courses earlier or later in the sequence. The position badge updates immediately. You can also drag using the grip handle.

Order matters — students see the sequence and are guided to start with Course 1. Required courses block path completion if not finished; optional courses appear as supplementary.

---

### AI Path Suggestions

Click **Suggest Paths (AI)** (Sparkles icon) on the Learning Paths page. The AI analyzes your published courses and generates suggested path groupings based on content similarity and logical progression.

Each suggestion appears as a card:
- Suggested path title
- Description
- Ordered list of your courses with numbered badges (1, 2, 3...)
- **Accept & Create** button — creates the path with these courses in this order
- **Dismiss** button — removes the suggestion if it's not useful

You can edit accepted paths in the path editor just like manually created ones.

If no useful suggestions appear, dismiss them all and build paths manually. The AI works best when you have at least 3–5 courses with meaningful, different content.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching/learning-paths — show the page]

> [SCREENSHOT: Learning Paths page — callouts: "Suggest Paths (AI)" button, "New Path" button, empty paths section or existing paths]

> [SCREEN: Click "New Path" — fill in title and description — click "Create & Add Courses"]

> [SCREENSHOT: New path form — callouts: Title (required *), Description (optional textarea)]

> [SCREEN: Path editor opens — show the Add Courses grid (your courses listed)]

> [SCREENSHOT: Path editor, empty path — callouts: "Courses in This Path" (empty), Add Courses grid (course cards with + icons)]

> [SCREEN: Click two course cards to add them — show them appear in the sequence]

> [SCREENSHOT: Path with two courses — callouts: Position badges (1, 2), up/down arrows, Required/Optional toggle, Delete button]

> [SCREEN: Toggle the second course from Required to Optional — show badge change]

> [SCREEN: Click Save — show "Saved!" feedback — publish the path]

> [SCREEN: Navigate back to /dashboard/teaching/learning-paths — click "Suggest Paths (AI)"]

> [SCREENSHOT: AI suggestions — callouts: Suggested title, course list with numbered badges, "Accept & Create" and "Dismiss" buttons]

> [SCREEN: Click "Accept & Create" on a suggestion — path is created — appears in your list]

> [SCREEN: End on the paths list — end lesson and end course]

---

## Key Takeaways

- Learning paths group multiple courses into a named, ordered sequence for students
- Create manually: New Path → title + description → path editor → add courses from your published catalog
- Each course in a path can be Required (must complete for path completion) or Optional (supplementary)
- Reorder courses with up/down arrows or drag handles; position badges reflect current order
- AI Suggest Paths: analyzes your courses and generates grouping suggestions — Accept & Create to add them; Dismiss to skip
- Publish the path to make it visible in the student-facing paths catalog
