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

### The Data Importer

For courses with many lessons, the DataImporter component lets you bulk-load lesson metadata from a CSV file instead of entering each lesson's JSON fields manually.

---

### CSV Template Format

The CSV should have these columns:

```
lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content
```

Each row is one lesson. JSON fields (`audio_chapters`, `transcript_content`, `map_content`, `documents`, `podcast_links`, `quiz_content`) should be valid JSON strings within the CSV cell.

---

### Example CSV Row

```csv
1,"Welcome to the Andes",audio,2100,true,"https://res.cloudinary.com/your-cloud/video/upload/andes-ep1.mp3","","markdown","[{""id"":""ch1"",""title"":""Intro"",""startTime"":0,""endTime"":120}]","[]","{}","[]","[{""url"":""https://open.spotify.com/episode/abc"",""label"":""Spotify""}]",""
```

Note: JSON within CSV cells uses doubled quotes (`""`) to escape.

---

### Using the Data Importer

1. Navigate to your course in the teaching dashboard
2. Click **Import Data** (or the upload icon)
3. Upload your CSV file
4. The importer validates each row and shows a preview
5. Confirm to create all lessons at once

The importer creates lessons but does not overwrite existing ones. If a lesson with the same `lesson_order` already exists, it will be skipped.

---

### Tips

- Prepare your CSV in a spreadsheet app — it handles the quote escaping for you
- Start with the CSV template (download from the import modal) to get the exact column headers
- JSON fields can be left empty (`""`) if not applicable
- Run **Generate Embeddings** after importing so CYOA crossroads works

---

## Screen Recording Notes

> [SCREEN: Open the lesson editor — scroll to the Podcast Links field]

> [SCREENSHOT: Podcast Links JSON field — callout: "Array of { url, label } objects"]

> [SCREEN: Paste the 3-platform example — save — preview the lesson]

> [SCREEN: Show the colored platform buttons (Spotify green, Apple purple, YouTube red) at the top of lesson content]

> [SCREEN: Click the Spotify button — show it open in a new tab]

> [SCREEN: Return to the course editor — click Import Data]

> [SCREENSHOT: Data Importer modal — callouts: CSV upload area, Template download link, Preview table]

> [SCREEN: Upload a prepared CSV — show the preview with parsed lesson data]

> [SCREEN: Confirm import — show lessons appear in the course]

---

## Key Takeaways

- Podcast Links: JSON array of { url, label } — platform auto-detected from URL
- Buttons render with platform-specific colors (Spotify green, Apple purple, YouTube red)
- Data Importer: bulk-create lessons from a CSV template
- CSV contains all lesson metadata including JSON fields for chapters, maps, quizzes
- Import creates lessons but doesn't overwrite — run Generate Embeddings after
