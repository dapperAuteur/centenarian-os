# Lesson 04: Linking Purchase Transactions

**Course:** Mastering Equipment Tracking
**Module:** Managing Equipment
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

One of Equipment Tracking's strongest features is its connection to the Finance module. When you link an equipment item to the transaction where you bought it, you create a traceable line from "I spent money" to "I own this thing."

This lesson covers how the link works, when to use it, and how to handle common scenarios like bundle purchases.

---

### How the Link Works

Every equipment item has an optional `transaction_id` field. This is a direct reference to a record in your `financial_transactions` table. It doesn't move money, create a new transaction, or change any financial data. It's a pointer — a way to say "this item came from that purchase."

---

### Linking During Creation

When you add a new item (Lesson 03 covered the form), the **Linked Purchase Transaction** field at the bottom of the form lets you search your existing transactions.

Type a keyword — the vendor name, an amount, or a date fragment. Results appear as:

```
Vendor · $Amount · Date
```

Click a result. A green pill appears confirming the link. Click the X on the pill to remove it before saving.

---

### Linking After Creation

If you skip the link during creation, you can add it later:

1. Go to `/dashboard/equipment/manage`
2. Click the edit icon on the item
3. Scroll to **Linked Purchase Transaction**
4. Search and select the transaction
5. Save

You can also change or remove a link the same way.

---

### One Item, One Transaction

Each equipment item links to at most one transaction. But multiple items can link to the same transaction. This is intentional for bundle purchases.

**Example:** You buy a camera kit for $2,500 that includes a body ($1,800), a lens ($500), and a bag ($200). In Finance, you have one transaction for $2,500 at B&H Photo. In Equipment, you create three items — each with its own `purchase_price` reflecting its attributed share — and all three link to the same $2,500 transaction.

The `purchase_price` on the equipment item is independent of the transaction total. It represents what that specific item is worth to you within the purchase.

---

### Why Link at All?

Linking serves three purposes:

**Audit trail** — when you look at a large expense in Finance, you can trace it to the specific items you received.

**ROI calculation** — the Equipment Summary dashboard calculates return on investment by comparing purchase costs to revenue earned from items (via activity links to income transactions). The purchase transaction link helps verify the cost side.

**Depreciation context** — seeing the original purchase alongside current value and valuation history gives you the full financial lifecycle of an item.

---

### What If the Transaction Doesn't Exist Yet?

If you haven't logged the purchase in Finance yet, skip the link during equipment creation. Go to `/dashboard/finance`, log the transaction, then come back and edit the equipment item to add the link.

The link is always optional. Equipment tracking works fine without it — you just lose the Finance cross-reference.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/equipment/manage — click edit on an existing item]

> [SCREEN: Scroll to Linked Purchase Transaction — show the search field]

> [SCREEN: Type a vendor name — show results appearing]

> [SCREENSHOT: Transaction search results — callout: "Results show Vendor · $Amount · Date"]

> [SCREEN: Click a result — show the green pill appear with the linked transaction]

> [SCREENSHOT: Linked transaction pill — callout: "Click X to unlink"]

> [SCREEN: Save the item — show success]

> [SCREEN: Navigate to /dashboard/finance — find the same transaction — show how it connects]

> [SCREEN: Navigate back to the equipment detail page — show the purchase info section]

---

## Key Takeaways

- Each equipment item can link to one financial transaction via the edit form
- Multiple items can link to the same transaction (bundle purchases)
- Purchase Price on equipment is the attributed portion — independent of the transaction total
- The link is optional — skip it if the transaction isn't logged yet, add it later
- Links enable audit trails, ROI calculations, and depreciation context in the summary
