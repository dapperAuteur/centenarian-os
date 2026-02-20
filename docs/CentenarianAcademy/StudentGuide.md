# Centenarian Academy — Student Guide

## What Is Centenarian Academy?

Centenarian Academy is the learning platform inside CentenarianOS. Members can enroll in courses taught by longevity experts, health coaches, and community teachers. Courses include video lessons, text content, audio tracks, assignments, live sessions, and an optional Choose-Your-Own-Adventure (CYOA) learning path.

---

## 1. Discovering Courses

**Path:** `/academy`

The course catalog is publicly visible. You can:

- Browse all published courses in a card grid
- Filter by **category** (e.g., Nutrition, Movement, Mindset)
- Search by keyword in the search bar

Each course card shows:
- Cover image and title
- Instructor name
- Pricing (Free, one-time purchase, or subscription)
- Category tag

---

## 2. Enrolling in a Course

**Path:** `/academy/[courseId]`

Click any course card to open the course detail page. You will see:

- Course description and trailer (if provided)
- Instructor bio
- Complete curriculum (modules and lessons)
- Pricing and Enroll button

### Free Courses
Click **Enroll for Free** — you are immediately enrolled with no payment required.

### Paid Courses (One-Time Purchase)
Click **Enroll** → you are redirected to Stripe Checkout → complete payment → return to the course page, now enrolled.

### Paid Courses (Subscription)
Click **Subscribe** → Stripe Checkout subscription flow → you are billed monthly or annually and enrolled.

### Promo Codes
On the Stripe Checkout page, use any promo code your instructor provided in the discount field.

---

## 3. Starting a Lesson

After enrolling, the full curriculum unlocks on the course detail page.

- Click any lesson title to open it
- **Path:** `/academy/[courseId]/lessons/[lessonId]`

Lesson types:
- **Video** — embedded player, watch and scrub freely
- **Audio** — inline audio player
- **Text** — scrollable article with rich formatting
- **Slides** — embeddable slide deck

Free preview lessons are marked with a **Preview** badge and are accessible without enrolling.

### Marking Progress
A lesson is marked complete automatically when you reach the end of the video or scroll through a text/audio lesson. You can also click **Mark Complete** manually.

---

## 4. CYOA — Choose Your Own Adventure

Some courses have **CYOA mode** enabled by the instructor. After completing each lesson you will see the **Crossroads** screen instead of a simple next button.

The Crossroads offers up to 5 paths:

1. **Continue** — next lesson in the standard order
2. **Related: [Lesson Title]** — semantically similar content (powered by AI embeddings)
3. **Related: [Lesson Title]** — a second related option
4. **Surprise Me** — a random lesson in the course
5. **View Course Map** — see the full module structure and jump anywhere

This lets you follow your curiosity and build a personalized learning journey.

---

## 5. Tracking Your Progress

**Path:** `/academy/my-courses`

The **My Courses** page shows all of your enrollments:

- Cover image and title
- Instructor name and enrollment date
- Progress bar (lessons completed / total lessons)
- Percentage complete
- A **Start / Continue / Review** button that takes you straight back to where you left off

When a course reaches 100%, it is marked **Complete**.

---

## 6. Assignments

Some lessons include assignments. When an assignment exists, it appears:

- On the course detail page under the **Assignments** section (visible to enrolled students)
- Directly at `/academy/[courseId]/assignments/[assignmentId]`

### Submitting an Assignment

1. Read the assignment instructions at the top of the page
2. Type your response in the text area
3. Attach files if needed (images, video, audio, PDF, Word doc, Markdown, CSV, etc.) — up to 5 files
4. Choose **Save Draft** to save without submitting, or **Submit** to send to your instructor

### Draft vs. Submitted
- **Draft** — saved on the server, only you can see it, your instructor is not notified
- **Submitted** — sent to your instructor for review and grading

After submitting you can still **Update Submission** if you want to revise your work.

### Feedback Thread
Once you have saved a draft or submitted, a **Feedback Thread** appears below the assignment form. You can message your instructor directly here. Your instructor's responses appear in the thread.

### Grades
When your instructor grades your work, a **Grade** banner appears at the top of the assignment page showing:
- Your grade (e.g., "A", "85/100", "Excellent")
- Written feedback from your instructor

---

## 7. Live Sessions

**Path:** `/live`

CentenarianOS hosts live sessions for members. The Live page shows upcoming and active sessions. When a session is live, the **Join Live** button activates and opens the embedded video stream.

Per-course live sessions (if your instructor schedules them) will appear on the course detail page.

---

## 8. Messaging Your Instructor

Use the **Feedback Thread** on any assignment to communicate with your instructor about that specific piece of work.

For general course questions, use the course message feature on the course detail page (if enabled by your instructor).

---

## 9. Quick Navigation Reference

| Where to go | Path |
|---|---|
| Browse all courses | `/academy` |
| My enrolled courses | `/academy/my-courses` |
| Course detail + curriculum | `/academy/[courseId]` |
| Watch a lesson | `/academy/[courseId]/lessons/[lessonId]` |
| Submit an assignment | `/academy/[courseId]/assignments/[id]` |
| Live sessions | `/live` |

---

## 10. Troubleshooting

**I enrolled but the lesson is still locked.**
Refresh the page. If the issue persists, sign out and sign back in.

**My progress bar is not updating.**
Progress is saved server-side. Try reloading the My Courses page.

**I cannot upload my file.**
Supported formats: images (JPG, PNG, GIF, WEBP, SVG, HEIC), video (MP4, MOV, WEBM, AVI, MKV), audio (MP3, WAV, OGG, M4A, AAC, FLAC), documents (PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX). Maximum 5 files per submission.

**I lost my draft.**
Drafts are saved to the server when you click Save Draft. If you closed the page without saving, unsaved changes are lost.
