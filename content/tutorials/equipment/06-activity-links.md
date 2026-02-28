# Lesson 06: Cross-Module Activity Links

**Course:** Mastering Equipment Tracking
**Module:** Connections
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Equipment doesn't exist in a vacuum. You take your camera on a road trip. You use your laptop for a focus session. You bring your camping gear on a hiking trip logged via Garmin. Activity Links let you connect equipment items to records in any other CentenarianOS module.

---

### What Are Activity Links?

An activity link is a bidirectional connection between two records in different modules. When you link your camera to a road trip, the camera's detail page shows the trip, and the trip's detail page shows the camera.

The system supports links between any combination of these entity types:

- Task
- Trip
- Route
- Transaction
- Recipe
- Fuel Log
- Maintenance
- Workout
- Equipment

---

### The ActivityLinker Component

On the equipment detail page (`/dashboard/equipment/[id]`), scroll to the **Linked Activities** section. This is the ActivityLinker component.

**Existing links** appear as color-coded pills. Each pill shows:
- The linked entity type (e.g., "trip", "transaction")
- The display name (e.g., "SF to Vegas", "$1,799 at B&H Photo")
- An X button to remove the link

**Adding a link:**
1. Click **+ Link**
2. Select an entity type from the dropdown (e.g., "trip")
3. Type a search term in the search field
4. Click the search icon or press Enter
5. Results appear — click one to create the link
6. The new pill appears immediately
7. Click **Cancel** to collapse the add UI

---

### Common Equipment Links

Here are typical links you might create:

| Equipment | Linked To | Why |
|-----------|-----------|-----|
| Camera | Trip (road trip) | Document which gear traveled where |
| Laptop | Task (work project) | Track tool usage per project |
| Bike | Workout (cycling) | Connect fitness gear to performance data |
| Camping stove | Recipe (camp meal) | Link cooking gear to what you made |
| Car mount | Maintenance (dash cam install) | Connect accessories to service events |
| Guitar | Transaction (gig payment) | Tie equipment to income for ROI |

---

### Links and ROI

The Equipment Summary dashboard (Lesson 07) calculates ROI by finding income transactions linked to your equipment via activity links. If your camera is linked to a "$500 photography gig" income transaction, that $500 counts as attributed revenue.

```
ROI = ((Attributed Revenue - Purchase Price) / Purchase Price) × 100
```

So linking equipment to income transactions directly affects the ROI number on your summary page.

---

### Example Activity Link Data

Here's what an activity link record looks like in the database:

```json
{
  "id": "link-001",
  "source_type": "equipment",
  "source_id": "equip-a7iii",
  "target_type": "trip",
  "target_id": "trip-sf-vegas",
  "created_at": "2026-02-15T10:30:00Z"
}
```

Links are bidirectional — this link appears on both the equipment detail page and the trip detail page.

---

### Removing a Link

Click the X on any link pill. The link is deleted immediately. This doesn't affect either record — it only removes the connection between them.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment/[id] — scroll to Linked Activities section]

> [SCREENSHOT: ActivityLinker component — callouts: Existing link pills (color-coded), "+ Link" button]

> [SCREEN: Click "+ Link" — show the add UI expand: entity type dropdown, search field]

> [SCREEN: Select "trip" from the dropdown — type "Vegas" in search — show results]

> [SCREEN: Click a result — show the new pill appear in the link list]

> [SCREENSHOT: Updated links — callout: "New trip link added, showing on both equipment and trip detail pages"]

> [SCREEN: Click X on a link pill — show it removed]

> [SCREEN: End on the equipment detail page]

---

## Key Takeaways

- Activity links connect equipment to any other module: trips, tasks, workouts, transactions, recipes, maintenance, etc.
- Links are bidirectional — they appear on both sides
- Use the ActivityLinker on the equipment detail page: + Link → select type → search → click result
- Linking equipment to income transactions enables ROI calculation in the summary
- Removing a link doesn't affect either record — it only deletes the connection
