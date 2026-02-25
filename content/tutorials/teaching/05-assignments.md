# Lesson 05: Assignments

**Course:** Teaching on CentenarianOS
**Module:** Student Interaction
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Assignments let you give students structured exercises to complete and submit for your review. You can attach them to any course, ask students to fill in specific data fields, and provide individual graded feedback. This lesson covers creating assignments and the full grading workflow.

---

### Accessing Assignments

From the course editor, click the **Assignments** button (clipboard icon) in the top-right header. This opens the assignments page for that specific course at `/dashboard/teaching/{username}/courses/{id}/assignments`.

You can also navigate directly from the course editor header without leaving the editor.

---

### Creating an Assignment

Click **New Assignment** (+ icon). A creation form appears inline at the top of the page:

**Title** (required, marked with *) — the assignment name students will see. Be specific: "7-Day Sleep Log" or "Week 1 Reflection: Nutrition Goals."

**Instructions** (optional) — a three-line textarea. Write the full prompt here: what you want students to do, what to include in their submission, and any specific questions to answer. This is displayed prominently in the student assignment viewer.

**Due Date** (optional) — a date-and-time picker. If you set a due date, it's shown to students on the assignment card. The platform does not automatically lock submissions after the due date — it's informational.

Click **Create**. The assignment appears in the list.

---

### Reviewing Submissions

Click any assignment title to expand it. Inside, you'll see a list of all student submissions for that assignment.

Each submission shows:
- **Student name** — display name or username
- **Submitted at** — the date and time they clicked Submit
- **Grade badge** — **Ungraded** (amber) or the grade you assigned (green, with the grade text)
- **Submission content** — the student's written response in a gray box
- **Attached media** — if the student attached a file or URL, a "View attached media" link appears

---

### Grading a Submission

Click **Grade Submission** (for ungraded submissions) or **Edit Grade** (to revise existing feedback). A grade form expands below the submission:

**Grade** — a text field. Grades are free-form strings: "A", "Pass", "90/100", "Excellent", "Needs revision" — whatever format makes sense for your course.

**Feedback** — a textarea. Write your comments, corrections, suggestions, or encouragement. Students see this feedback in their assignment viewer.

Click **Save Grade** (check icon). The submission badge updates to green with your grade text. Your feedback is visible to the student immediately.

---

### Empty and Partial States

- **No assignments yet** — the page shows "No assignments yet. Create one to get started."
- **Assignment with no submissions** — the expanded assignment shows "No submissions yet."
- Assignments with submissions show the full list; you can grade them one at a time at your own pace.

---

### Updating or Deleting Assignments

Assignment titles and instructions are editable from the assignments list. There is no bulk-delete — assignments must be removed individually. Deleting an assignment also removes all student submissions for it.

---

## Screen Recording Notes

> [SCREEN: Open a course editor — click the Assignments button in the header]

> [SCREENSHOT: Assignments page — callouts: "New Assignment" button, empty assignment list]

> [SCREEN: Click "New Assignment" — fill in title, instructions, and a due date]

> [SCREENSHOT: Create assignment form — callouts: Title field (*required), Instructions textarea, Due date picker]

> [SCREEN: Click Create — assignment appears in list — click to expand it]

> [SCREENSHOT: Expanded assignment (no submissions yet) — callouts: "No submissions yet" message, assignment details visible]

> [SCREEN: Switch to a course with a submission — expand the assignment with submissions]

> [SCREENSHOT: Submission row — callouts: Student name, submit timestamp, Ungraded badge (amber), submission text, "Grade Submission" link]

> [SCREEN: Click "Grade Submission" — grade form expands]

> [SCREENSHOT: Grade form — callouts: Grade text input ("e.g. A, 90/100, Pass"), Feedback textarea, Save Grade button]

> [SCREEN: Type a grade and feedback — click Save Grade — badge updates to green with grade text]

> [SCREENSHOT: Graded submission — green "Graded" badge with grade text, feedback visible below]

> [SCREEN: End on the graded submission view — end lesson]

---

## Key Takeaways

- Access assignments from the course editor header (clipboard icon) or directly at /dashboard/teaching/{username}/courses/{id}/assignments
- Create form fields: Title (required), Instructions (optional), Due Date (optional — informational only, doesn't lock submissions)
- Click any assignment to expand and view all student submissions
- Each submission shows: student name, timestamp, grade badge (amber Ungraded or green with grade), submission text, attached media
- Grades are free-form text: "A", "Pass", "90/100", or any format you choose
- Feedback is immediately visible to the student after you save — no separate publish step
