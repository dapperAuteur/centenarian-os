# Lesson 03: Building Your Curriculum

**Course:** Teaching on CentenarianOS
**Module:** Course Management
**Duration:** ~7 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The course editor is where you build the actual content. Courses are organized as Modules containing Lessons. This lesson covers the full curriculum builder — adding modules, adding lessons, editing content, uploading a cover image, and reordering everything.

---

### Opening the Course Editor

After creating a course, you land in the course editor automatically. You can return to it any time from the Courses page by clicking the **Edit** (pencil) icon on any course card.

The editor lives at `/dashboard/teaching/{username}/courses/{id}`.

---

### Course Settings Panel

At the top of the editor, a settings panel lets you update every course-level detail without going back to the creation form:

**Cover Image** — drag and drop or click to upload. Images are stored in Cloudinary. Click the X on an uploaded image to remove it.

**Title** — click to edit inline. Changes save when you click away (on blur). No save button needed.

**Description** — textarea, saves on blur.

**Category** — text input (free-form, or match the predefined list from creation).

**Price Type** — dropdown: Free, One-time, Subscription. A price input appears when you select One-time or Subscription.

**Navigation Mode** — Linear or Adventure toggle. Changing this after lessons exist doesn't delete anything, but if switching to Adventure, generate embeddings afterward.

**Visibility** — three options:
- **Public** — visible to any logged-in user
- **Members only** — visible only to users with an active subscription
- **Scheduled** — hidden until a specific date/time you set

When you select Scheduled, a date-and-time picker appears. The course goes live automatically at that moment.

> "Changes are saved automatically on blur." — a reminder shown in the settings panel.

---

### The Curriculum Builder

Below the settings panel, the **Curriculum** section is where you build your lessons.

**Structure:** Courses → Modules → Lessons

Modules are like chapters — grouping containers for related lessons. Lessons are individual content units inside a module.

---

### Adding a Module

Click **Add Module** (+ icon). A text field appears: type the module title and click **Add**. The module appears in the curriculum list.

Module titles are editable anytime — click the pencil icon on a module header.

**Reordering modules:** Use the up/down arrow buttons on the module header to move it earlier or later in the course. A drag handle (grip icon) is also available.

**Deleting a module:** Click the trash icon. This also deletes all lessons inside it — there is no undo, so confirm before deleting a module with content.

---

### Adding a Lesson

Inside any module, click **Add Lesson**. A mini-form appears with three fields:

**Lesson Title** (text input) — name of the lesson.

**Lesson Type** — dropdown with four options:
- **Video** — embed a video URL (YouTube, Vimeo, or any embeddable player)
- **Text** — markdown content written directly in the editor
- **Audio** — embed an audio URL
- **Slides** — embed a slides URL (Google Slides, Loom, etc.)

**Free Preview** — checkbox. Check this to make the lesson accessible to non-enrolled visitors. At least one free preview lesson per course is strongly recommended so prospective students can sample the content.

**Content URL** (for Video, Audio, Slides) — paste the embed or direct URL.

Click **Add Lesson**. The lesson appears under the module.

---

### Editing a Lesson

Click the **pencil icon** on any lesson to expand the edit form. All the same fields from the add form are available, plus:

**Text content** (for Text-type lessons) — a textarea where you write the lesson's markdown content. This is the lesson body students will read.

**Duration (seconds)** — optional. Enter the approximate duration so students know what to expect. Displayed as a time estimate on lesson cards.

Click **Save** when done, or **Cancel** to discard changes.

---

### Lesson Type Icons

In the curriculum list, each lesson shows a small icon indicating its type:
- Play triangle — Video
- File text — Text
- Speaker — Audio
- Presentation — Slides

A **Preview** badge appears on lessons marked as free preview.

---

### Reordering Lessons

Use the up/down arrow buttons on each lesson row to move it within its module. Lessons can only be reordered within their current module — to move a lesson to a different module, delete and re-add it.

---

### Deleting a Lesson

Hover over a lesson row — a trash icon appears on the right. Click it to delete. Deletion is immediate with no undo.

---

## Screen Recording Notes

> [SCREEN: Open the course editor — show the full page]

> [SCREENSHOT: Course editor — callouts: Settings panel (title, description, cover, pricing, navigation, visibility), Curriculum section (empty with "Add Module" button)]

> [SCREEN: Upload a cover image — drag and drop or click]

> [SCREEN: Edit the title field — click away — show it saves without a save button]

> [SCREEN: Change visibility to "Scheduled" — show the datetime picker appear]

> [SCREEN: Click "Add Module" — type a name — click Add]

> [SCREENSHOT: Module added to curriculum — callouts: Module header (title, reorder arrows, edit/delete icons), "Add Lesson" button inside]

> [SCREEN: Click "Add Lesson" — fill in title, select "Text" type, check Free Preview — click Add]

> [SCREENSHOT: Add Lesson form — callouts: Title field, Lesson type dropdown (Text selected), Free Preview checkbox]

> [SCREEN: Lesson appears in module — show the Preview badge]

> [SCREEN: Add a second lesson as Video type — show the Content URL field]

> [SCREEN: Click pencil icon on a lesson — expand the edit form — show Duration field]

> [SCREENSHOT: Lesson edit form expanded — callouts: All fields including Duration input, Save/Cancel buttons]

> [SCREEN: Use up/down arrows to reorder lessons]

> [SCREEN: End on the curriculum with modules and lessons — end lesson]

---

## Key Takeaways

- Course editor settings panel saves on blur (no manual save button) — title, description, pricing, visibility, navigation mode all editable here
- Curriculum structure: Course → Modules → Lessons
- Four lesson types: Video (URL), Text (markdown content), Audio (URL), Slides (URL)
- Free preview checkbox makes individual lessons visible to non-enrolled visitors — mark at least one per course
- Reorder modules and lessons with up/down arrows or the drag handle
- Deleting a module deletes all lessons inside it — no undo
- Scheduled visibility: course goes live automatically at the set date/time
