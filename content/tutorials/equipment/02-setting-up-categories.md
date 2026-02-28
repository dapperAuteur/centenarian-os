# Lesson 02: Setting Up Categories

**Course:** Mastering Equipment Tracking
**Module:** Getting Started
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** linear → first CYOA crossroads after this lesson

---

## Narrator Script

Before you start adding equipment, take a moment to set up your categories. Categories are how you organize items by type — computers in one group, cameras in another, fitness gear in a third.

CentenarianOS seeds a set of default categories the first time you open the Equipment module. You can keep them, rename them, delete ones you don't need, and add new ones.

---

### Default Categories

The first time you access Equipment, these categories are created automatically:

| # | Category |
|---|----------|
| 1 | Computer |
| 2 | Camera |
| 3 | Microphone |
| 4 | Audio |
| 5 | Lighting |
| 6 | Fitness |
| 7 | Swag |
| 8 | Battery |
| 9 | Storage |
| 10 | Accessory |
| 11 | Other |

These are sorted by a `sort_order` field. You can change the order later.

---

### Managing Categories

Navigate to `/dashboard/equipment/manage` and click **Manage Categories**. A modal opens with:

**Add a category** — type a name in the input field and click **Add**. The new category gets the next sort_order value automatically.

**Existing categories** — listed below the add form. Each row shows the category name and a delete icon.

**Delete a category** — click the trash icon. This only works if no items are assigned to that category. If items exist, you'll see an error: "Cannot delete: N item(s) use this category. Reassign them first."

---

### Category Rules

- Names must be unique per user — you can't have two categories both called "Camera"
- Deleting a category fails if any equipment items reference it
- Optional fields: `icon` (a Lucide icon name) and `color` (hex code for badges) — these can be set via the API but aren't exposed in the manage modal yet
- Each category belongs only to your account — other users have their own independent category lists

---

### Choosing Good Categories

Think about how you'll filter your inventory. Good categories are:
- **Broad enough** to group 3+ items (e.g., "Audio" covers headphones, speakers, mixers)
- **Specific enough** to be meaningful when filtering (e.g., "Camera" is better than "Electronics" if you have 5 cameras and 2 laptops)
- **Action-oriented** if your gear serves a workflow (e.g., "Recording Studio", "Travel Kit", "Home Office")

You can always reassign items to different categories later without losing any data.

---

### What's Next

With your categories in place, you're ready to add your first item. The next lesson covers the full equipment form — every field, photos, and condition ratings.

After that, the course opens into CYOA navigation. You'll be able to jump to any topic: linking transactions, tracking valuations, activity links, or the summary dashboard.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment/manage — show the manage page]

> [SCREEN: Click "Manage Categories" — show the modal with default categories listed]

> [SCREENSHOT: Manage Categories modal — callouts: Add input field, "Add" button, Category list with delete icons]

> [SCREEN: Type a new category name (e.g., "Camping Gear") and click Add — show it appear in the list]

> [SCREEN: Try to delete a category that has items — show the error message "Cannot delete: N item(s) use this category"]

> [SCREEN: Delete an unused category — show it disappear from the list]

> [SCREEN: Close the modal — return to the manage page]

---

## Key Takeaways

- 11 default categories are seeded on first access (Computer, Camera, Microphone, Audio, etc.)
- Add categories via the Manage Categories modal — name must be unique per user
- Delete only works if no items reference the category — reassign items first
- Categories are per-user — each account has its own list
- Good categories balance breadth (grouping) with specificity (filtering)
