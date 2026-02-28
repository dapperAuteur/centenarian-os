# Lesson 12: Task Contacts & Locations

**Course:** Mastering the Planner
**Module:** Connections
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Tasks don't just have dates and descriptions — they can also have a who and a where. Task contacts and locations let you assign a vendor, customer, or place to any task, turning your planner into a context-aware schedule.

---

### Assigning a Contact to a Task

When editing a task (via the EditTaskModal), you'll see a **Contact** field. This uses the same ContactAutocomplete component from the Finance module:

1. Start typing a contact name
2. Select from the dropdown of saved contacts
3. The contact is assigned to the task

The contact appears on the task card as additional context — you can see at a glance "Costco" or "Dr. Smith" alongside the task description.

---

### Assigning a Location to a Task

If the selected contact has locations (sub-addresses), a **Location** dropdown appears below the contact field. Select a specific location:

- "Costco → Main Store (123 Main St)"
- "Client: Acme → Downtown HQ (456 Market St)"

The location is stored as `tasks.location_id`, referencing the `contact_locations` table.

If the contact has only one location, it may auto-select. If the contact has no locations, the location field doesn't appear.

---

### Why Assign Contacts and Locations?

**Context on your schedule** — when reviewing your daily planner, seeing "Meet with Acme Corp at Downtown HQ" is more useful than just "Client meeting."

**Cross-module tracing** — the same contacts and locations used in Finance (vendor autocomplete) and Travel (trip endpoints) appear here. This means "Costco" in your planner, your transactions, and your trips all reference the same contact record.

**Future analysis** — task contacts let you see patterns: how often you visit a vendor, which locations you frequent, and how contacts relate to your time allocation.

---

### Managing Contacts on Tasks

- **Change contact** — edit the task, clear the current contact, select a new one
- **Remove contact** — edit the task, clear the contact field, save
- **Contact with no locations** — only the contact name is stored; no location sub-select
- **New contacts** — if the contact doesn't exist, the "Save?" prompt lets you create it inline

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/planner — click a task to open EditTaskModal]

> [SCREEN: Scroll to the Contact field — start typing a contact name]

> [SCREENSHOT: ContactAutocomplete in task modal — callout: "Same contact system used in Finance and Travel"]

> [SCREEN: Select a contact — show the Location dropdown appear with sub-locations]

> [SCREEN: Select a location — save the task]

> [SCREEN: Show the task card on the planner with the contact and location displayed]

---

## Key Takeaways

- Tasks can have an assigned contact (vendor/customer/location) via ContactAutocomplete
- If the contact has locations, a sub-select lets you pick a specific address
- Same contacts used across Finance (vendors), Travel (trip endpoints), and Planner (tasks)
- Contacts add context to your schedule and enable cross-module tracing
- Create new contacts inline with the "Save?" prompt
