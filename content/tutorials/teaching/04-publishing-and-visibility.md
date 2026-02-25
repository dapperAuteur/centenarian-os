# Lesson 04: Publishing and Visibility

**Course:** Teaching on CentenarianOS
**Module:** Course Management
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

A course starts as a Draft and stays hidden from students until you publish it. This lesson covers the publish/unpublish flow, the three visibility modes, and — for Adventure courses — how to generate the AI embeddings that power CYOA navigation.

---

### Draft vs. Published

Every course starts as a **Draft**. Draft courses:
- Are visible in your teaching dashboard (Courses page)
- Are not listed in the student-facing Academy catalog
- Cannot be enrolled in by students

When you're ready to go live, publish the course.

---

### Publishing a Course

**From the Courses page:**
Each course card has a **Publish/Unpublish** toggle button (eye icon). Click it to toggle the status. Green = Published, gray = Draft.

**From the course editor:**
A **Publish** or **Unpublish** button sits in the top-right header of the editor. Clicking it toggles the status and updates the badge ("Published" → green, "Draft" → gray) immediately.

You can publish and unpublish as many times as you need. Unpublishing a course that has enrolled students doesn't remove their enrollments — they can still access the course from My Courses. It just removes the course from the catalog so new students can't find and enroll in it.

---

### Visibility Modes

Visibility is set in the course editor settings panel (separate from publish status):

**Public** (default)
Any logged-in user can see and enroll in the course from the Academy catalog.

**Members only**
Only users with an active subscription (Monthly or Lifetime) can see and enroll. Free-tier users browsing the catalog won't see the course. Use this for premium content aligned with your target audience's subscription level.

**Scheduled**
The course is hidden until a specific date and time. Set the date using the datetime picker that appears. At the scheduled moment, the course goes live automatically with Public or Members-only visibility (whichever you set alongside it).

> Scheduled is useful for cohort launches, announcement-tied releases, or building anticipation with a specific go-live date.

---

### Publish vs. Visibility: How They Work Together

These two settings are independent:
- A **Published + Public** course: visible to all logged-in users in the catalog
- A **Published + Members only** course: visible only to subscribers
- A **Published + Scheduled** course: hidden until the scheduled date, then goes live
- A **Draft** course: hidden regardless of visibility setting

Set your visibility before publishing.

---

### Generating AI Paths (Adventure/CYOA Courses Only)

For courses with **Adventure (CYOA)** navigation, the crossroads panel needs AI embeddings — vector representations of each lesson's content — to suggest semantically related lessons.

After adding your lessons to the curriculum, scroll to the **AI Adventure Paths** section in the course editor. Click **Generate AI Paths**.

The system sends each lesson's content to Gemini, generates a 768-dimension embedding for each one, and stores them in the `lesson_embeddings` table. The process takes a few seconds.

When complete, you'll see: **"Generated embeddings for X lessons."**

If you add or significantly edit lessons later, re-run Generate AI Paths to refresh the embeddings. The CYOA semantic path recommendations won't reflect new content until embeddings are regenerated.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching/courses — show a Draft course card]

> [SCREENSHOT: Course card in Draft state — callout: Gray publish toggle (eye icon), "Draft" status]

> [SCREEN: Click the publish toggle — card changes to Published (green)]

> [SCREENSHOT: Course card in Published state — callout: Green toggle, "Published" badge]

> [SCREEN: Open the course editor — show the Publish button in the header]

> [SCREENSHOT: Course editor header — callouts: Status badge (Published/Draft), Publish/Unpublish button (globe icon)]

> [SCREEN: Open the Visibility dropdown — show three options (Public, Members only, Scheduled)]

> [SCREENSHOT: Visibility setting — callout: Three options, datetime picker appearing when Scheduled is selected]

> [SCREEN: Scroll to "AI Adventure Paths" section (CYOA course)]

> [SCREENSHOT: AI Adventure Paths section — callout: "Generate AI Paths" button, result message after clicking]

> [SCREEN: Click "Generate AI Paths" — show loading state — show success message]

> [SCREEN: End on the published course editor — end lesson]

---

## Key Takeaways

- Courses start as Drafts — hidden from students until published
- Publish toggle: available on the Courses page card and in the course editor header
- Unpublishing doesn't remove existing student enrollments — they keep access; new students just can't find it
- Three visibility modes: Public (everyone), Members only (subscribers), Scheduled (auto-live at a set time)
- Publish status and Visibility are independent settings — set both correctly before going live
- Adventure/CYOA courses: click "Generate AI Paths" after adding lessons to power the semantic path recommendations; re-run after significant content edits
