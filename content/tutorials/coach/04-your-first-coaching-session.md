# Lesson 04: Your First Coaching Session

**Course:** Mastering Coach & Gems
**Module:** Using Coach
**Duration:** ~5 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

You have at least one Gem. Now let's use it. This lesson walks through starting a coaching session, how to send messages, how the AI maintains context across the conversation, and what good chat hygiene looks like.

---

### Starting a Session

Navigate to `/dashboard/coach`.

If you have Gems but no active session, the main chat area shows your selected Gem's name with a "Start a new conversation by typing below" prompt. The Gem selector in the sidebar defaults to your first Gem.

**Step 1: Select your Gem.** Use the dropdown in the sidebar to choose the Gem you want to work with. Pick the one that matches what you want to discuss.

**Step 2: Type your message.** Click into the input field at the bottom of the chat area and type your opening message. Press **Enter** to send, or **Shift+Enter** to add a new line without sending.

**Step 3: Wait for the response.** The send button shows a spinner while the AI generates its response. Responses are full text (not streamed character by character) — the complete response appears at once.

That's it. You're in a session.

---

### How Multi-Turn Context Works

Every time you send a message, the system sends the AI the full conversation history alongside your new message. This means:

- The AI remembers everything said earlier in this session
- You can reference previous messages without re-explaining ("the plan you suggested in your last message...")
- The AI builds on earlier context to give increasingly relevant answers

This is real multi-turn context — not a stateless question/answer exchange. Use it: probe, follow up, push back, ask for clarification. A good coaching session is a dialogue, not a series of isolated queries.

---

### What to Say in Your First Message

Opening messages that produce useful responses:

**Structured context:** "I'm preparing for a 90-day strength and endurance training block. I can train 4 days per week with access to a full gym. My priorities are muscle mass retention and improving VO₂ max. I have a history of left knee patellofemoral syndrome that flares under high eccentric load. What would you recommend for structuring the training weeks?"

**Problem statement:** "My HRV has been 15% below my 30-day baseline for the past 8 days. Training load hasn't changed. Sleep hours are consistent. What are the most likely explanations and what would you check first?"

**Review request:** "I've been following this eating pattern for the past two weeks: [describe pattern]. Evaluate it against longevity nutrition principles and tell me the most significant gaps."

Avoid: "How do I get healthier?" — too vague to produce a useful response.

---

### Keyboard Shortcuts and UI Notes

- **Enter** — Send message
- **Shift+Enter** — Add a new line (for longer, structured messages)
- The input field is disabled while the AI is generating a response — you can't interrupt it
- The chat area auto-scrolls to the bottom on each new message
- Both your messages (right-aligned, blue background) and AI responses (left-aligned, gray background) are shown chronologically

---

### During the Conversation

**Follow up, don't restart.** If the AI's response is close but not quite right, reply in the same session: "That works for the conditioning days, but I need you to account for the knee limitation in the lower-body sessions specifically." The AI has full context of everything said before.

**Ask for specifics.** If a response is more general than you need: "Give me a specific Monday morning training session from that plan, with exact exercises, sets, and rest periods."

**Push back.** If you disagree: "I think that protein recommendation is too conservative given my training volume. Here's my reasoning: [explain]. Reassess." Good AI responds to direct challenge constructively.

---

### What Happens After You Send Your First Message

The first message in a session creates a session record in your history. After that:
- The Gem selector in the sidebar is locked (grayed out and disabled) — you can't switch Gems mid-session
- The session appears at the top of your History list in the sidebar
- Subsequent messages in this session are appended to the saved history

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/coach — show the empty state with a Gem name displayed]

> [SCREENSHOT: Empty chat state — callouts: Gem name in center, Gem selector in sidebar (showing selected Gem), New Chat button, Input field at bottom]

> [SCREEN: Click the Gem dropdown — show multiple Gems listed — select one]

> [SCREEN: Type a first message: "I've been sleeping 7.5 hours average this week but my energy ratings are consistently 2-3 out of 5. What are the most likely causes and what would you investigate first?"]

> [SCREEN: Press Enter — spinner appears in send button — then AI response appears]

> [SCREENSHOT: Chat with first exchange — callouts: User message (right-aligned, blue), AI response (left-aligned, gray), Auto-scrolled to bottom]

> [SCREEN: Type a follow-up message building on the AI's response: "You mentioned HRV as a factor — my HRV has been averaging 48ms this week vs. my 30-day baseline of 61ms. Does that change your assessment?"]

> [SCREEN: Send — show AI responding with updated analysis using the context from earlier messages]

> [SCREENSHOT: Multi-turn conversation showing 2-3 exchanges — callout: "Full conversation history sent with every message — real multi-turn context"]

> [SCREEN: Show the sidebar — History section now shows the session with a preview of the first message]

> [SCREENSHOT: Sidebar with History panel showing session — callout: "Session created automatically after first message; Gem selector now locked"]

> [SCREEN: End on the chat — end lesson]

---

## Key Takeaways

- Start a session: select Gem → type first message → Enter to send
- Responses appear as full text (not streamed); spinner shows while generating
- Full conversation history is included in every request — genuine multi-turn context
- Enter to send; Shift+Enter for new line in message
- Gem is locked to session after first message — start New Chat to switch Gems
- Session appears in History automatically after the first message
- Follow up, probe, and push back within the session — dialogue outperforms isolated queries
