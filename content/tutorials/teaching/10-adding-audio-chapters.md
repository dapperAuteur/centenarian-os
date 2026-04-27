# Lesson 10: Adding Audio & Video Chapters

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Audio and video lessons need two things: the actual media file (hosted somewhere with a public URL), and optional chapter markers and transcript data so students can jump to specific sections and follow along with text. This lesson covers both — how to host the file, then how to add chapters and transcripts on top.

---

### Step 1: Get your audio or video file online

The lesson editor's **Content URL** field needs a public URL pointing to your media. You don't upload the file directly to CentenarianOS for regular video and audio lessons — you host it somewhere that gives you a public URL, then paste that URL in. The exception is 360 lessons, which have a built-in uploader.

#### For Video lessons — YouTube (recommended)

1. **Upload to YouTube** — Upload your video to your YouTube channel. Set visibility to **Unlisted** (not Public, not Private). Unlisted means only people with the link or your app's embed can see it.

2. **Restrict embedding** — In YouTube Studio, go to your video > Distribution > Embedding. Restrict embeds to your app's domain. This prevents the video from being played on other websites.

3. **Paste the URL** — In the lesson editor (Curriculum tab), paste the YouTube watch URL into the **Content URL** field. The app auto-detects YouTube and renders a fully branded player — students see your app's custom controls, not YouTube's.

4. **Pull Captions** — After saving the lesson, click **Pull Captions** to automatically import YouTube's auto-generated transcripts. These populate the transcript panel so students can follow along with synced text.

**Why YouTube?** Free hosting, unlimited storage, automatic adaptive streaming (works on slow connections), and auto-generated captions. The branded player hides YouTube's UI so students get a seamless experience.

#### For Audio lessons — Cloudinary

There is no in-editor upload for audio lessons today. The workflow:

1. **Upload to Cloudinary** — Sign in to your Cloudinary account at cloudinary.com. Click **Media Library** > **Upload**. Drop your `.mp3`, `.m4a`, or `.wav` file. Cloudinary stores it under your account and returns a public secure URL.

2. **Copy the secure URL** — In the Cloudinary media library, click your uploaded audio file. Copy the **Secure URL** (it looks like `https://res.cloudinary.com/your-cloud-name/video/upload/v1234567890/your-file.mp3` — yes, audio uses the `video/upload` path on Cloudinary).

3. **Paste into the lesson editor** — Open the lesson in the Curriculum tab, click the pencil to edit, and paste the URL into the **Content URL** field. Click **Save**.

4. **Verify it plays** — Open the lesson as a student before adding chapters. If the player shows an error card instead of controls, the URL didn't save correctly or the file isn't reachable — fix that first.

**Note on podcast links:** the **Podcast Links** field is for external platform buttons (Spotify, Apple Podcasts, etc.) and is independent of the Content URL. Adding podcast links does NOT replace the in-app audio player — both can coexist. See [Lesson 13](./13-podcast-links-and-data-import.md) for the format.

**Heads up:** an in-editor Cloudinary upload button for audio lessons is on the roadmap so you won't need to leave the editor. Until that ships, paste the URL by hand.

#### For Video lessons — Cloudinary alternative

If you'd rather self-host video instead of using YouTube, the same Cloudinary upload flow works: upload an `.mp4`, copy the secure URL (it ends in `.mp4`), paste into Content URL. Useful when you want no third-party branding or need offline-save support — but you'll pay Cloudinary bandwidth costs at scale.

#### For 360 Video and 360 Photo lessons — built-in uploader

Unlike regular video and audio, 360 lessons have an upload widget right in the lesson editor:

1. Open the lesson editor and set Lesson Type to **360 Video** or **360 Photo**.
2. An **Upload 360° video** (or photo) button appears below the Content URL field.
3. Click it, pick your equirectangular file, and the URL fills in automatically. A poster thumbnail is generated and saved alongside.
4. **Pick from library** lets you re-use any 360 asset previously uploaded — visible at `/dashboard/teaching/media`.

**Cloudinary free-tier limits:** signed uploads cap at **100 MB**. For larger 360 videos, host externally and paste the URL into the Content URL field above the uploader.

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

- **Step 1 — host the file:**
  - **Video** — upload to YouTube as Unlisted with embed restricted to your domain, paste the YouTube URL into Content URL. Or upload an MP4 to Cloudinary and paste the secure URL.
  - **Audio** — upload `.mp3` / `.m4a` / `.wav` to Cloudinary externally, copy the secure URL (audio uses Cloudinary's `video/upload` path), paste into Content URL. In-editor upload is on the roadmap.
  - **360 Video / Photo** — use the built-in upload widget in the lesson editor (100 MB Cloudinary free-tier cap; larger files need external hosting).
- Podcast Links are separate from Content URL — they render as platform buttons and don't replace the in-app player.
- Verify the lesson plays as a student before adding chapters or transcripts.
- **Step 2 — chapters:** JSON array with id, title, startTime, endTime — added via the lesson editor's Audio Chapters field
- **Step 3 — transcripts:** JSON array with startTime, endTime, text — added via the Transcript Content field
- 4-8 chapters per lesson, 5-15 second segments for transcripts
- Chapters appear as markers on the progress bar + in a clickable panel
- Transcripts auto-highlight and auto-scroll during playback
