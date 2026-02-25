# Lesson 06: Students and Messages

**Course:** Teaching on CentenarianOS
**Module:** Student Interaction
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Students page gives you a roster of everyone enrolled across your courses. Messages is your private inbox for student conversations. This lesson covers both.

---

### The Students Page

Navigate to `/dashboard/teaching/students` from the sidebar.

**Header:** "Students" with a subtitle showing the total active enrollment count (e.g., "12 active enrollments").

**Search box:** Searches across student username, display name, email, and course title — all at once. Useful when you want to find everyone enrolled in a specific course (search the course name) or look up a specific student.

**Student table** — three columns:
1. **Student** — display name (or username if no display name) with `@username` shown below, and their email as a clickable link
2. **Course** — the course title they're enrolled in
3. **Enrolled** — the date they enrolled, formatted as a local date

Each row represents one enrollment. A student enrolled in three of your courses appears as three rows, one per course.

The table shows all active enrollments. Sorting and pagination are not currently available — the list is ordered by enrollment date.

---

### When the Students Page Is Empty

If you have no published courses or no enrollments yet, the page shows: "No students enrolled yet." With the search active but no matches: "No results match your search."

---

### The Messages Page

Navigate to `/dashboard/teaching/messages` from the sidebar.

**Layout:** Two columns — the conversation list on the left, the message thread on the right.

---

### Conversation List (Left Column)

Each conversation item shows:
- **Student avatar** (profile photo) or initials fallback
- **Student name** (truncated if long)
- **Unread count badge** — a fuchsia circle with a number, shown only when there are unread messages
- **Course title** — which course the conversation is from (in small gray text below the name)
- **Last message preview** — the first line of the most recent message

Click any conversation to open the thread.

Conversations are ordered by recency (most recent activity at the top). A fuchsia left border and background highlight the currently active conversation.

---

### Message Thread (Right Column)

Messages in the thread appear as chat bubbles:
- **Your messages** — fuchsia background, right-aligned
- **Student messages** — dark gray background, left-aligned
- Each bubble shows the message text and a timestamp

**Replying:**
Type your response in the input field at the bottom. Press **Enter** to send (Shift+Enter for a new line). Or click the **Send** button (arrow icon). The send button is disabled while the message is sending.

---

### Mobile Behavior

On mobile, the conversation list and thread take turns — you see one at a time. A **back arrow** in the thread header returns you to the conversation list.

---

### Unread Messages

Unread count badges on conversations indicate messages you haven't read yet. Opening a conversation clears the unread count for that thread. The total across all conversations is also reflected in the sidebar notification badge (if one exists).

---

### Empty Inbox

If no students have messaged you yet: "No messages yet. Students will message you from course pages."

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching/students — show the student table]

> [SCREENSHOT: Students page — callouts: Header with enrollment count, Search box, Table columns (Student, Course, Enrolled date)]

> [SCREEN: Type a course name in the search box — show filtered results]

> [SCREENSHOT: Filtered student list — callout: Only students from the searched course appear]

> [SCREEN: Navigate to /dashboard/teaching/messages — show the two-column layout]

> [SCREENSHOT: Messages page — callouts: Conversation list (left) with unread badge, Active conversation (fuchsia background), Thread area (right) with chat bubbles]

> [SCREEN: Click a conversation — show the thread]

> [SCREENSHOT: Message thread — callouts: Student message (gray, left), Teacher reply (fuchsia, right), Message input field, Send button]

> [SCREEN: Type a reply — press Enter — message appears in thread]

> [SCREEN: End on the message thread — end lesson]

---

## Key Takeaways

- Students page (/dashboard/teaching/students): full enrollment roster, searchable by student name, email, or course title
- Each table row = one enrollment; a student in 3 courses = 3 rows
- Messages page (/dashboard/teaching/messages): two-column layout — conversation list (left) with unread badges, thread (right) with chat bubbles
- Your messages: fuchsia (right); student messages: dark gray (left)
- Send with Enter or the Send button; Shift+Enter for newlines
- Unread count badges show in the conversation list; opening a thread clears the badge
