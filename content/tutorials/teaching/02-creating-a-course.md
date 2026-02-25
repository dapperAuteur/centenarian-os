# Lesson 02: Creating a Course

**Course:** Teaching on CentenarianOS
**Module:** Course Management
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Creating a course starts with a simple form — title, description, category, pricing, and navigation mode. This lesson walks through every field and the decisions you'll make before the course editor opens.

---

### Opening the New Course Form

Click **New Course** from either the Overview page or the Courses page. The form opens at `/dashboard/teaching/courses/new`.

---

### Course Title (Required)

The title is the only required field. Keep it specific and outcome-oriented — it's the first thing prospective students see.

Good examples:
- "Longevity Movement Fundamentals"
- "Mastering Sleep for Executive Performance"
- "The CentenarianOS Fuel Protocol"

The title can be edited after creation in the course editor.

---

### Description (Optional)

Four-line textarea. Describe what the course covers, who it's for, and what students will be able to do after completing it. This appears on the public course detail page.

You can leave this blank now and fill it in from the course editor later.

---

### Category (Optional)

A dropdown with predefined options:
- Fitness, Nutrition, Recovery, Longevity, Mental Health, Sleep, Mindset, Biomechanics, Other

Category helps students discover your course. Choose the one that most accurately describes the primary subject. If it spans multiple areas, pick the dominant one.

---

### Pricing — Three Options

**Free**
No enrollment fee. All lessons are accessible to any logged-in user who clicks Enroll. Use this for introductory content, demos, or courses you want to make widely available.

**One-time**
A single payment for lifetime access to the course. A price input field appears (enter just the number — no $ needed). Example: for a $49 course, type `49`.

**Subscription (monthly)**
Students pay a recurring monthly fee to maintain access. A price input field appears. Use this for evolving content you update regularly, or for cohort-based experiences.

Pricing can be changed after creation. If you change a paid course to free, existing enrolled students retain access.

---

### Learning Path Style — Linear vs. Adventure

This setting controls how students navigate through the lesson sequence.

**Linear**
Students work through lessons in the order you define, step by step. The standard experience. Use this when the lesson sequence builds progressively — each lesson assumes knowledge from prior ones.

**Adventure (CYOA)**
At the end of each lesson, the AI presents three path choices: the next lesson in sequence, a semantically related lesson, and a random unvisited lesson. Use this for modular content where lessons can stand alone or be consumed in non-linear order.

Note: After creating an Adventure course, you'll need to generate AI embeddings from the course editor before the CYOA crossroads work properly. That step is covered in Lesson 04.

---

### Creating the Course

Click **Create Course**. If the title is missing, an error message appears: "Course title is required."

On success, you're redirected to the course editor at `/dashboard/teaching/{username}/courses/{id}`. The course is created as a **Draft** — not visible to students yet.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching — click "New Course"]

> [SCREENSHOT: New course form — callouts: Title field (required), Description (optional), Category dropdown, Pricing buttons (Free/One-time/Subscription), Navigation style (Linear/Adventure)]

> [SCREEN: Select "One-time" pricing — show the price input field appearing]

> [SCREEN: Select "Adventure (CYOA)" — point out the description text]

> [SCREENSHOT: Pricing toggle (One-time selected, price field visible) — callout: "No $ prefix needed — just the number"]

> [SCREENSHOT: Navigation style (Adventure selected) — callout: "AI will recommend branching paths; generate embeddings from the editor after adding lessons"]

> [SCREEN: Fill in a title — click "Create Course" — redirect to course editor]

> [SCREEN: End on the course editor (empty) — end lesson]

---

## Key Takeaways

- Title is the only required field — all other fields can be filled in from the editor later
- Categories: Fitness, Nutrition, Recovery, Longevity, Mental Health, Sleep, Mindset, Biomechanics, Other
- Pricing: Free / One-time (single number entry) / Subscription monthly (recurring)
- Navigation: Linear (fixed sequence) vs. Adventure/CYOA (AI branching paths)
- Creating a course opens the course editor — course starts as a Draft
- Adventure courses require AI embedding generation (from the editor) before CYOA paths activate
