# Lesson 11: Taking Quizzes

**Course:** Navigating the Centenarian Academy
**Module:** Assessments
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Some lessons are quizzes — interactive assessments that test your understanding of the course material. This lesson explains how quizzes work, how they're scored, and what happens after you submit.

---

### Recognizing a Quiz Lesson

In the lesson list, quiz lessons are marked with a quiz icon. When you open a quiz lesson, instead of a video player or text content, you'll see a set of questions with answer options.

---

### Taking the Quiz

Each question shows:
- The question text
- Multiple-choice answer options (typically 4 choices)
- A select indicator — click an option to choose it

Work through the questions at your own pace. You can change your answer before submitting. There's no time limit.

When you've answered all questions, click **Submit** to see your results.

---

### After Submission

After submitting, each question reveals:
- **Correct/Incorrect indicator** — green checkmark for correct, red X for incorrect
- **The correct answer** — highlighted in green
- **Explanation** — a paragraph explaining why the correct answer is right
- **Citation** — a source reference (often in APA format) supporting the explanation

Your overall score appears at the top: "You got X out of Y correct."

---

### Scoring and Progress

Submitting a quiz marks the lesson as complete, regardless of your score. There's no minimum passing score — the quiz is a learning tool, not a gate.

If the course uses CYOA navigation, completing the quiz triggers the crossroads options, just like completing any other lesson type.

---

### Example Quiz Data

Here's what a quiz lesson's `quiz_content` looks like:

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is the primary purpose of the CYOA navigation mode?",
      "options": [
        "To restrict students to a fixed lesson order",
        "To let students choose their own path through the course",
        "To randomly shuffle lessons on each visit",
        "To hide unfinished lessons from the sidebar"
      ],
      "correctIndex": 1,
      "explanation": "CYOA (Choose Your Own Adventure) navigation gives students crossroads options after completing a lesson, allowing them to choose their next topic based on semantic relevance, linear sequence, or random discovery.",
      "citation": "CentenarianOS Academy — Crossroads API Documentation"
    },
    {
      "id": "q2",
      "question": "Which of these is NOT a valid lesson type in the Academy?",
      "options": [
        "Video",
        "Spreadsheet",
        "Quiz",
        "Audio"
      ],
      "correctIndex": 1,
      "explanation": "The Academy supports five lesson types: video, text, audio, slides, and quiz. Spreadsheet is not a supported lesson type.",
      "citation": "CentenarianOS Lesson Schema — Migration 070"
    },
    {
      "id": "q3",
      "question": "What happens to your progress when you submit a quiz?",
      "options": [
        "Nothing — quizzes don't affect progress",
        "The lesson is marked complete regardless of score",
        "You must score above 70% to get credit",
        "The quiz resets and you must retake it"
      ],
      "correctIndex": 1,
      "explanation": "Submitting a quiz marks the lesson as complete. There is no minimum passing score — the quiz is a learning tool for self-assessment.",
      "citation": "CentenarianOS Academy — Quiz Submission Handler"
    }
  ]
}
```

---

### Retaking a Quiz

After submission, you can review your answers and the explanations as many times as you want. The lesson remains accessible. There is currently no "retake" flow that resets your answers — the quiz shows your submitted state on revisit.

---

## Screen Recording Notes

> [SCREEN: Navigate to a quiz lesson — show the quiz interface with questions and options]

> [SCREENSHOT: Quiz lesson — callouts: Question text, Answer options (radio buttons), Submit button]

> [SCREEN: Select answers for 2-3 questions — show the selection state change]

> [SCREEN: Click Submit — show results appear]

> [SCREENSHOT: Quiz results — callouts: Score ("2 out of 3"), Correct answer (green), Incorrect answer (red), Explanation text, Citation]

> [SCREEN: Scroll through explanations — show the detail provided for each answer]

> [SCREEN: Show the lesson marked as complete in the sidebar after submission]

---

## Key Takeaways

- Quiz lessons present multiple-choice questions with 4 options each
- No time limit — work at your own pace, change answers before submitting
- After submission: see correct answers, explanations, and citations for each question
- Submitting marks the lesson complete — no minimum score required
- Quiz results are reviewable anytime — the lesson stays accessible after completion
