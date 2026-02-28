# Lesson 12: Building Quiz Lessons

**Course:** The Teaching Dashboard
**Module:** Content Creation
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Quiz lessons let you test student understanding with multiple-choice questions. Each question includes an explanation and an optional citation, so the quiz serves as both an assessment and a learning tool. This lesson covers how to build one.

---

### Creating a Quiz Lesson

1. Navigate to your course editor
2. Add a new lesson (or edit an existing one)
3. Set **Lesson Type** to **Quiz**
4. The **Quiz Content** field appears — this is where you paste your quiz JSON

---

### Quiz Content Structure

The quiz is a JSON object with a `questions` array. Each question has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID (e.g., "q1", "q2") |
| `question` | string | Yes | The question text |
| `options` | string[] | Yes | Array of 4 answer choices |
| `correctIndex` | number | Yes | Index of the correct answer (0-based) |
| `explanation` | string | Yes | Why the correct answer is right |
| `citation` | string | No | Source reference (APA format recommended) |

---

### Full Quiz Example: 5 Questions

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is the longest continental mountain range in the world?",
      "options": ["The Himalayas", "The Rockies", "The Andes", "The Alps"],
      "correctIndex": 2,
      "explanation": "The Andes stretch over 7,000 kilometers along the western coast of South America, making them the longest continental mountain range on Earth.",
      "citation": "National Geographic Society. (2023). Andes Mountains. https://education.nationalgeographic.org/resource/andes-mountains/"
    },
    {
      "id": "q2",
      "question": "Which crop is NOT traditionally grown at high altitudes in the Andes?",
      "options": ["Quinoa", "Potatoes", "Bananas", "Maize"],
      "correctIndex": 2,
      "explanation": "Bananas are a tropical lowland crop. The high-altitude Andes support potatoes, quinoa, and maize, which are adapted to cooler temperatures and thinner air.",
      "citation": "Brush, S. B. (2004). Farmers' Bounty: Locating Crop Diversity in the Contemporary World. Yale University Press."
    },
    {
      "id": "q3",
      "question": "What animals are primarily used for herding above the tree line in the Andes?",
      "options": ["Cattle and sheep", "Llamas and alpacas", "Goats and donkeys", "Horses and mules"],
      "correctIndex": 1,
      "explanation": "Llamas and alpacas are native South American camelids domesticated thousands of years ago. They thrive at high altitudes and provide wool, meat, and transport.",
      "citation": "Wheeler, J. C. (1995). Evolution and present situation of the South American Camelidae. Biological Journal of the Linnean Society, 54(3), 271-295."
    },
    {
      "id": "q4",
      "question": "The Bosphorus strait is located in which modern country?",
      "options": ["Greece", "Turkey", "Egypt", "Lebanon"],
      "correctIndex": 1,
      "explanation": "The Bosphorus strait runs through Istanbul, Turkey, connecting the Black Sea to the Sea of Marmara. It has been a strategic crossroads between Europe and Asia for millennia.",
      "citation": "Freely, J. (2011). A History of Ottoman Architecture. WIT Press."
    },
    {
      "id": "q5",
      "question": "What type of historical document is a portolan chart?",
      "options": ["A tax record", "A navigational sea chart", "A royal decree", "A trade agreement"],
      "correctIndex": 1,
      "explanation": "Portolan charts are medieval navigational maps used by sailors. They show coastlines, harbors, and compass directions, and were essential tools for Mediterranean trade.",
      "citation": "Campbell, T. (1987). The Earliest Printed Maps, 1472-1500. British Library."
    }
  ]
}
```

---

### Tips for Good Quiz Questions

**Question design:**
- Ask about concepts, not memorization — "Why does X happen?" beats "What year did X occur?"
- Make all 4 options plausible — avoid obviously wrong answers
- Keep question text under 2 sentences

**Explanations:**
- Explain why the correct answer is right, not just that it is
- Reference specific facts from the lesson content
- Keep explanations to 2-3 sentences

**Citations:**
- Use APA format when citing published sources
- Can reference your own course content: "CentenarianOS Academy — Lesson 03: Geography of the Andes"
- Citations build credibility and give students a path for further reading

---

### Scoring Behavior

- Submitting the quiz marks the lesson as complete, regardless of score
- There's no minimum passing grade — quizzes are self-assessment tools
- Students see their score ("3 of 5 correct") and can review all explanations
- If the course uses CYOA, crossroads appears after quiz submission

---

## Screen Recording Notes

> [SCREEN: Open the lesson editor — set lesson type to Quiz]

> [SCREENSHOT: Lesson editor with Quiz type selected — callout: "Quiz Content JSON field appears"]

> [SCREEN: Paste the 5-question example JSON into the Quiz Content field]

> [SCREEN: Save the lesson — preview as a student]

> [SCREEN: Answer 3 questions correctly and 2 incorrectly — click Submit]

> [SCREENSHOT: Quiz results — callouts: Score ("3 of 5"), Green checkmarks on correct, Red X on incorrect, Explanation text, APA citation]

> [SCREEN: Scroll through all explanations — show citations displayed below each explanation]

---

## Key Takeaways

- Quiz lesson: set type to Quiz, paste JSON into Quiz Content field
- Each question: id, question text, 4 options, correctIndex, explanation, optional citation
- Submission marks the lesson complete — no minimum score
- Write plausible distractors and concept-focused questions
- Explanations are learning tools — explain the "why," cite your sources
