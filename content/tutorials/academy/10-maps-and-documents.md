# Lesson 10: Interactive Maps & Documents

**Course:** Navigating the Centenarian Academy
**Module:** Rich Media
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Some lessons include interactive maps and downloadable documents alongside the main content. These are especially common in geography-focused or research-oriented courses. This lesson shows you how to interact with them.

---

### Interactive Maps

When a lesson includes map content, a MapViewer component appears within the lesson page. The map is interactive — you can:

- **Pan** — click and drag to move the view
- **Zoom** — scroll wheel or pinch to zoom in/out
- **Click markers** — markers are labeled points on the map. Click one to see its title and description in a popup
- **View polygons** — colored shaded regions that highlight geographic areas
- **View lines** — colored lines connecting points, often representing routes or trade paths

Maps are read-only — you can't add or edit markers. They're set by the course teacher to illustrate the lesson content.

---

### Example Map Data

Here's what a lesson's `map_content` looks like — this example shows a multi-stop trip route:

```json
{
  "center": [37.7749, -122.4194],
  "zoom": 6,
  "markers": [
    { "lat": 37.7749, "lng": -122.4194, "title": "San Francisco", "description": "Starting point — depart 8:00 AM" },
    { "lat": 36.7783, "lng": -119.4179, "title": "Fresno", "description": "Lunch stop — Central Valley" },
    { "lat": 36.1699, "lng": -115.1398, "title": "Las Vegas", "description": "Final destination — arrive 6:00 PM" }
  ],
  "lines": [
    { "coordinates": [[37.7749, -122.4194], [36.7783, -119.4179]], "color": "#3B82F6", "label": "Leg 1: SF to Fresno" },
    { "coordinates": [[36.7783, -119.4179], [36.1699, -115.1398]], "color": "#EF4444", "label": "Leg 2: Fresno to Vegas" }
  ],
  "polygons": [
    { "coordinates": [[37.0, -122.5], [37.0, -119.0], [36.5, -119.0], [36.5, -122.5]], "color": "#10B981", "fillColor": "#10B98120", "label": "Central Valley Region" }
  ]
}
```

---

### Document Viewer

Some lessons include attached documents — PDFs, reference sheets, or image galleries. These appear in a DocumentViewer component below or alongside the lesson text.

For each document, you'll see:
- **Title** — what the document is
- **Description** — a brief explanation of the content
- **View/Download** — click to open the document in a new tab or download it
- **Source URL** — if the document has an external source, a link is provided

Documents are supplementary — the lesson's main content stands on its own, but documents provide deeper reference material, worksheets, or primary sources.

---

### Example Document Data

```json
[
  {
    "url": "https://res.cloudinary.com/example/raw/upload/v1/docs/trip-packing-list.pdf",
    "title": "Road Trip Packing Checklist",
    "description": "A printable checklist covering essentials for a 3-day road trip — gear, food, first aid, and vehicle prep.",
    "source_url": "https://centenarianos.com/resources/packing"
  },
  {
    "url": "https://res.cloudinary.com/example/image/upload/v1/docs/route-elevation-profile.png",
    "title": "Route Elevation Profile",
    "description": "Elevation chart for the SF to Vegas route showing mountain passes and valley sections.",
    "source_url": null
  }
]
```

---

### When to Expect Maps and Documents

Maps are most common in:
- Geography-focused courses (history, social studies)
- Travel tutorial lessons showing routes
- Courses that reference real-world locations

Documents are most common in:
- Research-oriented courses (primary sources)
- Practical courses (checklists, worksheets, reference guides)
- Tutorial lessons with supplementary PDFs

If a lesson doesn't include maps or documents, those sections simply won't appear.

---

## Screen Recording Notes

> [SCREEN: Navigate to a lesson with map content — show the MapViewer loading]

> [SCREENSHOT: MapViewer — callouts: Markers (clickable pins), Polygon (shaded region), Lines (route paths), Zoom controls]

> [SCREEN: Click a marker — show the popup with title and description]

> [SCREEN: Pan and zoom the map — show interactive navigation]

> [SCREEN: Scroll down to the DocumentViewer section — show attached documents]

> [SCREENSHOT: DocumentViewer — callouts: Document title, Description, View/Download button, Source URL link]

> [SCREEN: Click a document — show it open in a new tab]

---

## Key Takeaways

- Interactive maps show markers, polygons, and lines — click markers for details, pan and zoom freely
- Maps are read-only — set by the teacher to illustrate lesson content
- Documents are supplementary attachments — PDFs, images, reference sheets
- Both are optional — they appear only when the teacher includes them in the lesson
- Maps are common in geography/travel courses; documents in research/practical courses
