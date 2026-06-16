# Centenarian Academy — Teacher Guide

## Becoming a Teacher

To publish courses on Centenarian Academy, you need a **Teacher account**. Teachers pay a monthly or annual platform subscription that is separate from a regular membership.

### Applying to Teach

1. From your dashboard, navigate to **Teaching** in the sidebar
2. If you do not yet have a teacher plan, you will be prompted to subscribe
3. Complete Stripe Checkout for the teacher subscription
4. Once payment is confirmed, your account is upgraded to `role: teacher`

### Stripe Connect Onboarding (Required for Paid Courses)

To receive payouts from student enrollments, you must connect a Stripe Express account:

1. Go to **Dashboard → Teaching → Payouts**
2. Click **Connect with Stripe**
3. Complete the Stripe Express onboarding (identity verification, bank details)
4. Once onboarded, payout status will show **Connected**

Platform fees are deducted automatically at checkout (default 15%, set by the platform admin). You receive the remainder.

Free courses do not require Stripe Connect.

---

## Creating a Course

**Path:** `/dashboard/teaching/courses/new`

### Basic Information

| Field | Description |
|---|---|
| Title | Public course name |
| Description | Shown on the course detail page |
| Category | Tag for filtering in the catalog |
| Cover Image | Upload a thumbnail (Cloudinary) |
| Price Type | Free, one-time purchase, or subscription |
| Price | Amount in USD (for paid courses) |
| Navigation Mode | Linear (standard) or CYOA (Choose Your Own Adventure) |

### Publishing

Courses start as **draft** (not visible to students). When ready, toggle **Published** on the course editor page.

Visibility options:
- **Public** — anyone (including non-members) can see the course detail page
- **Members Only** — only logged-in members can view
- **Scheduled** — goes live automatically at a date you set

---

## Building Your Curriculum

**Path:** `/dashboard/teaching/courses/[id]`

### Modules

Modules are top-level sections (e.g., "Week 1: Foundation", "Module 2: Nutrition").

1. Click **Add Module** in the curriculum panel
2. Enter the module title
3. Drag to reorder modules

### Lessons

Under each module, click **Add Lesson**:

| Field | Description |
|---|---|
| Title | Lesson name shown in the curriculum |
| Lesson Type | video, text, audio, or slides |
| Content | Upload file (Cloudinary) or paste embed URL |
| Lesson text | For text-type lessons — write in **Markdown** or **Rich text** (see below) |
| Duration | Approximate minutes (optional, shown to students) |
| Free Preview | Toggle on to let non-enrolled visitors view this lesson |
| Order | Drag to reorder within the module |

### Content Upload

- **Video/Audio** — drag or click to upload; Cloudinary transcodes automatically
- **Slides** — paste an embed code (Google Slides, Canva, etc.)
- **Text** — write the lesson body in the text editor (see below)

### Editing a text lesson's body

Text lessons have a body editor with a **Markdown / Rich text** toggle at the top:

- **Markdown** (default) — a plain text box that accepts Markdown (`## Heading`,
  `**bold**`, `- list`, `[link](url)`). A **live preview** beside it shows exactly how
  students will see it; use **Hide preview** to type full-width. Markdown is the recommended
  format — it is the cleanest to paste into, diff, and re-import.
- **Rich text** — a what-you-see-is-what-you-get editor (bold, italic, headings, lists,
  links, images, code). Use this if you prefer formatting buttons over Markdown syntax.

Switching **Markdown → Rich text** converts your content automatically. Switching back
**Rich text → Markdown** restores your last Markdown version and drops edits made in rich
mode, so pick one format per lesson and stick with it.

**To edit an existing lesson:** open the course, go to the **Curriculum** tab, click the
**pencil** on the lesson to expand it, edit the body, and click **Save**. Use blank lines
between paragraphs and `##` headings to keep long lessons readable — the student player adds
generous spacing around paragraphs, headings, and lists automatically.

---

## CYOA Courses

When **Navigation Mode = CYOA**, students see a Crossroads screen after each lesson instead of a simple Next button.

### Setting Up CYOA Paths

1. After adding all lessons, click **Generate AI Paths** on the course editor page
2. The system sends each lesson's content to Gemini for embedding
3. Semantic similarity paths are stored in the database
4. Students now get personalized "related lesson" options at each Crossroads

> CYOA courses work best with 10+ lessons spread across diverse but related topics.

---

## Assignments

**Path:** `/dashboard/teaching/courses/[id]/assignments`

### Creating an Assignment

1. Click **Assignments** on the course editor page header
2. Fill in:
   - **Title** — short name for the assignment
   - **Instructions** — detailed description, rubric, or prompts
   - **Due Date** — optional deadline
3. Click **Create Assignment**

Assignments are linked to the course (not individual lessons) and appear to all enrolled students on the course detail page.

### Grading Submissions

On the Assignments page, each assignment row shows the submission count. Click to expand:

- Each submission shows the student's name and submitted date
- Read the student's written response and any attached files
- Enter a **Grade** (free-form: "A", "85/100", or "Great work!")
- Enter **Feedback** (written response)
- Click **Save Grade**

Grades and feedback are immediately visible to the student on their assignment page.

### Feedback Thread

After grading, use the **Feedback Thread** section (visible from the student's assignment page or from the admin view) to continue a back-and-forth conversation with the student about their work.

---

## Sources and Claims (Verify Your Science)

If your course makes factual or health claims, back each one with a real, verified source.
Open the **Sources** tab from the course editor.

- **List a claim** that needs a source (the claim as written, and where it appears).
- **Add a source**: paste a DOI or a link. The citation fills in automatically (resolved
  against Crossref), with the APA reference and an open-access PDF link when one exists.
- **Confirm** the claim to add the source to the course's verified library, or **drop** the
  claim if no source holds up. A progress badge shows how many claims are sourced.

Why this matters: AI-drafted material often contains fabricated studies, mis-attributed
authors, and inflated statistics. Verifying sources is what lets a course say "every claim
is backed by research you can check." If you are vetting a course before agreeing to teach
it, the **Teacher Evidence Ledger** (in the course's `teacher/` materials) lists every cited
claim, the source's abstract, and the exact lesson it appears in. Full standard:
`CitationIntegrityGuide.md`.

---

## Promo Codes

**Path:** `/dashboard/teaching/promo-codes`

Create discount codes to share with students:

| Field | Description |
|---|---|
| Code | The string students enter at checkout (e.g., LAUNCH50) |
| Discount | Percentage off (e.g., 50 for 50% off) |
| Max Uses | Optional cap on how many times the code can be used |
| Expires At | Optional expiration date |

Codes are created as Stripe Coupons and applied automatically at Stripe Checkout.

---

## Live Sessions

**Path:** `/dashboard/teaching/live`

Schedule a live session for your course students:

1. Click **Schedule Session**
2. Fill in title, description, and scheduled date/time
3. Paste your embed code (Zoom, Google Meet, Mux, Viloud.tv, or any iframe-embeddable stream)
4. Toggle **Is Live** when the session goes live
5. Students enrolled in the associated course see the session on the course page

---

## Student Management

**Path:** `/dashboard/teaching/students`

View all students enrolled in your courses:

- Name, enrollment date, course enrolled
- Completion percentage
- Message inbox for course DMs

---

## Payouts & Revenue

**Path:** `/dashboard/teaching/payouts`

- View your Stripe Connect dashboard link
- See payout history once Stripe Connect is connected
- Platform fee is deducted before transfers (visible in your Stripe dashboard)

---

## Quick Reference

| Action | Path |
|---|---|
| Create a new course | `/dashboard/teaching/courses/new` |
| Edit course + curriculum | `/dashboard/teaching/courses/[id]` |
| Manage assignments | `/dashboard/teaching/courses/[id]/assignments` |
| View enrolled students | `/dashboard/teaching/students` |
| Connect Stripe for payouts | `/dashboard/teaching/payouts` |
| Create promo codes | `/dashboard/teaching/promo-codes` |
| Schedule live sessions | `/dashboard/teaching/live` |

---

## Tips for Great Courses

- **Start with a free preview lesson** — it lowers the barrier for potential students to see your teaching style
- **Use CYOA for exploratory topics** — nutrition, mindset, and lifestyle courses benefit from non-linear paths
- **Keep lesson videos under 15 minutes** — shorter lessons have higher completion rates
- **Write detailed assignment instructions** — students produce better work when expectations are clear
- **Respond to feedback threads within 48 hours** — timely responses improve student satisfaction and retention
