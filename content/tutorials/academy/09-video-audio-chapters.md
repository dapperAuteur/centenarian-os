# Lesson 09: Video & Audio Chapters

**Course:** Navigating the Centenarian Academy
**Module:** Rich Media
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Some lessons include video or audio content with chapter markers and synchronized transcripts. These features let you jump to specific sections, follow along with the text, and control playback speed. This lesson explains how to use them.

---

### Chapter Markers

When a video or audio lesson has chapters, you'll see them in two places:

**On the progress bar** — vertical lines mark the boundary between chapters. Hovering over a marker shows the chapter title.

**In the chapters panel** — click the chapters button (looks like a list icon) on the player controls. A side panel opens showing all chapters with their titles and timecodes. Click any chapter to jump directly to that point.

The currently playing chapter is highlighted. A label also appears in the bottom-left corner of the video player showing the active chapter name.

---

### Transcript Sync

If the lesson includes a transcript, click the transcript button (speech bubble icon) on the player controls. A side panel opens showing the full transcript broken into segments.

Each segment is timestamped. As the audio or video plays, the active segment is highlighted and the panel auto-scrolls to keep it in view.

Click any transcript segment to jump to that point in the playback. This is useful for reviewing a specific sentence or finding a section you want to re-listen to.

---

### Playback Controls

The video and audio players include:

- **Play/Pause** — center button or click the video area
- **Skip back 15 seconds** — for re-hearing a sentence
- **Skip forward 30 seconds** — for jumping past slow sections
- **Playback speed** — cycle through: 0.75x, 1x, 1.25x, 1.5x, 2x. Click the speed button to advance to the next speed.
- **Volume/Mute** — click the speaker icon to mute/unmute
- **Fullscreen** — expand the video to fill your screen (video lessons only)
- **Progress bar** — click anywhere on the bar to seek to that position

---

### How Chapters Are Structured

Chapters divide a lesson into logical sections. A typical 20-minute lesson might have 4-6 chapters:

```json
[
  { "id": "ch1", "title": "Introduction", "startTime": 0, "endTime": 210 },
  { "id": "ch2", "title": "Core Concept: How It Works", "startTime": 210, "endTime": 600 },
  { "id": "ch3", "title": "Step-by-Step Walkthrough", "startTime": 600, "endTime": 960 },
  { "id": "ch4", "title": "Common Mistakes", "startTime": 960, "endTime": 1080 },
  { "id": "ch5", "title": "Summary & Next Steps", "startTime": 1080, "endTime": 1200 }
]
```

Each chapter has an ID, a title, and start/end times in seconds. The player uses these to draw markers on the progress bar and populate the chapters panel.

---

### How Transcripts Are Structured

Transcripts are an array of segments, each with a time range and text:

```json
[
  { "startTime": 0, "endTime": 8, "text": "Welcome to this lesson on chapter markers and transcript sync." },
  { "startTime": 8, "endTime": 18, "text": "Today we'll cover how to navigate lessons that include audio or video content with structured chapters." },
  { "startTime": 18, "endTime": 30, "text": "If you've ever listened to a podcast and wished you could jump to a specific topic, that's exactly what chapters give you." }
]
```

The player matches the current playback time to the active segment and highlights it in the transcript panel.

---

### Not All Lessons Have Chapters

Chapters and transcripts are optional. If a lesson doesn't include them, the chapter and transcript buttons won't appear in the player controls. The progress bar will show a simple timeline without markers.

Text-only and quiz lessons don't have a player at all — they render as formatted content or interactive quizzes instead.

---

## Screen Recording Notes

> [SCREEN: Navigate to a video lesson that has chapters — show the player with chapter markers on the progress bar]

> [SCREENSHOT: Video player — callouts: Chapter markers on progress bar, Play/Pause, Skip ±15/30s, Speed control, Volume, Fullscreen]

> [SCREEN: Click the chapters button — show the chapters panel expand with chapter list]

> [SCREEN: Click a chapter in the panel — show playback jump to that timestamp]

> [SCREENSHOT: Chapters panel — callout: "Click any chapter to jump to that section"]

> [SCREEN: Click the transcript button — show the transcript panel with highlighted active segment]

> [SCREEN: Let playback continue for a few seconds — show the highlight moving through transcript segments with auto-scroll]

> [SCREEN: Click a transcript segment — show playback seek to that timestamp]

> [SCREEN: Click the speed button — cycle through 1x → 1.25x → 1.5x — show the speed indicator change]

---

## Key Takeaways

- Chapter markers appear as lines on the progress bar and in a clickable chapters panel
- Transcript sync highlights the active segment and auto-scrolls as content plays
- Click any chapter or transcript segment to jump to that point
- Playback speed cycles through 0.75x, 1x, 1.25x, 1.5x, 2x
- Chapters and transcripts are optional — not all lessons include them
