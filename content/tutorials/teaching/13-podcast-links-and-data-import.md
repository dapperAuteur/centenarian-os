# Lesson 13: Podcast Links & Data Importer

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Two more content tools: podcast links let you connect lessons to external audio platforms, and the data importer lets you bulk-load lesson metadata from a CSV template. This lesson covers both.

---

### Adding Podcast Links

The **Podcast Links** field in the lesson editor accepts a JSON array of link objects. Each link has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Full URL to the episode on the platform |
| `label` | string | No | Platform name (auto-detected from URL if omitted) |

The PodcastLinks component auto-detects the platform from the URL:
- **Spotify** — `open.spotify.com` → green button
- **Apple Podcasts** — `podcasts.apple.com` → purple button
- **YouTube** — `youtube.com` or `youtu.be` → red button
- **Amazon Music** — `music.amazon.com` → teal button
- **Other** — gray button with generic link icon

---

### Podcast Links Example

```json
[
  { "url": "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk", "label": "Spotify" },
  { "url": "https://podcasts.apple.com/us/podcast/better-vice-club/id1234567890?i=1000600000001", "label": "Apple Podcasts" },
  { "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "label": "YouTube" }
]
```

Students see platform-specific colored buttons at the top of the lesson content. Clicking a button opens the episode in a new tab.

---

### When to Use Podcast Links

Podcast links are ideal for:
- **Podcast-based curriculum** — each lesson corresponds to an episode. The lesson page provides study guides, quizzes, and reference material while the audio lives on the podcast platform.
- **Supplementary listening** — link to a relevant episode that adds context to a text or video lesson.
- **Cross-platform distribution** — students choose their preferred listening app.

You can combine podcast links with a locally-hosted audio file (chapter markers + transcript) — the external links let students listen on their preferred platform, while the in-app player provides structured navigation.

---

### The Bulk Course Importer

For courses with many lessons, the Bulk Course Importer lets you create an entire course structure — modules and lessons — from a single CSV file. You can also use it to update existing lessons.

The importer is in the **Curriculum** section of the course editor. Click **Bulk Import from CSV** to expand the import panel.

---

### CSV Template Format

Download the template from the import panel, or use this column structure:

```
module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content
```

Each row is one lesson. The `module_title` column determines which module the lesson belongs to — modules are auto-created if they don't already exist.

| Column | Required | Description |
|--------|----------|-------------|
| `module_title` | No | Module name (auto-creates if new) |
| `module_order` | No | Display order of the module (default: auto-incrementing) |
| `lesson_order` | No | Display order within the course (default: row index) |
| `title` | **Yes** | Lesson title |
| `lesson_type` | No | `video`, `text`, `audio`, `slides`, or `quiz` (default: `video`) |
| `duration_seconds` | No | Length in seconds |
| `is_free_preview` | No | `true` or `false` (default: follows course pricing) |
| `content_url` | No | URL to video/audio/slides file (Cloudinary, etc.) |
| `text_content` | No | Markdown or Tiptap JSON for text lessons |
| `content_format` | No | `markdown` or `tiptap` (default: `markdown`) |
| `audio_chapters` | No | JSON array of chapter markers |
| `transcript_content` | No | JSON array of transcript segments |
| `map_content` | No | JSON object for MapViewer |
| `documents` | No | JSON array of document objects |
| `podcast_links` | No | JSON array of podcast link objects |
| `quiz_content` | No | JSON object with quiz questions |

---

### Example CSV (Full Course)

```csv
module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content
Getting Started,1,1,Welcome to the Course,video,300,true,https://res.cloudinary.com/your-cloud/video/upload/welcome.mp4,,markdown,,,,,,
Getting Started,1,2,Setting Up Your Workspace,text,240,true,,This is the lesson content in **markdown** format.,markdown,,,,,,
Core Concepts,2,3,Understanding the Basics,video,600,false,https://res.cloudinary.com/your-cloud/video/upload/basics.mp4,,markdown,"[{""id"":""ch1"",""title"":""Intro"",""startTime"":0,""endTime"":120}]",,,,
Practice,3,5,Knowledge Check,quiz,180,false,,,,,,,,,"{ ""questions"": [{ ""id"": ""q1"", ""question"": ""What is the main purpose?"", ""options"": [""A"", ""B"", ""C"", ""D""], ""correctIndex"": 0, ""explanation"": ""A is correct."" }] }"
```

Note: JSON within CSV cells uses doubled quotes (`""`) to escape.

---

### Import Modes

The importer has two modes:

- **Create Only** (default) — creates new modules and lessons. Skips if a lesson with the same order already exists in that module.
- **Create + Update** — creates new modules and lessons, AND updates existing lessons that match by module + lesson order. Use this to update content_url, text_content, or any other field on existing lessons.

---

### Using the Bulk Importer

1. Navigate to your course in the teaching dashboard
2. In the **Curriculum** section, click **Bulk Import from CSV**
3. Choose your import mode (Create Only or Create + Update)
4. Upload your CSV file — or paste a Google Sheets published URL
5. The importer shows how many rows were parsed
6. Modules are auto-created, then lessons are inserted/updated
7. The curriculum refreshes automatically to show the new structure

---

### Tips

- Prepare your CSV in a spreadsheet app (Google Sheets, Excel) — it handles the quote escaping for you
- Click the **Template** button in the import panel to download the exact CSV template
- JSON fields can be left empty if not applicable
- Rows without a `module_title` are added with no module assignment
- Run **Generate Embeddings** after importing so CYOA crossroads works
- Two template files are available: `course-import.csv` (modules + lessons) and `lessons-import.csv` (lessons only)

---

## Screen Recording Notes

> [SCREEN: Open the lesson editor — scroll to the Podcast Links field]

> [SCREENSHOT: Podcast Links JSON field — callout: "Array of { url, label } objects"]

> [SCREEN: Paste the 3-platform example — save — preview the lesson]

> [SCREEN: Show the colored platform buttons (Spotify green, Apple purple, YouTube red) at the top of lesson content]

> [SCREEN: Click the Spotify button — show it open in a new tab]

> [SCREEN: Return to the course editor — click "Bulk Import from CSV" in the Curriculum section]

> [SCREENSHOT: Bulk Import panel — callouts: Mode toggle (Create Only / Create + Update), CSV upload, Template download]

> [SCREEN: Select "Create Only" mode — upload a prepared CSV — show row count confirmation]

> [SCREEN: Show modules and lessons auto-created in the curriculum — multiple modules populated at once]

> [SCREEN: Switch to "Create + Update" mode — upload updated CSV — show existing lessons updated]

---

## Key Takeaways

- Podcast Links: JSON array of { url, label } — platform auto-detected from URL
- Buttons render with platform-specific colors (Spotify green, Apple purple, YouTube red)
- Bulk Course Importer: create modules + lessons from a single CSV file
- Two modes: Create Only (skip existing) or Create + Update (overwrite existing by module+order)
- CSV template includes all lesson fields: title, type, content, chapters, maps, quizzes, podcasts, documents
- Modules are auto-created from the `module_title` column
- Supports CSV file upload or Google Sheets published URL
- Run Generate Embeddings after importing so CYOA navigation works
