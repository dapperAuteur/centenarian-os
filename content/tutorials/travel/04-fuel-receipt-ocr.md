# Lesson 04: Fuel Receipt OCR — Photo to Data

**Course:** Mastering Travel Tracking
**Module:** Fuel Logs
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

In the last lesson, you learned how to manually enter a fuel fill-up. That works well, but there's a faster path: photograph your receipt and let the AI read it for you.

CentenarianOS uses Gemini Vision — Google's AI model — to extract key data from fuel receipts. You upload a photo, the AI reads the odometer, gallons, price, and trip meter readings, and pre-fills the form for you. You review, adjust if needed, and save.

This lesson covers the OCR workflow from start to finish, including tips for getting reliable results.

---

### When to Use OCR vs. Manual Entry

OCR is best when:
- You have a clear photo of your receipt
- The receipt shows all the data: odometer, gallons, price, cost
- You're logging in real time at the pump

Manual entry is better when:
- You don't have a receipt photo
- The receipt is faded, crumpled, or partially obscured
- You need to log a historical fill-up from memory or a note

Most people end up using OCR 90% of the time once they get the hang of it.

---

### Opening the OCR Tool

Navigate to `/dashboard/travel/fuel`. Click **Log Fill-Up**, then look for the **Scan Receipt** tab or button at the top of the form. Clicking it switches the form to OCR mode.

You'll see an image upload area. You can upload up to **four images** per scan — useful if your receipt is long and you need multiple shots to capture everything.

---

### Taking a Good Photo

Before we walk through the upload, a quick word on photo quality — because this is where most people run into issues.

**Lighting matters.** A receipt photographed in bright, even light scans much better than one shot in dim or harsh overhead lighting. Natural light near a window is ideal.

**Fill the frame.** Get close enough that the receipt text fills most of your camera frame. Don't shoot the entire dashboard from three feet away with the receipt somewhere in the middle.

**Flat surface.** Lay the receipt flat on a contrasting surface — a dark phone case or table works well against the white paper.

**Check for glare.** Gas station lighting causes glare on shiny thermal receipts. Tilt the receipt slightly until the glare moves off the text before shooting.

Four images is the maximum, but for a typical fill-up receipt, one clear shot is enough. Use multiple images only if the receipt is too long to capture in one frame.

---

### Uploading and Scanning

Click or drag your image into the upload area. You'll see a thumbnail of the uploaded image. If you have multiple images, upload them all before clicking **Scan**.

Click the **Scan Receipt** button. This sends your images to Gemini Vision. The scan typically takes 5–10 seconds.

When it finishes, the form fields will auto-populate with the extracted data:
- Odometer reading
- Trip A (if visible on receipt)
- Trip B (if visible on receipt)
- Gallons pumped
- Price per gallon
- Total cost
- Calculated MPG (if the previous odometer reading is available)

---

### Reviewing the Extracted Data

**Always review before saving.** The AI is accurate most of the time, but it can occasionally misread a digit — especially on faded or wrinkled receipts. A misread in the odometer (say, 42,710 read as 42,170) will throw off your MPG calculation for that entry.

Check each field against the receipt. If something looks off, tap into that field and correct it. Once everything looks good, click **Save** — same as manual entry.

---

### What If the Scan Fails?

If the AI can't extract reliable data from your photo, it will either return empty fields or show a partial extraction with low confidence. In that case:
- Try a better-lit, closer photo
- Or fall back to manual entry — it only takes 30 seconds

OCR quality improves with better input. If you're consistently getting poor results, the issue is almost always the photo rather than the model.

---

### Gas Station Pump Screens vs. Paper Receipts

Some gas stations don't print receipts (or the printer is out of paper). If you have a pump screen showing your total and gallons, you can photograph that instead — the AI can read screen text too. Results are slightly less reliable than paper, but usually workable.

Alternatively, if your vehicle has a digital Trip A readout visible through the window, you can photograph that for the odometer component and enter the rest manually.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/travel/fuel — click "Log Fill-Up"]

> [SCREEN: Inside the form, click the "Scan Receipt" tab or button to switch to OCR mode]

> [SCREENSHOT: OCR upload area with upload zone labeled — point out the "up to 4 images" note]

> [SCREEN: Drag or click to upload a sample receipt photo (prepare a clear example receipt photo ahead of time)]

> [SCREENSHOT: Uploaded thumbnail appearing in the upload area]

> [SCREEN: Click "Scan Receipt" — show loading spinner for 5–10 seconds]

> [SCREEN: Form fields auto-populate — show the filled values in Odometer, Gallons, Price/Gallon, Total]

> [SCREENSHOT: Filled form with callout highlighting "AI extracted these values — review before saving"]

> [SCREEN: Click into the Odometer field and show correcting a digit if needed — type correction]

> [SCREEN: Click Save — entry appears in fuel log history]

> [SCREENSHOT: Fuel log list with the new OCR-logged entry, MPG column populated]

> [SCREEN: Try a second scan with a deliberately blurry/poor image to show failure behavior — fields stay empty or partial]

> [SCREEN: Show the fallback: click the "Manual Entry" tab and enter data by hand]

---

## Key Takeaways

- OCR mode extracts odometer, gallons, price, and trip meter readings from a receipt photo
- Up to 4 images per scan — use multiple only for long receipts
- Always review auto-extracted values before saving — check the odometer especially
- Good photo = flat receipt, good lighting, close up, no glare
- If OCR fails, fall back to manual entry on the same form
