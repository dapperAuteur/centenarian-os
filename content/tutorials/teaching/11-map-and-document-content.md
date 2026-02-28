# Lesson 11: Creating Map & Document Lessons

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~7 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Academy supports two supplementary content types that appear alongside your lesson text: interactive maps and attached documents. This lesson shows you how to add both using the lesson editor.

---

### Adding Map Content

In the lesson editor, the **Map Content** field accepts a JSON object that defines what the MapViewer will display.

The map supports three element types:

**Markers** — labeled pins on the map. Each has a latitude, longitude, title, and description. Students click a marker to see its info popup.

**Polygons** — colored shaded regions. Define a set of coordinate pairs that form the shape, plus a border color, fill color, and label.

**Lines** — colored paths between coordinates. Useful for trade routes, trip paths, or migration patterns.

---

### Map Content Structure

```json
{
  "center": [latitude, longitude],
  "zoom": 6,
  "markers": [
    { "lat": 37.7749, "lng": -122.4194, "title": "San Francisco", "description": "Starting point" }
  ],
  "polygons": [
    {
      "coordinates": [[lat1, lng1], [lat2, lng2], [lat3, lng3], [lat4, lng4]],
      "color": "#3B82F6",
      "fillColor": "#3B82F620",
      "label": "Region Name"
    }
  ],
  "lines": [
    {
      "coordinates": [[startLat, startLng], [endLat, endLng]],
      "color": "#EF4444",
      "label": "Route Name"
    }
  ]
}
```

---

### Full Map Example: Ancient Trade Route Lesson

```json
{
  "center": [30.0444, 31.2357],
  "zoom": 5,
  "markers": [
    { "lat": 30.0444, "lng": 31.2357, "title": "Cairo, Egypt", "description": "Major trading hub — spices, textiles, and gold converged here" },
    { "lat": 36.8065, "lng": 10.1815, "title": "Tunis, Tunisia", "description": "Mediterranean port — connected North Africa to European markets" },
    { "lat": 33.8869, "lng": 35.5131, "title": "Beirut, Lebanon", "description": "Phoenician trading post — gateway between East and West" },
    { "lat": 41.0082, "lng": 28.9784, "title": "Istanbul, Turkey", "description": "Crossroads of continents — controlled the Bosphorus strait" }
  ],
  "polygons": [
    {
      "coordinates": [[31.0, 29.0], [31.0, 33.0], [29.0, 33.0], [29.0, 29.0]],
      "color": "#F59E0B",
      "fillColor": "#F59E0B20",
      "label": "Nile Delta Trading Zone"
    }
  ],
  "lines": [
    { "coordinates": [[30.0444, 31.2357], [33.8869, 35.5131]], "color": "#3B82F6", "label": "Cairo → Beirut (coastal route)" },
    { "coordinates": [[33.8869, 35.5131], [41.0082, 28.9784]], "color": "#10B981", "label": "Beirut → Istanbul (sea route)" },
    { "coordinates": [[30.0444, 31.2357], [36.8065, 10.1815]], "color": "#EF4444", "label": "Cairo → Tunis (overland route)" }
  ]
}
```

---

### Adding Documents

The **Documents** field accepts a JSON array of document objects. Each document has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | The Cloudinary URL (or any public URL) of the file |
| `title` | string | Yes | Document name shown to students |
| `description` | string | No | Brief explanation of the content |
| `source_url` | string | No | Link to the original source (attribution) |

---

### Document Example

```json
[
  {
    "url": "https://res.cloudinary.com/your-cloud/raw/upload/v1/academy/trade-route-worksheet.pdf",
    "title": "Trade Route Analysis Worksheet",
    "description": "Fill in the blank worksheet — identify trade goods, routes, and key cities from the lesson.",
    "source_url": null
  },
  {
    "url": "https://res.cloudinary.com/your-cloud/image/upload/v1/academy/ancient-map-1200ad.jpg",
    "title": "Historical Map: Mediterranean Trade (1200 AD)",
    "description": "Primary source — a reproduction of a medieval portolan chart showing major trade routes.",
    "source_url": "https://commons.wikimedia.org/wiki/File:Portolan_chart.jpg"
  }
]
```

---

### Uploading Documents

Documents are hosted on Cloudinary (same as images). Upload your file through the Cloudinary dashboard or media library, then copy the URL into the documents JSON.

Supported formats:
- **PDFs** — worksheets, reference guides, reading assignments
- **Images** — charts, diagrams, historical photos, infographics

The DocumentViewer renders PDFs as downloadable links and images as viewable galleries.

---

### Combining Map + Documents + Text

A single lesson can have all three: text content (markdown or Tiptap), map content, and documents. They render in this order on the lesson page:

1. Podcast links (if any)
2. Video/audio player (if applicable)
3. Text content
4. Map viewer
5. Document viewer
6. Discussion section

Design your lesson content to reference the map and documents in the text — "See the map below for the trade routes mentioned in this section" or "Download the worksheet to follow along."

---

## Screen Recording Notes

> [SCREEN: Open the lesson editor — scroll to the Map Content field]

> [SCREENSHOT: Map Content JSON field — callout: "Paste a JSON object with center, zoom, markers, polygons, lines"]

> [SCREEN: Paste the trade route map example — save the lesson]

> [SCREEN: Preview the lesson as a student — show the MapViewer with markers, lines, and polygon]

> [SCREEN: Click a marker — show the popup with title and description]

> [SCREEN: Return to the editor — scroll to the Documents field]

> [SCREENSHOT: Documents JSON field — callout: "Array of objects with url, title, description, source_url"]

> [SCREEN: Paste the document example — save — preview showing document links below the map]

---

## Key Takeaways

- Map Content: JSON object with center, zoom, markers, polygons, and lines
- Documents: JSON array with url, title, description, and optional source_url
- Upload files to Cloudinary and paste the URL into the documents JSON
- A single lesson can combine text + map + documents + audio/video
- Reference maps and documents in your text content so students know to scroll down
