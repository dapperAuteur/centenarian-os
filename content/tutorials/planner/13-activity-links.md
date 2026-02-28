# Lesson 13: Cross-Module Activity Links

**Course:** Mastering the Planner
**Module:** Connections
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Activity links let you connect a task to records in other modules — a trip, a transaction, a piece of equipment, a workout, or a recipe. This lesson covers how to create and manage activity links from the task edit modal.

---

### What Are Activity Links?

An activity link is a bidirectional connection between two records in different modules. When you link a task to a trip, the task shows the trip and the trip shows the task. Neither record is modified — the link is just a cross-reference.

Supported entity types:
- Task ↔ Trip
- Task ↔ Route (multi-stop)
- Task ↔ Transaction
- Task ↔ Equipment
- Task ↔ Recipe
- Task ↔ Fuel Log
- Task ↔ Maintenance
- Task ↔ Workout

---

### Creating Activity Links on Tasks

In the EditTaskModal, scroll to the **Linked Activities** section. This uses the ActivityLinker component:

1. Click **+ Link**
2. Select an entity type from the dropdown (e.g., "trip")
3. Type a search term
4. Click the search icon or press Enter
5. Click a result to create the link
6. A color-coded pill appears showing the linked item

You can add multiple links to different entity types.

---

### Reading Activity Links

Each link pill shows:
- Entity type label (e.g., "trip", "transaction", "equipment")
- Display name (e.g., "SF to Vegas", "$1,799 at B&H Photo", "Sony A7III")
- An X button to remove the link

The display name is resolved from the linked record — you see the trip name, transaction vendor + amount, or equipment name.

---

### Common Task Links

| Task | Linked To | Purpose |
|------|-----------|---------|
| "Buy camera gear" | Transaction ($1,799 at B&H) | Track purchase spend |
| "Road trip prep" | Trip (SF to Vegas) | Connect planning to execution |
| "Bike maintenance" | Equipment (Trek Domane) + Maintenance record | Full equipment lifecycle |
| "Meal prep Sunday" | Recipe (Chicken Stir Fry) | Connect planning to cooking |
| "Client meeting" | Transaction (Invoice #45) | Connect task to income |

---

### Removing Links

Click the X on any link pill. The connection is removed immediately. Neither the task nor the linked record is affected — only the cross-reference is deleted.

---

### Activity Links Across the Platform

Activity links aren't just for tasks. The same system works on:
- Equipment detail pages (Lesson 06 in the Equipment course)
- Trip detail pages
- Any module with an ActivityLinker component

All links are bidirectional — creating a link from a task to a trip also makes that link visible on the trip's detail page.

---

## Screen Recording Notes

> [SCREEN: Open EditTaskModal on a task — scroll to Linked Activities]

> [SCREENSHOT: ActivityLinker in task modal — callouts: "+ Link" button, entity type dropdown, search field]

> [SCREEN: Click "+ Link" — select "trip" — search "Vegas"]

> [SCREEN: Click a result — show the link pill appear]

> [SCREEN: Add another link: select "equipment" — search "camera" — click result]

> [SCREENSHOT: Task with two activity links — callout: "Trip and equipment linked to this task"]

> [SCREEN: Click X on a link — show it removed]

> [SCREEN: Navigate to the linked trip — show the task appearing on the trip's detail page]

---

## Key Takeaways

- Activity links connect tasks to trips, transactions, equipment, recipes, workouts, and more
- Use the ActivityLinker in EditTaskModal: + Link → select type → search → click result
- Links are bidirectional — visible on both the task and the linked record
- Display names are auto-resolved (trip names, transaction vendors, equipment names)
- Removing a link deletes only the cross-reference, not the underlying records
