# Lesson 09: Saved Contacts & Vendor Autocomplete

**Course:** Mastering Your Finances
**Module:** Contacts
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Every time you log a transaction, you type a vendor name. If you buy from the same places regularly, that gets repetitive. Saved Contacts solves this — save your vendors once, and the autocomplete fills in the details for you.

---

### What Are Saved Contacts?

A saved contact is a reusable vendor, customer, or location in your contacts directory. Each contact has:

- **Name** — the vendor or customer name (e.g., "Costco", "Amazon", "John's Auto")
- **Contact Type** — vendor, customer, or location
- **Default Category** — the budget category this vendor typically falls under (e.g., Costco → Groceries)
- **Notes** — any context you want to remember
- **Use Count** — how many times you've selected this contact (auto-incremented)

---

### The ContactAutocomplete Component

When you create a transaction and start typing in the Vendor field, the ContactAutocomplete component kicks in:

1. Type 2+ characters
2. A dropdown appears showing matching saved contacts, sorted by use count (most used first)
3. Click a contact to select it
4. The vendor name auto-fills
5. If the contact has a `default_category_id`, the transaction category auto-fills too

This means selecting "Costco" from the autocomplete automatically sets the category to "Groceries" — no extra clicks.

---

### Saving a New Contact

If you type a vendor name that doesn't match any saved contact, you'll see a **"Save?"** prompt. Click it to save the vendor as a new contact. You can set the default category during this process.

The save operation is an upsert — if a contact with the same name and type already exists, the use count increments instead of creating a duplicate.

---

### Managing Contacts

Navigate to the contacts management area to:

- **Edit** — change the name, type, default category, or notes
- **Delete** — permanently remove the contact
- **Add locations** — attach sub-addresses to a contact (covered in the Travel tutorial)

Contacts are shared across modules:
- **Finance** — vendor autocomplete on transactions
- **Travel** — trip origin/destination from contact locations
- **Planner** — task contacts and locations

---

### Contact Locations

Each contact can have multiple locations (sub-addresses). For example:
- **Costco** → "Main Store" (123 Main St), "Gas Station" (parking lot pump)
- **Client: Acme Corp** → "HQ" (456 Market St), "Warehouse" (789 Industrial Blvd)

In the Finance module, locations aren't used directly — the vendor name and category are what matter. But in Travel and Planner, locations are used for trip endpoints and task locations.

---

## Screen Recording Notes

> [SCREEN: Navigate to the transaction creation form — start typing "Cost" in the vendor field]

> [SCREEN: Show the autocomplete dropdown with "Costco" appearing, sorted by use count]

> [SCREENSHOT: ContactAutocomplete dropdown — callout: "Matching contacts sorted by use count"]

> [SCREEN: Click "Costco" — show the vendor name auto-fill AND the category auto-fill to "Groceries"]

> [SCREENSHOT: Transaction form — callout: "Default category auto-filled from saved contact"]

> [SCREEN: Type a new vendor name "New Pizza Place" — show the "Save?" prompt]

> [SCREEN: Click Save — set default category to "Dining" — show the contact saved]

> [SCREEN: Navigate to contacts management — show the list with use counts]

---

## Key Takeaways

- Saved Contacts store vendor/customer names with default budget categories
- ContactAutocomplete: type 2+ chars → dropdown → click to auto-fill vendor + category
- "Save?" prompt appears for new vendors — upserts to avoid duplicates
- Contacts are shared across Finance, Travel, and Planner modules
- Contacts can have multiple locations (sub-addresses) used primarily in Travel and Planner
