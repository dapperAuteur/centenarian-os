# Lesson 10: Archiving and Restoring

**Course:** Mastering the Planner
**Module:** Plan Maintenance
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Plans change. Goals get completed. Some goals get dropped. Milestones get superseded. After a few months of active planning, you'll accumulate items that are no longer relevant to your active work — but that you might not want to delete permanently.

The Archive system lets you remove completed or abandoned items from your active view without losing the data. Think of it as decluttering without throwing anything away.

---

### What Archiving Does

When you archive a roadmap, goal, or milestone, it:
- Is removed from your active view (the default view you see every day)
- Gets an `archived_at` timestamp and its status is set to "archived"
- All its children are moved with it (unless you choose to keep them)
- Is accessible in the "Show Archived" view
- Is permanently deleted after 30 days unless you restore it first

Archiving is not permanent. You have 30 days to change your mind. After that, the item and all its data are deleted automatically.

---

### The Archive vs. Delete Distinction

**Archive** — the item disappears from your active view but all data is preserved for 30 days. Recoverable.

**Delete** — permanent, immediate. Only available on archived items. Use delete when you're sure you don't need the data and want to clean up before the 30-day auto-deletion.

There's no direct delete from the active view — you must archive first, then delete. This two-step process prevents accidental data loss.

---

### How to Archive an Item

On the Roadmap page, each roadmap, goal, and milestone row has an **Archive** button (archive icon). Click it.

An archive confirmation modal opens showing:
- The item you're archiving
- How many children it has (goals inside a roadmap, milestones inside a goal, tasks inside a milestone)
- What will happen to those children

You have two options for children:

**Cascade archive** — archive the item and all its children. Use this when you're done with everything in this branch. Example: you've completed a fitness goal and all its milestones — archive the goal and cascade-archive all associated milestones and tasks.

**Move children** — reassign the children to another parent before archiving this item. Use this when the item is no longer needed but its children are still relevant. Example: a milestone that's been superseded, but the tasks under it are still valid and can move to a replacement milestone.

Choose your option and confirm. The item disappears from the active view.

---

### Viewing Archived Items

At the top of the Roadmap page, there's a **Show Archived** toggle. Click it to switch to the archived view.

In the archived view:
- All archived roadmaps, goals, and milestones are shown with their `archived_at` date
- Each item shows how many days until auto-deletion ("Auto-delete in 24 days")
- Each item has a **Restore** button (↻) and a **Delete** button (🗑️)

The archive count badge on the toggle button shows how many archived items you have across all levels.

---

### Restoring an Item

In the archived view, click **Restore** (↻) on any item. The item returns to your active view with its status reset to active. Its children (if they were cascade-archived with it) are also restored.

Restoring is useful when:
- You archived something prematurely
- A goal you deferred comes back into focus
- You realized mid-archive that you still need the data
- A roadmap you thought you were done with has become relevant again

---

### Archive Count Badges

The Show Archived toggle shows a badge count: the total number of archived items across all levels. This is a useful maintenance signal. If the badge shows "47", you have a lot of archived items that should probably be reviewed and either restored or permanently deleted.

A healthy planning practice: at the start of each quarter, review archived items. Restore anything that needs to come back. Delete anything you're sure you don't need. Keep the archive small and intentional.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/roadmap — show the active view with several items]

> [SCREEN: Click the Archive button (archive icon) on a milestone — archive confirmation modal opens]

> [SCREENSHOT: Archive modal with callouts: Item name, Child count, "Cascade archive" option, "Move children" option]

> [SCREEN: Select "Cascade archive" — click Confirm — milestone disappears from active view]

> [SCREEN: Click "Show Archived" toggle — archived view loads]

> [SCREENSHOT: Archived view showing the archived milestone — callouts: Archived date, "Auto-delete in X days", Restore button, Delete button]

> [SCREEN: Click Restore on the archived milestone — show it returning to the active view]

> [SCREEN: Archive it again — this time choose "Move children" — show the dropdown for selecting a new parent milestone]

> [SCREEN: Select the new parent — confirm — original milestone archived, children moved to new parent]

> [SCREEN: Show the archive count badge on the toggle — callout: "Total archived items across all levels"]

> [SCREEN: End on the active view — end lesson]

---

## Key Takeaways

- Archive removes items from the active view without deleting them — they're recoverable for 30 days
- Cascade archive = archive the item and all its children; Move children = reassign children, then archive
- Show Archived toggle switches to the archived view; badge shows total archived count
- Restore (↻) brings an item back to active; Delete (🗑️) permanently removes it immediately
- 30-day auto-deletion is the safety net — use the quarterly archive review to clean up
- No direct delete from the active view — must archive first, reducing accidental data loss
