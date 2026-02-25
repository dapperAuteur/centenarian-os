# Lesson 03: Writing Effective System Prompts

**Course:** Mastering Coach & Gems
**Module:** Gem Setup
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The system prompt is the difference between a useful Gem and a generic chatbot. A well-written system prompt produces focused, expert-level, consistent responses. A poorly written one produces the same generic AI output you could get anywhere. This lesson covers what makes a system prompt effective.

---

### What the System Prompt Does

Every time you send a message to the Coach, the system prompt from your selected Gem is included in the request to Gemini. It's the standing instruction that tells the AI:

- Who it is and what it knows
- How it should behave and communicate
- What it should focus on and what it should ignore
- Any constraints on its responses

Think of it as writing a job description for an AI employee. The more precise and specific, the more consistently it will perform the role.

---

### The Core Elements of a Good System Prompt

**1. Role definition**

Start by clearly defining who the AI is. Not "you are a helpful assistant" — that's generic and tells the AI almost nothing. Be specific:

- "You are a longevity-focused nutritionist with expertise in metabolic health, protein optimization, and anti-inflammatory eating patterns."
- "You are a corrective exercise coach who specializes in movement dysfunction assessment and injury prevention."
- "You are a high-performance recovery specialist who advises elite athletes on sleep, HRV management, and training load periodization."

The more specific the role, the more focused and expert the responses will be.

---

**2. Context about the user**

Tell the AI who it's talking to and what that person cares about. You can include standing context that would otherwise require you to re-explain every session:

- "The user is an executive who travels 2–3 weeks per month and has limited access to a full kitchen when traveling."
- "The user has a history of left knee patellofemoral syndrome and should avoid high-impact activities during loading phases."
- "The user's primary goal is metabolic health and muscle mass retention, not athletic performance."

This context shapes responses without you having to repeat your situation in every message.

---

**3. Communication style**

Tell the AI how to talk to you:

- "Be direct and specific. No hedging, no generic disclaimers. The user has a graduate-level science background."
- "Provide evidence-based explanations with source mechanisms, not just recommendations."
- "When you identify a problem, name it explicitly before suggesting a correction. Don't soften criticism."
- "Use concise, actionable bullet points rather than long paragraphs."

Style instructions are often the most impactful part of the prompt — they determine whether responses are useful or generic.

---

**4. Scope constraints**

Optionally, define what the Gem should and shouldn't engage with:

- "Focus exclusively on nutrition and metabolic health. If the user asks about training programming, refer them to a trainer."
- "Do not recommend specific medications or interpret medical test results. Flag anything requiring medical expertise and advise consulting a physician."
- "Stay within the scope of evidence-based longevity interventions. Do not speculate beyond the research."

Scope constraints prevent the Gem from drifting into areas where it's less reliable.

---

### A Complete Example System Prompt

Here's a full system prompt for a Recovery Coach Gem:

```
You are a high-performance recovery specialist. Your expertise covers sleep architecture optimization, heart rate variability (HRV) interpretation, training load management, and evidence-based recovery modalities.

The user is a high-achieving professional who trains 4–5 days per week and has access to HRV data from an Oura Ring. Their primary concern is sustainable performance: not overtraining, protecting their sleep, and maintaining cognitive output alongside physical training.

When interpreting HRV data: always contextualize against the user's personal baseline, not population averages. A 10–15% drop below rolling baseline is significant. Advise on adjustments to training intensity, not training elimination.

Be direct. When the data or situation calls for a recovery day, say so clearly. Don't hedge. The user understands sports science concepts and doesn't need basic terms explained.

If the user asks for a recommendation, give one specific recommendation — not a list of options. They want a decision, not more variables to manage.
```

This prompt establishes role, user context, domain-specific guidance, communication style, and a concrete behavioral instruction.

---

### Common Mistakes

**Too vague:**
"You are a health coach. Help the user with health goals."
— This produces generic responses indistinguishable from any AI assistant.

**Too long without focus:**
A prompt that's five paragraphs covering every possible health topic produces a confused Gem that tries to be everything. Focused prompts outperform comprehensive ones.

**No style instructions:**
Without style guidance, AI defaults to verbose, hedge-heavy, qualification-laden responses. Add explicit style instructions to get direct, useful outputs.

**Re-explaining context every session:**
If you find yourself starting every session with the same background information ("I'm an executive who trains 4x a week, I have left knee issues..."), that information belongs in the system prompt — not in the chat.

---

### Iterating on Prompts

Don't expect your first system prompt to be perfect. Start a session, notice where responses are off, and edit the prompt to address it. Because the system prompt updates immediately (edits apply to all future messages even in ongoing sessions), you can tune a Gem over multiple conversations until it reliably produces the responses you need.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/gems — click Edit on an existing Gem]

> [SCREENSHOT: Gem edit modal — system prompt field highlighted — callout: "This is what shapes every response"]

> [SCREEN: Show a before/after example — a vague prompt vs. a specific one in the textarea field]

> [SCREENSHOT: Side-by-side example (or sequential) of vague prompt vs. specific prompt text in the textarea]

> [SCREEN: Close modal — navigate to /dashboard/coach — select the Gem — send a test message — show AI response]

> [SCREENSHOT: Chat response showing a focused, expert-level answer — callout: "System prompt shaping the response"]

> [SCREEN: Return to Gems — edit the prompt — add a style instruction — return to Coach — show how response changes]

> [SCREEN: End on the Coach chat — end lesson]

---

## Key Takeaways

- System prompt = standing instruction sent with every message in every session with this Gem
- Four elements: Role definition, User context, Communication style, Scope constraints
- Role definition: be specific — "longevity nutritionist with metabolic health expertise" outperforms "health coach"
- User context: put standing background in the prompt so you never re-explain it in chat
- Style instructions are the most impactful element — they determine if responses are direct or generic
- Iterate: edit the prompt based on what you see in actual sessions; updates apply immediately
