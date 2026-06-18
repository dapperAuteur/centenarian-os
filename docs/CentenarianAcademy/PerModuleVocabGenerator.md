# Per-module "Key Terms" vocabulary lessons — how to use the generator

Share with the CPT and CNC course chats. This is how the CES build adds a **per-module
vocabulary lesson** (the terms relevant to that chapter), while the **full glossary** stays
in the extras/Resources module. Reference implementation: `scripts/ces-module-vocab.mjs`.

## What it does
For each chapter module it writes a `# <Module>: Key Terms` lesson listing the vocabulary
terms that belong to that chapter, with plain-language definitions. A term that spans
chapters appears in each relevant module. Output files land in the per-lesson working dir
and flow through the normal collect → assemble → load pipeline.

## Inputs it needs
1. **A vocabulary file** `…/source/vocabulary.json` — an array of:
   ```json
   { "term": "Afferent",
     "definition": "Sensory neurons that carry signals toward the central nervous system.",
     "refs": ["Chapter 7/Lesson 2/Page 7", "Chapter 11/Lesson 1/Page 4"] }
   ```
   The `refs` strings are what map a term to its chapter(s). CES extracted these from the
   official vocabulary PDF with PyMuPDF (see `docs/ces-curriculum/source/_extract.py`,
   the vocab-parsing block). CPT/CNC: extract your own vocab PDF the same way.
2. **A lesson manifest** `…/source/lesson-manifest.json` — used only to map a module number
   to its title (`{ lessons: [{ module, moduleTitle }] }`). Any module→title source works.

## How the mapping works
- Regex `/Chapter\s+(\d+)\s*\//` over each term's `refs` → the set of chapter numbers.
- Group terms by chapter; chapter N → module N (adjust if your numbering differs).
- Skip chapters outside your content range (CES used 1 to 18).
- Definitions run through a `plain()` pass: dashes normalized and a few banned words swapped
  (utilize→use, holistic→whole-person, thus→so, etc.) so the AI-tells scan stays at zero.

## Order convention (avoid collisions)
CES lesson orders per module: content `1..k`, **Key Terms `70`**, practice/self-check `80`,
quiz `90+`. So the vocab lesson sorts after the teaching content and before practice/quiz.
Pick an order that does not collide with your quiz `lesson_order` (CES quizzes start at 90).

## Run it (CES example)
```
node scripts/ces-module-vocab.mjs          # writes m<NN>-70-vocabulary.md per module
node scripts/scan-ai-tells.mjs <lessonsDir> --fix   # gate to zero AI tells
# then the normal flow:
node scripts/ces-collect-lessons.mjs                # md -> per-module JSON
#   loop your lesson assembler over the per-module JSON -> course-import.csv
node --env-file=.env.local scripts/ces-load-course.mjs <COURSE_ID> course-import.csv --mode create
```
**After loading while the course is free**, re-set free-preview flags (the loader forces
`is_free_preview=true` when `price_type='free'`): set true only for your free modules
(CES: orientation + resources) and false for the rest.

## To adapt for CPT / CNC
1. Point the script at your `vocabulary.json` + module→title source (edit the two paths at
   the top, or clone to `scripts/cpt-module-vocab.mjs` / `scripts/cnc-module-vocab.mjs`).
2. Confirm your chapter→module numbering matches (CES used module N = chapter N).
3. Keep the full glossary in your extras/Resources module (a glossary lesson + PDF), and let
   this script add the per-module subsets.
4. Run the pipeline above, then re-fix free-preview flags.

## Notes
- Terms with no chapter in their `refs` only appear in the full glossary, not a module.
- A chapter with zero chapter-tagged terms gets no Key Terms lesson (that is fine; the full
  glossary still covers it).
