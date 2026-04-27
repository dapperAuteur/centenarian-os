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

### The Tabbed Editor

The course editor is organized into **7 tabs** across the top:

1. **Info** — Cover image, description, category
2. **Pricing** — Price type, amount, free trial, visibility
3. **Structure** — Navigation mode (Linear/CYOA), sequential modules, AI embeddings
4. **Curriculum** — Modules and lessons (this is where you build content)
5. **Extras** — Glossary and phonetic spelling
6. **Prerequisites** — Required/recommended courses, student overrides, AI suggestions
7. **Review** — Content health dashboard, publish toggle, course summary

You can navigate between tabs freely — all changes save automatically on blur. The Review tab shows a content health check that flags missing descriptions, empty modules, and lessons without content URLs.

---

### Course Settings (Info + Pricing Tabs)

The Info and Pricing tabs let you update every course-level detail:

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

**Lesson Type** — dropdown:
- **Video** — flat 2D video (YouTube, Vimeo, Cloudinary MP4, or any embeddable player)
- **Audio** — audio-only lesson (podcast episode, narration, music)
- **Text** — markdown or rich-text content written directly in the editor
- **Slides** — embedded slide deck (Google Slides, Loom, etc.)
- **Quiz** — multiple-choice / true-false questions
- **360 Video** — equirectangular VR video, viewed in a pannable sphere
- **360 Photo** — equirectangular still image, viewed in a pannable sphere
- **Virtual Tour** — multi-stop 360 tour with hotspots
- **Map** — interactive map with markers, lines, and polygons

**Free Preview** — checkbox. Check this to make the lesson accessible to non-enrolled visitors. At least one free preview lesson per course is strongly recommended so prospective students can sample the content.

**Content URL** (for Video, Audio, Slides, 360 Video, 360 Photo) — paste the embed or direct URL. See the next section for where to get this URL depending on lesson type.

Click **Add Lesson**. The lesson appears under the module.

---

### Where the audio or video file comes from

The Content URL field accepts a public URL to your media file. How you get that URL depends on the lesson type:

**For Video lessons:**
- **YouTube (recommended)** — upload to your YouTube channel as Unlisted, restrict embeds to your domain, and paste the YouTube watch URL. The lesson page renders a fully branded player (no YouTube UI). Free hosting, automatic captions, adaptive streaming. See [Lesson 10](./10-adding-audio-chapters.md) for the full YouTube setup.
- **Cloudinary or other CDN** — paste the direct `https://res.cloudinary.com/.../upload/...mp4` URL of an uploaded MP4. Use this when you want the file fully self-hosted (no third-party branding, offline-save support).

**For Audio lessons:**
- **Cloudinary (current workflow)** — upload your `.mp3`, `.m4a`, or `.wav` to your Cloudinary account through Cloudinary's web dashboard, copy the secure URL (it ends in the file extension), and paste it into the Content URL field. Save the lesson — verify it plays before adding chapters.
- **External hosting** — any public URL ending in a supported audio extension works. The browser handles playback natively.
- **In-editor upload (planned)** — a built-in Cloudinary upload button on audio lessons is on the roadmap so you won't need to leave the editor. Until that ships, paste the Cloudinary URL by hand.

**For 360 Video and 360 Photo lessons:**
- The lesson editor includes a built-in **Cloudinary upload widget** when you select 360 Video or 360 Photo as the lesson type. Click **Upload 360° video** (or photo), pick the equirectangular file, and the URL is filled in for you automatically. A poster thumbnail is generated and saved alongside.
- Cloudinary free tier caps signed uploads at **100 MB**. For larger 360 videos, host externally (e.g., S3 or a self-hosted CDN) and paste the URL into the Content URL field above the uploader.
- A **Pick from library** button lets you re-use any previously uploaded 360 asset (visible at `/dashboard/teaching/media`).

**For Slides lessons:**
- Paste the public embed URL from Google Slides, Loom, Canva, or similar. The lesson renders the URL inside a 16:9 iframe.

> **The Media Library** at `/dashboard/teaching/media` is a read-only catalog of every file you've uploaded through the lesson editor. It does not currently have its own upload button — uploads happen from inside the lesson edit form on 360 lessons. For audio and regular video, host the file externally (typically Cloudinary) and paste the URL.

---

### Editing a Lesson

Click the **pencil icon** on any lesson to expand the edit form. All the same fields from the add form are available, plus:

**Text content** (for Text-type lessons) — a textarea where you write the lesson's markdown content. This is the lesson body students will read. A toggle switches between Markdown and Rich Text (Tiptap) modes.

**Duration (seconds)** — optional. Enter the approximate duration so students know what to expect. Displayed as a time estimate on lesson cards.

**Audio Chapters / Transcript Content** — JSON arrays for chapter markers and synced transcripts on audio and video lessons. See [Lesson 10](./10-adding-audio-chapters.md) for the full format.

**Podcast Links** — JSON array of external podcast platform links (Spotify, Apple, YouTube, Amazon). These render as colored buttons at the top of the lesson and are independent of the Content URL — they do not replace the in-app audio player. See [Lesson 13](./13-podcast-links-and-data-import.md).

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
- Lesson types include Video, Audio, Text, Slides, Quiz, 360 Video, 360 Photo, Virtual Tour, and Map
- Where the file comes from depends on lesson type:
  - **Video** — paste a YouTube URL (recommended) or a Cloudinary MP4 URL
  - **Audio** — upload to Cloudinary externally and paste the secure URL into the Content URL field (in-editor upload is on the roadmap)
  - **360 Video / 360 Photo** — use the built-in upload widget right in the lesson editor (100 MB free-tier cap)
  - **Slides** — paste the public embed URL
- The teaching Media Library (`/dashboard/teaching/media`) is a read-only catalog of files uploaded through the editor — not an upload page
- Podcast Links are independent of the audio Content URL — they render as platform buttons and do not replace the in-app player
- Free preview checkbox makes individual lessons visible to non-enrolled visitors — mark at least one per course
- Reorder modules and lessons with up/down arrows or the drag handle
- Deleting a module deletes all lessons inside it — no undo
- Scheduled visibility: course goes live automatically at the set date/time
