# Lesson 01: Welcome to Coach & Gems

**Course:** Mastering Coach & Gems
**Module:** Introduction
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Generic AI assistants are useful. A custom AI that's been specifically designed to think like a longevity-focused nutrition coach, or a performance-oriented recovery specialist, or a demanding writing editor — that's something different.

Coach & Gems is CentenarianOS's AI conversation module. Instead of a single generic chatbot, you build a library of purpose-built AI personas called Gems. Each Gem has a specific focus, a defined expertise, and a system prompt that shapes every response it gives you. The Coach is where you have conversations with them.

---

### Gems: Custom AI Personas

A Gem is a configured AI persona. You define three things when you create one:

**Name** — What you call this Gem. "Longevity Strategist", "Nutrition Auditor", "Recovery Coach", "Writing Editor". The name appears in your Gem selector and session history.

**Description** — A short summary of what this Gem does. Helps you remember which Gem to use for which type of conversation. Not seen by the AI — it's for your reference.

**System prompt** — The core instruction that defines the AI's behavior for every conversation with this Gem. This is what makes a Gem useful: a well-written system prompt turns Gemini into a focused, expert-level advisor for a specific domain.

You can create as many Gems as you want. Most users settle on 4–8 that cover their primary coaching needs.

---

### Coach: The Conversation Interface

Navigate to `/dashboard/coach`. The page has two sections:

**The sidebar (left):**
- A **New Chat** button
- A **Gem selector** dropdown — choose which Gem to chat with
- A **History** panel — your past sessions listed chronologically by first message

**The main chat area (right):**
- The conversation history for the current session
- A message input at the bottom with a Send button (or press Enter to send; Shift+Enter for a new line)

---

### How Gems and Coach Connect

When you start a new session, you select a Gem. That Gem's system prompt is sent to the AI with every message in that session — it defines the AI's persona, expertise, and behavior for the entire conversation.

Once a session starts, the Gem is locked to that session. If you want to switch to a different Gem, start a New Chat. This is intentional: changing AI persona mid-conversation would break the context and produce inconsistent responses.

---

### What Powers the AI

Every conversation is powered by **Gemini 2.5 Flash** — Google's fast, capable multimodal model. The full conversation history is included in every request, which means the AI maintains genuine multi-turn context: it remembers what you said three messages ago without you having to repeat yourself.

---

### When to Use Coach vs. Other AI Features in the System

The weekly review (`/dashboard/weekly-review`) uses Gemini to generate a data-driven coaching summary based on your logged metrics. That's automated.

The Coach is interactive — it's for real-time dialogue, iterative problem solving, and ongoing advisory relationships. You ask questions, get answers, push back, refine, and build on the conversation.

Use the weekly review when you want automated insights from your data. Use the Coach when you want to think through a problem, explore options, or get domain-specific guidance.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/coach — show the full page]

> [SCREENSHOT: Coach interface — callouts: Sidebar (New Chat button, Gem selector dropdown, History panel), Main chat area (empty state with Gem name + "start a conversation" message), Input area at bottom]

> [SCREEN: Navigate to /dashboard/gems — show the Gems list]

> [SCREENSHOT: Gems Manager — callouts: Gem card (name, description, system prompt snippet), New Gem button, Edit/Delete buttons]

> [SCREEN: Return to /dashboard/coach — show the Gem selector dropdown — click to expand and show Gem options]

> [SCREEN: End on the Coach page — end lesson]

---

## Key Takeaways

- Gems are custom AI personas: Name (your reference) + Description (your reference) + System Prompt (defines AI behavior)
- Coach is the chat interface at `/dashboard/coach` — sidebar + chat area
- Sessions are locked to one Gem — switch Gems with New Chat
- Powered by Gemini 2.5 Flash with full multi-turn context per session
- Use Coach for interactive dialogue; use Weekly Review for automated data-driven insights
