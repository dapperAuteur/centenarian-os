# Lesson 13: Round Trips & Contact Locations

**Course:** Mastering Travel Tracking
**Module:** Advanced Trips
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Two features that simplify trip logging: round trips (so you don't have to enter the way back) and contact locations (so your saved vendors and customers provide trip endpoints automatically).

---

### Round Trips

Tick **Round trip (return to start)** in the Add Trip form. When your last stop is not your starting point:
- You enter the way there only
- When you save, the form adds a return leg back to your start, using the outbound distance, time, and cost added together
- The line under the checkbox shows what will be added, for example "Return leg auto-added: 12.5 mi · 25 min"
- The trip is saved as a route with a leg each way, so distance, time, cost, and CO2 count both directions

If you came back a different way, edit the route afterwards and change the return leg. If your last stop already is your starting point (a loop, such as a bike ride from home and back), nothing is added.

This is useful for commutes, errands, and any trip where you return to the starting point. Save it as a template (Lesson 12) and the return leg's miles and minutes are saved with it.

Some trips have one leg with a round trip flag instead: trips logged from a single-leg round-trip template, and older trips logged before Add Trip added return legs. The trip list shows their distance and time doubled, and Edit Trip shows "Round trip (distance counted both ways)". A template that ends where it starts (a loop) never logs a flagged trip, so its miles are not doubled.

---

### Contact Locations

The Travel module integrates with the Saved Contacts system. When you enter an origin or destination, you can select from your saved contacts' locations instead of typing an address manually.

**How it works:**

1. In the trip form, click the origin or destination field
2. Start typing a contact name
3. The ContactAutocomplete component shows matching contacts
4. If the contact has locations (sub-addresses), a location dropdown appears
5. Select the location — it fills in the address automatically

---

### Setting Up Contact Locations

Contact locations are managed from the Contacts module:

1. Navigate to `/api/contacts` or the contacts management area
2. Create or edit a contact
3. Add locations with: label, address, lat/lng (optional), and notes
4. Set one as the default location

Each contact can have multiple locations. For example:
- **Costco** → "Main Store" (123 Main St), "Gas Station" (123 Main St, Pump Area)
- **Office** → "Downtown HQ" (456 Market St), "Satellite Office" (789 Oak Ave)

---

### Contact Locations in Trip Logging

When you select a contact with locations as your origin or destination:
- If the contact has a default location, it auto-fills
- If the contact has multiple locations, a sub-select appears so you can pick the right one
- The selected location's label and address are stored with the trip

This means you never have to retype "456 Market St" — just pick "Office → Downtown HQ."

---

### Combining Round Trips + Contact Locations

The most efficient workflow:
1. Save your frequently visited places as contact locations
2. Log the trip once in Add Trip using those contacts, with Round trip ticked
3. Tick "Save as reusable template" before you save
4. Log it again in seconds with Quick log or Quick Re-log, or use Load from template, adjust the date, and save

---

### Example Contact Location Data

```json
{
  "contact": {
    "name": "Costco",
    "contact_type": "vendor",
    "default_category_id": "cat-groceries"
  },
  "locations": [
    {
      "label": "Main Store",
      "address": "123 Main St, San Francisco, CA 94105",
      "lat": 37.7899,
      "lng": -122.3969,
      "is_default": true,
      "notes": "Enter from 2nd St"
    },
    {
      "label": "Gas Station",
      "address": "123 Main St, San Francisco, CA 94105",
      "lat": 37.7895,
      "lng": -122.3972,
      "is_default": false,
      "notes": "Pump area on north side"
    }
  ]
}
```

---

## Screen Recording Notes

> [SCREEN: Open Add Trip — enter Home → Office, 12.5 miles, 25 minutes — tick Round trip]

> [SCREENSHOT: Add Trip with Round trip ticked — callout: "Return leg auto-added: 12.5 mi · 25 min"]

> [SCREEN: Save — show the route with two legs and a 25.0 mi total]

> [SCREEN: Open a new trip form — click the destination field]

> [SCREEN: Type "Costco" — show the contact autocomplete dropdown with matching contacts]

> [SCREEN: Select "Costco" — show the location sub-select with "Main Store" and "Gas Station"]

> [SCREENSHOT: Contact location sub-select — callout: "Pick a specific location from the contact's saved addresses"]

> [SCREEN: Select "Main Store" — show the address auto-fill in the destination field]

---

## Key Takeaways

- Round trip in Add Trip: enter the way there; a return leg is added when you save, so totals count both ways
- Contact Locations: select saved contacts with addresses as trip origins/destinations
- Contacts can have multiple locations — the sub-select lets you pick the right one
- Combine templates + round trips + contact locations for fastest logging
- Contact locations are managed in the Contacts module and shared across Travel and Planner
