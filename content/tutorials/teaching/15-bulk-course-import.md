# Lesson 15: Bulk Course Import Workflow

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Building a course one lesson at a time works for small projects, but what if you have 20 or 50 lessons to add? The Bulk Course Importer lets you create an entire course structure — modules and lessons — from a single CSV file. This lesson walks through the complete workflow from spreadsheet to published curriculum.

---

### Overview

The Bulk Course Importer lives in the **Curriculum** section of every course editor. It reads a CSV where each row is a lesson, groups rows by module name, auto-creates missing modules, and inserts (or updates) lessons — all in one operation.

What it handles:
- **Modules** — auto-created from unique `module_title` values in the CSV
- **Lessons** — created with all supported fields (title, type, content, chapters, maps, quizzes, documents, podcasts)
- **Updates** — in "Create + Update" mode, existing lessons matched by module + order are overwritten

---

### Step 1: Prepare Your Spreadsheet

Start with a spreadsheet in Google Sheets or Excel. Use the downloadable CSV template from the import panel, or create your own with these columns:

```
module_title, module_order, lesson_order, title, lesson_type, duration_seconds, is_free_preview, content_url, text_content, content_format, audio_chapters, transcript_content, map_content, documents, podcast_links, quiz_content
```

**Tips for the spreadsheet:**
- One row per lesson
- Group lessons under the same `module_title` — the importer creates one module per unique title
- Set `module_order` to control the display order of modules (1, 2, 3...)
- Set `lesson_order` to control the display order of lessons within the course
- Leave JSON columns empty if not applicable — the importer skips null fields

---

### Step 2: Fill In Lesson Data

For each lesson row, fill in the fields that apply:

| Lesson Type | Key Fields to Fill |
|-------------|--------------------|
| **video** | `content_url` (Cloudinary video URL), `duration_seconds`, optionally `audio_chapters` and `transcript_content` |
| **audio** | `content_url` (Cloudinary audio URL), `duration_seconds`, optionally `audio_chapters`, `transcript_content`, `podcast_links` |
| **text** | `text_content` (Markdown or Tiptap JSON), `content_format` (`markdown` or `tiptap`) |
| **quiz** | `quiz_content` (full quiz JSON with questions, options, correct answers, explanations) |
| **slides** | `content_url` (Cloudinary slides URL) |

You can add rich content to any lesson type:
- `audio_chapters` — chapter markers for the video/audio progress bar
- `transcript_content` — synchronized transcript segments
- `map_content` — interactive map with markers, lines, and polygons
- `documents` — PDF/image attachments
- `podcast_links` — platform-specific external audio links

---

### Step 3: Handle JSON Fields in CSV

JSON fields need special handling in CSV format. Spreadsheet apps handle this automatically when you export to CSV, but if editing raw CSV:

- Wrap the entire JSON in double quotes
- Use doubled quotes (`""`) for any quotes inside the JSON

**Example chapter markers in raw CSV:**

```csv
"[{""id"":""ch1"",""title"":""Introduction"",""startTime"":0,""endTime"":180},{""id"":""ch2"",""title"":""Main Topic"",""startTime"":180,""endTime"":600}]"
```

**In Google Sheets**, just paste the plain JSON into the cell — the export handles escaping:

```json
[{"id":"ch1","title":"Introduction","startTime":0,"endTime":180}]
```

---

### Step 4: Import Into Your Course

1. Open your course in the teaching dashboard
2. Scroll to the **Curriculum** section
3. Click **Bulk Import from CSV** to expand the import panel
4. Choose your import mode:
   - **Create Only** — adds new modules and lessons; skips rows where a lesson with the same order already exists
   - **Create + Update** — adds new items AND updates existing lessons that match by module + lesson order
5. Upload your CSV file — or switch to the **Google Sheets** tab and paste a published sheet URL
6. The importer reports how many modules were created, lessons were created, updated, or skipped
7. Check the curriculum — your modules and lessons are now populated

---

### Step 5: Post-Import Checklist

After importing, complete these steps:

1. **Review the curriculum** — verify module order and lesson order look correct
2. **Upload media** — if you left `content_url` empty, open each video/audio lesson and upload the file via the media uploader
3. **Preview lessons** — click through a few lessons to verify text, chapters, maps, and quizzes render correctly
4. **Generate embeddings** — click "Generate AI Paths" so CYOA crossroads navigation has semantic data
5. **Set sequential locking** (optional) — if your course requires module-order completion, toggle it on in course settings
6. **Publish** — flip the publish toggle when everything looks good

---

### Full Example CSV

This CSV creates a 3-module, 6-lesson course:

```csv
module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content
Getting Started,1,1,Welcome to the Course,video,300,true,https://res.cloudinary.com/demo/video/upload/welcome.mp4,,markdown,,,,,,
Getting Started,1,2,Setting Up Your Workspace,text,240,true,,This is the lesson content in **markdown** format.,markdown,,,,,,
Core Concepts,2,3,Understanding the Basics,video,600,false,https://res.cloudinary.com/demo/video/upload/basics.mp4,,markdown,"[{""id"":""ch1"",""title"":""Intro"",""startTime"":0,""endTime"":120},{""id"":""ch2"",""title"":""Key Concepts"",""startTime"":120,""endTime"":480}]","[{""startTime"":0,""endTime"":15,""text"":""Welcome to the basics lesson.""}]",,,,
Core Concepts,2,4,Interactive Map Exercise,text,300,false,,,markdown,,,"{ ""center"": [37.7749, -122.4194], ""zoom"": 12, ""markers"": [{ ""lat"": 37.7749, ""lng"": -122.4194, ""title"": ""Starting Point"", ""description"": ""Begin here"" }] }",,,
Practice,3,5,Knowledge Check,quiz,180,false,,,,,,,,,"{ ""questions"": [{ ""id"": ""q1"", ""question"": ""What is the main purpose of this feature?"", ""options"": [""Option A"", ""Option B"", ""Option C"", ""Option D""], ""correctIndex"": 0, ""explanation"": ""Option A is correct because..."" }] }"
Practice,3,6,Listen and Learn,audio,1200,true,https://res.cloudinary.com/demo/video/upload/podcast-ep1.mp3,,markdown,"[{""id"":""ch1"",""title"":""Introduction"",""startTime"":0,""endTime"":300},{""id"":""ch2"",""title"":""Deep Dive"",""startTime"":300,""endTime"":900}]",,,"[{""url"":""https://res.cloudinary.com/demo/docs/reference.pdf"",""title"":""Reference Guide"",""description"":""Quick reference for this lesson""}]","[{""url"":""https://open.spotify.com/episode/example"",""label"":""Spotify""},{""url"":""https://podcasts.apple.com/example"",""label"":""Apple Podcasts""}]",
```

**Result:** 3 modules (Getting Started, Core Concepts, Practice) with 2 lessons each. Lessons include video with chapters, text with markdown, map content, a quiz, and an audio lesson with podcast links.

---

### Google Sheets Workflow

For the smoothest experience:

1. Create a Google Sheet with the template columns
2. Fill in your lessons — paste JSON directly into cells
3. Go to **File → Share → Publish to web** → select the tab → choose CSV → Publish
4. Copy the published URL
5. In the import panel, switch to the **Google Sheets** tab
6. Paste the URL → click the import button
7. The importer fetches and parses the sheet automatically

This lets you maintain your course content in a living spreadsheet and re-import whenever you update it (using "Create + Update" mode).

---

### Updating an Existing Course

To update lessons that already exist:

1. Switch the import mode to **Create + Update**
2. Upload your updated CSV
3. Lessons are matched by their `module_id` + `lesson_order` combination
4. Matching lessons have all provided fields overwritten
5. Non-matching rows create new lessons as usual

This is useful for:
- Bulk-updating `content_url` after uploading new video files
- Adding `audio_chapters` or `transcript_content` to existing lessons
- Updating `text_content` across multiple lessons at once

---

## Screen Recording Notes

> [SCREEN: Open a course in the teaching dashboard — scroll to Curriculum section]

> [SCREEN: Click "Bulk Import from CSV" — show the panel expand]

> [SCREENSHOT: Import panel — callouts: "Mode toggle", "CSV File tab", "Google Sheets tab", "Template download"]

> [SCREEN: Switch to Google Sheets tab — paste a published sheet URL — click import]

> [SCREEN: Show the success message: "Created 3 modules, 6 lessons"]

> [SCREEN: Show the curriculum with all 3 modules populated with lessons]

> [SCREEN: Open one of the imported lessons — show the chapter markers and text content rendered correctly]

> [SCREEN: Demonstrate Create + Update mode — upload an updated CSV — show "Updated 4 lessons"]

---

## Key Takeaways

- The Bulk Course Importer creates modules + lessons from a single CSV file
- Each CSV row is one lesson; the `module_title` column auto-creates modules
- Two modes: Create Only (default, safe) and Create + Update (overwrites existing)
- Supports CSV file upload and Google Sheets published URLs
- JSON fields (chapters, maps, quizzes, documents, podcasts) are fully supported in CSV cells
- After importing: review, upload media, generate embeddings, then publish
- Maintain your course in a living spreadsheet and re-import with updates anytime
