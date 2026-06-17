# Shared source corpus — all "Fit T. Cent 4.0" NASM course builds

**This is the one canonical source list for all three NASM courses: CPT, CES, and CNC.**
Each course build (separate chats) should cite from here, not from its own copy.

## File
- `bibliography.json` — 466 open-access, peer-reviewed studies.

## Schema (per entry)
```json
{ "doi": "10.xxxx/...", "title": "...", "journal": "... | null",
  "year": 2017, "url": "https://...open-access-pdf...", "agents": ["corrective"] }
```

## `agents` categories (use to match sources to a course/topic)
| tag | count | best fit |
|---|---|---|
| corrective | 151 | **NASM CES** (movement science, posture, assessment, mobility, recovery-of-function) |
| workout | 130 | NASM CPT (training, programming, performance) |
| nutrition | 90 | NASM CNC |
| recovery | 44 | CES + CPT (recovery, self-care) |
| general | 62 | shared (aging, physiology, behavior) |

A source can carry more than one tag.

## How to cite (all three courses)
- Format: `Author(s) (Year). Title. Journal. https://doi.org/<doi>`.
- **Never cite "NASM" or a NASM textbook as the source.** Cite the actual study.
- Never invent a study, author, year, journal, or statistic. If a claim has no matching
  source here, state it generally with no citation, or cut it.
- These are open-access with real DOIs (effectively Crossref-verified). Re-verify any
  questionable entry via `https://api.crossref.org/works/<doi>` before shipping.

## Origin & sync
- Canonical upstream: `centenarian-coach-multiagent` repo
  (`src/data/bibliography.json`, served at
  `https://centenarian-coach-multiagent.witus.online/sources`).
- This is a synced copy so it travels with the course repo. If the upstream changes,
  re-copy it here and note the date below.
- Last synced: 2026-06-16.

## Programmatic use
```js
const bib = require('docs/CentenarianAcademy/shared-sources/bibliography.json');
const cesSources = bib.filter(s => s.agents.includes('corrective') || s.agents.includes('recovery'));
```
