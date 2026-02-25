# Lesson 02: Creating Your First Gem

**Course:** Mastering Coach & Gems
**Module:** Gem Setup
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Before you can use the Coach, you need at least one Gem. This lesson walks through the Gem Manager, the creation form, and what each field actually does.

---

### The Gem Manager

Navigate to `/dashboard/gems`. This is the Gem Manager — the central hub for all your AI personas.

If you haven't created any Gems yet, you'll see an empty state with a **Create Your First Gem** button. Once you have Gems, they're listed as cards showing the name, description, and a preview of the first 400 characters of the system prompt.

---

### Creating a New Gem

Click **New Gem** (or "Create Your First Gem" on the empty state). A modal opens with three fields.

---

### Field 1: Name

The name you'll use to identify this Gem when selecting it in the Coach. It appears in the dropdown selector and in your session history.

Good names are short and specific: **"Nutrition Auditor"**, **"Recovery Coach"**, **"Longevity Strategist"**, **"Training Programmer"**, **"Writing Editor"**. Avoid generic names like "AI Coach" — that tells you nothing about which Gem to use for a given conversation.

---

### Field 2: Description

A short explanation of what this Gem does. This field is for your reference only — the AI never sees it. Use it to remind yourself which conversations belong here.

Examples:
- "Evaluates my meals and nutrition logs against longevity principles. Harsh and direct."
- "Designs periodized training blocks. Knows my injury history."
- "Helps me think through business decisions with an operator's lens."

---

### Field 3: System Prompt

This is the most important field. The system prompt is sent to the AI at the start of every message in every session with this Gem. It defines the AI's persona, knowledge base, constraints, and style.

A system prompt can be as short as two sentences or as long as several paragraphs. Longer is not always better — a focused, specific prompt often produces more consistent results than an exhaustive one.

The field uses a monospace font because you're writing instructions, not prose. Take your time with it. The quality of your Gem is almost entirely determined by the quality of this field.

For guidance on writing effective system prompts, see Lesson 03.

---

### Saving the Gem

Click **Create Gem**. The modal closes and the new Gem appears in the Gems list.

If either the Name or System Prompt field is empty, the form won't submit — both are required. Description is optional.

---

### Editing a Gem

Click **Edit** on any Gem card. The same modal opens with the existing values pre-filled. Update any field and click **Save Changes**.

One important note: if you edit a Gem's system prompt, that change takes effect immediately for any new message in any session — including sessions you resume. The system prompt is re-sent fresh with every API call, so the updated prompt applies going forward, even in an ongoing conversation. This means you can improve a Gem's behavior mid-engagement.

---

### Deleting a Gem

Click the **trash icon** on any Gem card. A confirmation prompt appears. Deleting a Gem does not delete its associated sessions — your conversation history is preserved. However, sessions that used the deleted Gem will no longer have a functioning Gem to continue with.

---

### How Many Gems to Create

Start with 2–3 Gems that cover your most frequent coaching needs. You'll get a feel for what system prompt quality produces good conversations. Add Gems as you identify new recurring use cases.

Most users find that 4–8 Gems covers 95% of their needs. For Gem ideas suited to longevity and performance goals, see Lesson 07.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/gems — show the Gems list (or empty state)]

> [SCREEN: Click "New Gem" — modal opens]

> [SCREENSHOT: Gem creation modal — callouts: Name field, Description field, System Prompt textarea (monospace, tall), Create Gem button, Cancel button]

> [SCREEN: Type "Nutrition Auditor" in Name]

> [SCREEN: Type "Reviews my meals and eating patterns against longevity nutrition science. Direct feedback." in Description]

> [SCREEN: Type a system prompt in the textarea — use: "You are a precision nutrition coach with expertise in longevity-focused eating patterns. The user will describe meals, food choices, and nutrition questions. Evaluate everything against evidence-based longevity nutrition principles: protein adequacy, anti-inflammatory foods, metabolic health, and sustainable eating patterns. Be specific and direct. Don't soften criticism — the user wants accurate feedback, not validation. When you identify a problem, name it clearly and suggest a specific correction."]

> [SCREENSHOT: Filled modal — callouts: All three fields populated, System prompt in monospace showing the full text]

> [SCREEN: Click "Create Gem" — modal closes — Gem appears in the list]

> [SCREENSHOT: Gems list showing the new Gem card — callouts: Name, Description, System prompt snippet at bottom of card]

> [SCREEN: Click Edit on the Gem — show pre-filled modal — make a small change — click Save Changes]

> [SCREEN: End on the Gems Manager with the new Gem visible — end lesson]

---

## Key Takeaways

- Gem Manager at `/dashboard/gems` — create, edit, delete AI personas
- Three fields: Name (your label), Description (your reference only), System Prompt (defines AI behavior)
- Both Name and System Prompt are required; Description is optional
- System prompt is sent fresh with every API call — edits take effect immediately for all future messages
- Deleting a Gem preserves its conversation history
- Start with 2–3 Gems; expand as you identify recurring use cases
