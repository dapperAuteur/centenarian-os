# Lesson 13: Round Trips & Contact Locations

**Course:** Mastering Travel Tracking
**Module:** Advanced Trips
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Two features that simplify trip logging: round trips (so you don't have to log the same route twice) and contact locations (so your saved vendors and customers provide trip endpoints automatically).

---

### Round Trips

Toggle **Round Trip** on the trip form. When enabled:
- You enter the one-way distance only
- The system stores `distance_miles` as the one-way value
- CO2 calculations and summary stats automatically multiply by 2
- The trip displays as "12.5 mi (round trip)" instead of "12.5 mi"

This is useful for commutes, errands, and any trip where you return to the starting point.

The `is_round_trip` flag is stored on the trip record. You can toggle it on or off when editing an existing trip.

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
2. Create trip templates using those contacts
3. Toggle round trip on the template
4. Log daily trips in seconds: From Template → adjust date → save

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

> [SCREEN: Open the trip form — toggle Round Trip ON]

> [SCREENSHOT: Trip form with Round Trip toggle — callout: "Enter one-way distance; CO2 and totals auto-double"]

> [SCREEN: Enter a distance of 12.5 miles — save — show trip displayed as "12.5 mi (round trip)"]

> [SCREEN: Open a new trip form — click the destination field]

> [SCREEN: Type "Costco" — show the contact autocomplete dropdown with matching contacts]

> [SCREEN: Select "Costco" — show the location sub-select with "Main Store" and "Gas Station"]

> [SCREENSHOT: Contact location sub-select — callout: "Pick a specific location from the contact's saved addresses"]

> [SCREEN: Select "Main Store" — show the address auto-fill in the destination field]

---

## Key Takeaways

- Round Trip toggle: enter one-way distance, CO2 and totals auto-multiply by 2
- Contact Locations: select saved contacts with addresses as trip origins/destinations
- Contacts can have multiple locations — the sub-select lets you pick the right one
- Combine templates + round trips + contact locations for fastest logging
- Contact locations are managed in the Contacts module and shared across Travel and Planner
