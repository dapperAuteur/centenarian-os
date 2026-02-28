# Lesson 10: Adding Audio & Video Chapters

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

When you create a video or audio lesson, you can add chapter markers and transcript data so students can jump to specific sections and follow along with text. This lesson covers how to add both.

---

### What Chapters Do

Chapters divide a long video or audio lesson into named sections with timestamps. Students see:
- Vertical markers on the progress bar
- A clickable chapters panel listing all sections
- A chapter label overlay showing the current section name

This is especially useful for podcast-based courses where a single episode covers multiple topics.

---

### Adding Chapters to a Lesson

When editing a lesson (video or audio type), you'll find an **Audio Chapters** field in the lesson editor. This field accepts a JSON array of chapter objects.

Each chapter has four fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., "ch1", "ch2") |
| `title` | string | Chapter name shown to students |
| `startTime` | number | Start time in seconds |
| `endTime` | number | End time in seconds |

**Rules:**
- Chapters should be in chronological order
- `endTime` of one chapter should equal `startTime` of the next (no gaps)
- The first chapter should start at 0
- The last chapter's `endTime` should match the lesson's total duration

---

### Example: 6-Chapter Podcast Lesson (35 min)

Paste this into the Audio Chapters field:

```json
[
  { "id": "ch1", "title": "Episode Intro", "startTime": 0, "endTime": 120 },
  { "id": "ch2", "title": "Geography: The Physical Landscape", "startTime": 120, "endTime": 480 },
  { "id": "ch3", "title": "Economics: Trade and Resources", "startTime": 480, "endTime": 900 },
  { "id": "ch4", "title": "English Language Arts: Key Vocabulary", "startTime": 900, "endTime": 1320 },
  { "id": "ch5", "title": "Social Studies: Culture and Governance", "startTime": 1320, "endTime": 1800 },
  { "id": "ch6", "title": "Wrap-Up and Next Episode Preview", "startTime": 1800, "endTime": 2100 }
]
```

---

### Adding Transcripts

The **Transcript Content** field accepts a JSON array of transcript segments. Each segment has:

| Field | Type | Description |
|-------|------|-------------|
| `startTime` | number | When this text begins (seconds) |
| `endTime` | number | When this text ends (seconds) |
| `text` | string | The spoken words for this segment |

Students see the transcript in a scrollable panel that auto-highlights the active segment during playback.

---

### Example: Transcript Segments

```json
[
  { "startTime": 0, "endTime": 5, "text": "Welcome back to Better Vice Club, season two." },
  { "startTime": 5, "endTime": 12, "text": "Today we're heading to the Andes Mountains to explore how geography shapes trade." },
  { "startTime": 12, "endTime": 20, "text": "We'll cover the physical landscape first, then move into the economics of the region." },
  { "startTime": 20, "endTime": 28, "text": "By the end of this episode, you'll understand how elevation affects agriculture and transportation." },
  { "startTime": 28, "endTime": 36, "text": "Let's start with the basics. The Andes run along the western edge of South America." },
  { "startTime": 36, "endTime": 45, "text": "At over 7,000 kilometers long, they're the longest continental mountain range in the world." },
  { "startTime": 45, "endTime": 55, "text": "The highest peak, Aconcagua, sits at 6,961 meters — nearly 23,000 feet above sea level." },
  { "startTime": 55, "endTime": 65, "text": "This altitude creates distinct ecological zones, each with different crops, animals, and human settlements." },
  { "startTime": 65, "endTime": 75, "text": "In the low valleys, you'll find tropical agriculture — coffee, cacao, bananas." },
  { "startTime": 75, "endTime": 85, "text": "Move up to the mid-altitudes and you see maize, potatoes, and quinoa — staples of Andean diet for thousands of years." },
  { "startTime": 85, "endTime": 95, "text": "Above the tree line, herding takes over. Llamas and alpacas provide wool, meat, and transport." }
]
```

---

### Tips for Good Chapters and Transcripts

**Chapters:**
- 4-8 chapters per lesson is typical
- Name chapters by topic, not by time ("Geography: Trade Routes" not "Minute 5-10")
- Keep chapter titles under 60 characters for clean display

**Transcripts:**
- Segments of 5-15 seconds work well for readability
- Each segment should be 1-2 sentences
- Don't include timestamps in the text itself — the player handles timing
- Transcripts don't need to be word-perfect — close paraphrasing is acceptable for readability

---

## Screen Recording Notes

> [SCREEN: Open the lesson editor for an audio lesson — scroll to the Audio Chapters field]

> [SCREENSHOT: Audio Chapters JSON field — callout: "Paste a JSON array of chapter objects"]

> [SCREEN: Paste the 6-chapter example JSON — save the lesson]

> [SCREEN: Open the lesson as a student — show chapter markers on the progress bar]

> [SCREEN: Click the chapters panel — show the 6 chapters listed with titles]

> [SCREEN: Scroll to the Transcript Content field in the editor]

> [SCREENSHOT: Transcript Content JSON field — callout: "Each segment has startTime, endTime, and text"]

> [SCREEN: Paste transcript segments — save — preview the lesson with transcript panel open]

> [SCREEN: Show the transcript auto-highlighting as audio plays]

---

## Key Takeaways

- Chapters: JSON array with id, title, startTime, endTime — added via the lesson editor's Audio Chapters field
- Transcripts: JSON array with startTime, endTime, text — added via the Transcript Content field
- 4-8 chapters per lesson, 5-15 second segments for transcripts
- Chapters appear as markers on the progress bar + in a clickable panel
- Transcripts auto-highlight and auto-scroll during playback
