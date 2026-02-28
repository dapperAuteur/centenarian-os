# Lesson 03: Adding Your First Item

**Course:** Mastering Equipment Tracking
**Module:** Managing Equipment
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

This lesson walks you through the equipment form — every field, what it's for, and how to fill it out. By the end, you'll have your first item in the system.

---

### Opening the Form

Navigate to `/dashboard/equipment/manage` and click **Add Item**. A modal opens with the equipment form.

---

### Required Fields

Only one field is required:

**Name** — what you call this item. Be specific enough to distinguish it from similar items. "Sony A7III" is better than "Camera."

---

### Optional Fields

**Category** — select from your category list, or leave as "None." You can always reassign later.

**Brand** — the manufacturer (e.g., "Sony", "Apple", "Trek").

**Model** — the specific model (e.g., "A7III", "MacBook Pro 16-inch", "Domane SL5").

**Serial Number** — for warranty claims, insurance, or theft reports.

**Condition** — a dropdown with five options:
- New
- Excellent
- Good
- Fair
- Poor

This is your subjective assessment. Update it later if the item degrades.

**Purchase Date** — when you bought or received the item.

**Purchase Price** — what you paid. This is the item's attributed portion — if you bought a bundle, enter what this specific item is worth, not the bundle total.

**Current Value** — what it's worth now. If you leave this blank on creation, it defaults to the purchase price. Valuations (covered in Lesson 05) will update this automatically.

**Warranty Expires** — the warranty end date, if applicable.

**Photo** — upload an image via the Cloudinary uploader. This appears on the hub card and detail page.

**Notes** — any free-text context you want to attach.

---

### Linking a Purchase Transaction

At the bottom of the form, there's a **Linked Purchase Transaction** field. This connects the equipment item to an existing transaction in your Finance module.

Type a vendor name or amount in the search field. Results show as: `Vendor · $Amount · Date`. Click a result to link it. A green pill appears showing the linked transaction — click the X to unlink.

This link is optional. You can add or change it later from the manage page.

---

### Saving the Item

Click **Save**. The item is created and appears in your equipment list. If you uploaded a photo, it will appear on the card. If not, you'll see the default Package icon.

---

### Editing and Retiring

Back on the manage page, each item row has three actions:

**Edit** (pencil icon) — reopens the form with current values. Change any field and save.

**Retire** (archive icon) — marks the item as inactive. Retired items disappear from the hub grid by default, but you can toggle **Show retired items** on the manage page to see them. Retired items show a "Retired" badge and are grayed out.

**Reactivate** (rotate icon) — appears on retired items. Click to bring the item back to active status.

**Delete** (trash icon) — permanently removes the item if it has no valuations or activity links. If it does, the delete converts to a soft-delete (retirement) instead.

---

### Example: Adding a Camera

Here's a complete example:

| Field | Value |
|-------|-------|
| Name | Sony A7III |
| Category | Camera |
| Brand | Sony |
| Model | ILCE-7M3 |
| Serial Number | SN-2024-A7III-001 |
| Condition | Excellent |
| Purchase Date | 2024-06-15 |
| Purchase Price | 1799.00 |
| Current Value | 1450.00 |
| Warranty Expires | 2026-06-15 |
| Notes | Body only, no kit lens |

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment/manage — click "Add Item"]

> [SCREENSHOT: Equipment form modal — callouts: Name (required), Category dropdown, Brand, Model, Serial Number, Condition dropdown]

> [SCREEN: Fill in Name = "Sony A7III", Category = "Camera", Brand = "Sony"]

> [SCREEN: Scroll down — show Purchase Date, Purchase Price, Current Value, Warranty Expires fields]

> [SCREEN: Fill in Purchase Price = 1799, Current Value = 1450]

> [SCREEN: Scroll to Linked Purchase Transaction — type "B&H" in the search — show search results appear]

> [SCREENSHOT: Transaction search results — callout: "Click a result to link it"]

> [SCREEN: Upload a photo via the Cloudinary uploader — show the preview appear]

> [SCREEN: Click Save — show the item appear in the manage list]

> [SCREENSHOT: Manage page with new item — callouts: Edit (pencil), Retire (archive), Delete (trash) icons]

> [SCREEN: Click the item card on the hub — show it navigates to the detail page]

---

## Key Takeaways

- Only Name is required — all other fields are optional but recommended
- Purchase Price is the attributed portion — not necessarily the full transaction total
- Current Value defaults to Purchase Price if left blank
- Link a purchase transaction to trace spending back to your Finance module
- Retire items to hide them from the hub without deleting data
- Hard delete only works if no valuations or activity links exist
