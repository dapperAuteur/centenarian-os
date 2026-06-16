# Course Authoring Guide (Audio-First)

This guide is the standard for building Centenarian Academy courses. It covers
how to write a course so it teaches well and imports cleanly. The Speedway import
spec (`docs/speedway-course/centenarian-academy-import-spec.md`) still tells you
the exact CSV column shapes. This guide tells you how to write the content, how to
structure it, and what the quiz JSON really looks like. Where the two disagree on
quiz format, this guide wins (see Section 8).

The rules here come from a short shelf of books on how people learn and how to
write plainly. The point is not the theory. The point is a checklist you can
follow that produces courses people finish and pass.

For sources and citations, follow `CitationIntegrityGuide.md`: verify every citation
against Crossref or PubMed, never invent or mis-attribute a study, and ship the source
artifacts (master usage map, teacher evidence ledger). To build a course with an AI
assistant, hand it `CourseCreationWithAI.md`.

---

## 0. Write like a person, not like a machine

Read this first. It applies to every word you ship: lesson scripts, quiz text,
glossary entries, descriptions.

- **No em-dashes.** Use a comma, a period, or parentheses instead.
- **No "rare word when a common word works."** Write "use," not "utilize." Write
  "help," not "facilitate." Write "so," not "thus." Write "about," not "regarding."
- **No filler openers.** Cut "It is worth noting that," "In today's world,"
  "When it comes to," "At the end of the day."
- **No stacked triples for rhythm.** One clear example beats three vague ones.
- **No hedging clichés.** Cut "arguably," "in many ways," "a testament to."
- **Short sentences win.** If a sentence has two ideas, make it two sentences.
- **Active voice.** "The pilot files the report," not "the report is filed by the
  pilot."
- **Contractions are fine.** They sound like a person talking, which is the goal.

If a draft reads like a brochure or a textbook, it failed. It should read like a
sharp teacher explaining something to one person.

---

## 1. The one rule: audio first

Every lesson is a script meant to be heard. People will listen while they drive,
walk, or pack a flight bag. The screen is a bonus, not the plan. A lesson that
only makes sense if you are looking at it has broken the one rule.

Write for the ear:

- Say numbers the way a person says them. "Four hundred feet," not "400'."
- Read references out loud once, then move on. The exact code lives in the
  citation field, not the spoken line.
- Never say "as you can see." The listener cannot see anything. If something is
  visual, paint it in words and also give a picture in a companion lesson or a
  quiz image.

---

## 2. Why these rules work (short version)

You do not need the research to use the guide, but here is the reason behind each
rule, so you can adapt when a topic is unusual.

| Idea | Where it comes from | What we do about it |
|---|---|---|
| Working memory holds only a few new things at once | *Uncommon Sense Teaching* (Oakley, Rogowsky, Sejnowski) | Keep lessons short. One concept per lesson. |
| Testing yourself beats rereading | *Make It Stick*; *Learning How to Learn* | Open with recall. Quiz often. Explain why wrong answers are wrong. |
| Spacing and mixing beat cramming | Oakley; *Make It Stick* | Add review lessons. Mix topics in quizzes. |
| Concrete and surprising sticks; abstract slides off | *Made to Stick* (Heath) | Start each concept with one vivid, real example. |
| Experts forget what beginners do not know | *Made to Stick* (Heath) | Translate every term. Assume zero aviation background. |
| Clear writing is mostly cutting clutter | *Writing to Learn* (Zinsser); *How to Write Clearly* (Albrighton) | Draft, then cut a fifth of the words. |
| Words plus a picture beat words alone | Mayer; Oakley | Pair visual topics with a figure and a word picture. |
| A clear goal and real practice drive learning | *Workshop Survival Guide* (Fitzpatrick) | State one goal per lesson. End in practice. |
| Bad first drafts are normal | *Bird by Bird* (Lamott) | Write it ugly, then fix it. |

---

## 3. How a course is built

A course has three levels: course, then module, then lesson.

- A **module** is roughly one exam domain or chapter.
- A **lesson** is one concept.

A module runs in this order: content lessons, then a figure-reference lesson if
the topic needs charts, then the quiz, then a short cumulative review.

**Length rule.** Keep a lesson at about eight minutes of audio or fewer, which is
roughly 1,150 spoken words. Cover at most a few new ideas. If a draft needs two
unrelated section headers, split it into two lessons.

**Order rule.** Teach the concrete thing before the abstract rule. Teach what a
topic needs first. For example, teach height above ground versus height above sea
level before you teach airspace floors and ceilings. Give more lessons to the
topics the exam asks about most.

---

## 4. Lesson types

The platform supports several lesson types. For these courses you mostly use:

- **audio**: the finished form. Uses `content_url` for the audio file, plus
  `audio_chapters` and `transcript_content`.
- **text**: the script before audio is recorded, and any figure-reference lesson.
- **quiz**: holds the quiz JSON in `quiz_content`.

Workflow: ship the script as a `text` lesson first. Record the audio later. Then
re-import that one row in `upsert` mode with the type changed to `audio` and the
audio URL filled in. Upsert only changes the columns you provide, so the script
stays as the show notes.

---

## 5. The lesson script template

Every content lesson follows this order. The bracket notes like `[Sound: ...]`,
`[tone]`, and `[Beat]` are directions for whoever records the audio. They can stay
in the written show notes as light stage directions.

> **Publishing the reading version.** Students read text lessons; they do not see the
> bracketed audio cues. `scripts/reformat-lesson-text.mjs` converts a course's bracketed
> scripts into clean, well-spaced Markdown: it strips every stage cue (`[Sound: ...]`,
> `[Beat]`, `[tone]`) and turns each beat (`[RECALL]`, `[HOOK]`, `[TEACH]`, `[PICTURE]`,
> `[ON THE TEST]`, `[CHECK]`) into a short `##` heading that *describes that section's
> content*. The body transform changes no words, so in-text citations are preserved exactly
> (a guardrail aborts any lesson whose citations would change). Run
> `node --env-file=.env.local scripts/reformat-lesson-text.mjs prep <courseId>`, generate the
> per-section headings, then `... apply <courseId> --apply`. The original bracketed script is
> backed up first so you can still record audio from it. Teachers can also edit any lesson's
> text directly in the **Curriculum** tab (Markdown or Rich text) — see the Teacher Guide.

```
# Lesson N: Plain Title

Goal: After this lesson you can <one thing the learner can do>.
Domain: <exam domain> | Exam weight: <percent> | Run time: about X minutes

[RECALL]  Last time we covered <topic>. Two quick questions.
          Question one ... [Beat] ... answer.
          Question two ... [Beat] ... answer.

[HOOK]    [Sound: short cue]  One vivid, real example that sets up the idea.

[TEACH]   Plain-English explanation first. Then the official term in
          parentheses. Then keep using plain words.

[PICTURE] Paint the visual in words. If there is a figure, point to it.

[ON THE TEST]  How the FAA writes this question. Name the trap answer.

[CHECK]   One or two questions. [Beat]. Then the answer and why.

## Key Takeaways
- Three to five bullets. These are the exact facts the quiz will test.

## Sources
- Plain citation. Raw code numbers live here and in the quiz citation field.
```

---

## 6. The ten rules, with examples

1. **Open with recall.** Start every lesson with two quick questions about the
   last lesson, a beat to think, then the answers. About thirty seconds.

2. **Keep it short.** One concept, eight minutes or less. Split big chapters. For
   example, airspace becomes separate lessons for ground-versus-sea-level height,
   Class G and E, Class D, Class C, Class B, and special use.

3. **Space the review.** End each module with a short review that brings back its
   own top facts and one fact from each earlier module.

4. **Mix the quiz.** Do not group all of one sub-topic together in a quiz. Mixing
   forces real recall instead of pattern matching.

5. **Hook with something real.** Give one concrete, surprising example before the
   rule. For airspace: picture an upside-down wedding cake of glass stacked over a
   busy airport. For load factor: in a hard sixty-degree turn, a one-pound drone
   pulls like it weighs two pounds.

6. **Translate every term.** Say the plain meaning first, the official term once in
   parentheses, then the plain words after that. Push the raw code number to the
   citation field. Example: "you have to keep the drone in sight with your own eyes
   (this is called visual line of sight)."

7. **Frame for the test.** End each lesson with one line: "On the test, this shows
   up as ..." and name the wording and the common trap. End each module with a
   short walkthrough of how the FAA asks about that domain.

8. **Explain the wrong answers.** In a quiz explanation, say why the right answer
   is right and why each wrong answer is wrong. The wrong-answer reasons are the
   most useful study material.

9. **Show the picture.** For anything visual (airspace shapes, chart symbols,
   center of gravity, a coded weather report), give a figure and also describe it
   in words. Never depend on the screen.

10. **State the goal.** Each lesson header names one thing the learner can do after
    it. The Key Takeaways are the exact facts the quiz checks.

---

## 7. Plain-language pass

After the first draft, read it again and cut. Targets:

- shortest accurate word
- active voice
- no "make a decision" when "decide" works
- one idea per spoken sentence
- spell out each acronym the first time, then use it
- speak numbers the way a person says them
- cite rules by what they mean, with the code number in the citation field

Example.

Before, straight from a lecture transcript:

> The remote pilot in command shall ensure that prior to the conduct of
> operations the small unmanned aircraft system does not exceed the center of
> gravity limitations as specified in the applicable documentation.

After:

> Before you fly, you are the person in charge (the remote pilot in command). Your
> job is to make sure the drone is balanced inside the limits the maker gives you.
> [Beat] That is it. Balanced, inside the limits.

---

## 8. Quiz authoring

Use the real schema. This is what the player and the importer expect.

```json
{
  "passingScore": 80,
  "attemptsAllowed": -1,
  "questions": [
    {
      "id": "q1",
      "questionText": "Plain question text.",
      "questionType": "multiple_choice",
      "options": [
        { "id": "q1a", "text": "First choice" },
        { "id": "q1b", "text": "Second choice" },
        { "id": "q1c", "text": "Third choice" }
      ],
      "correctOptionId": "q1b",
      "explanation": "Why q1b is right, and why the others are wrong.",
      "citation": "14 CFR 107.x",
      "imageUrl": "https://res.cloudinary.com/.../figure.png"
    }
  ]
}
```

Notes:

- The FAA written test uses **three** choices, so most questions have three
  options.
- `correctOptionId` must match one of the option `id` values. Scoring compares the
  chosen `id` to this `id`. An index number will not work.
- `attemptsAllowed` of -1 means unlimited.
- `passingScore` is 80. That is the instructor's standard, set above the FAA's
  passing line of 70.
- `imageUrl` is optional. Use it for a figure the question depends on, hosted on
  Cloudinary. The player shows it above the question.
- The older Speedway spec shows a quiz format with `correctIndex` and plain string
  options. That format does not work with the current player. Ignore it. Use the
  schema above.

**Distractor design.** Wrong answers should be believable, the kind of mistake a
real student makes. The FAA writes them that way. Example: an option that names a
document that does not exist ("Aircraft Weight and Balance Handbook").

**Explanations teach.** State the right answer, knock down each wrong answer, then
point to the lesson that covers it.

**Mix the order.** Within a quiz, do not block all of one sub-topic together.

---

## 9. Module scaffolding

Three lesson types repeat in every module:

- **Recall opener.** Built into the first lesson of the module. It calls back to
  the previous module.
- **Cumulative review.** The last content lesson. Five to eight top facts, plus a
  callback to each earlier module. Audio first, like every other lesson.
- **Typical exam questions.** A short walkthrough of how the FAA tests this domain.
  It leads straight into the module quiz.

---

## 10. Glossary and metadata

Each module adds glossary terms. Use the columns `term, phonetic, definition,
lesson_title`. Write definitions at about a sixth-grade reading level.

Each course ships a metadata block: title, subtitle, description, category,
navigation mode, and price type. See the course metadata file that ships with the
course for the exact fields.

---

## 11. A finished example lesson

This is a full short lesson. Read it to hear the voice.

```
# Lesson: Load Factor, or Why Turns Make Your Drone Heavier

Goal: You can say that load factor rises in any maneuver other than straight and
level flight, and that a steep turn can stall the aircraft at a higher speed.
Domain: Loading and Performance (7 to 11 percent of the exam) | Run time: about 6 minutes

[RECALL] Last time we covered weight and lift. Two quick ones.
         One: name the four forces of flight. [Beat] Lift, weight, thrust, drag.
         Two: when you increase the angle of attack, up to a point, what happens to
         lift? [Beat] It goes up. Hold onto that. Today it bites us.

[HOOK]   [Sound: a drone motor spooling up under load]
         Here is something that trips people up on the written test every year.
         Your drone weighs one pound sitting on the bench. Put it in a hard turn, a
         sixty-degree bank, and it now pulls like it weighs two pounds. [Beat]
         Nothing was added. No payload. The turn did it. That doubling has a name.

[TEACH]  We call it load factor. Plain version: load factor is how many times
         heavier the aircraft feels than it really is. Straight and level, it feels
         like its own weight. We call that one G. The moment you turn, climb, or
         pull up, it feels heavier, and load factor goes above one.

         So when does it jump? Any time you do something other than fly straight and
         level. [Beat] A gentle turn, a little. A steep turn, a lot. The number
         depends on the bank angle, not on weight and not on the balance point.
         Memorize sixty degrees of bank. That is a load factor of two. Double.

[PICTURE] Picture a full bucket of water on the end of your arm. Swing it in a fast
         circle. Your arm strains, because the water pulls harder in the swing than
         it did hanging straight down. Same water. The circle did it. Your drone
         feels that same strain in a turn.

[ON THE TEST] On the exam this shows up as: load factor on the wings increases any
         time the aircraft does maneuvers other than straight and level flight.
         That is the answer they want. Watch the trap answers. They will offer
         "when the gross weight is reduced" and "when the balance point moves back."
         Reducing weight does not raise load factor. The balance point does not
         drive it at all. Maneuvering does.

[CHECK]  Quick check. You are in a steep turn and you pull it tighter. Does the
         stall speed go up, go down, or stay the same? [Beat] It goes up. More load
         factor means the wing stalls at a faster speed than it would in level
         flight. That is why steep, low, slow turns are dangerous.

## Key Takeaways
- Load factor is how many times heavier the aircraft feels. Level flight is one G.
- It goes up in any maneuver other than straight and level: turns, climbs, pull-ups.
- A sixty-degree bank is about a load factor of two. Higher load factor raises stall speed.
- It is not caused by reducing weight or by moving the balance point.

## Sources
- FAA-H-8083-25C, Pilot's Handbook of Aeronautical Knowledge, Chapter 5.
```

The matching quiz item, in the real schema:

```json
{
  "id": "q1",
  "questionText": "Load factor on the wings increases anytime the aircraft is",
  "questionType": "multiple_choice",
  "options": [
    { "id": "q1a", "text": "subjected to maneuvers other than straight and level flight" },
    { "id": "q1b", "text": "flown at a reduced gross weight" },
    { "id": "q1c", "text": "loaded with the center of gravity at the aft limit" }
  ],
  "correctOptionId": "q1a",
  "explanation": "Load factor follows total lift, which rises in turns, climbs, and pull-ups, meaning any maneuver other than straight and level flight. Reducing gross weight lowers load factor, it does not raise it. The center of gravity location does not drive load factor.",
  "citation": "FAA-H-8083-25C, Chapter 5"
}
```

---

## 12. Lesson checklist (done means done)

- [ ] States one clear goal
- [ ] Eight minutes or fewer, a few new ideas at most
- [ ] Opens with recall
- [ ] One concrete hook
- [ ] Every term and acronym explained once
- [ ] A word picture for anything visual
- [ ] An "on the test" line that names the trap
- [ ] Ends with a practice question
- [ ] Key Takeaways match what the quiz tests
- [ ] Sources listed
- [ ] Makes sense with your eyes closed
- [ ] No em-dashes, no rare words, no filler (Section 0)

---

## 13. How to build a course, start to finish

1. Skim all the source material for one chapter to see the shape of it.
2. Mark the high-value facts the exam cares about.
3. Write an ugly first draft of each lesson.
4. Do the plain-language pass and cut a fifth of the words.
5. Fill the lesson template.
6. Build the import CSV.
7. Import to a test course and listen with your eyes closed.
8. Later, record the audio and re-import as the audio type.

---

## 14. Files and where things live

- Lesson drafts: working files, kept out of version control.
- The thing you import: the CSV files.
- Figures: cut from the source, hosted on Cloudinary, linked by full https URL.
- This guide: `docs/CentenarianAcademy/CourseAuthoringGuide.md`.
