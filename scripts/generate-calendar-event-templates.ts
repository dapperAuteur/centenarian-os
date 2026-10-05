// scripts/generate-calendar-event-templates.ts
// Writes the calendar event templates from lib/capture/event-templates.ts:
//   public/templates/calendar-event-examples.ics      example events, week of SAMPLE_WEEK_START
//   public/templates/calendar-event-cheat-sheet.md    copy-paste titles, English and Spanish
//
// Run after changing the examples or the token words:
//   node --experimental-strip-types scripts/generate-calendar-event-templates.ts
// tests/unit/event-templates.test.ts fails while the files are out of date.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLE_WEEK_START, buildCheatSheetMarkdown, buildExampleIcs } from '../lib/capture/event-templates.ts';

const dir = join(import.meta.dirname, '..', 'public', 'templates');
writeFileSync(join(dir, 'calendar-event-examples.ics'), buildExampleIcs(SAMPLE_WEEK_START));
writeFileSync(join(dir, 'calendar-event-cheat-sheet.md'), buildCheatSheetMarkdown());
console.log('Wrote public/templates/calendar-event-examples.ics and calendar-event-cheat-sheet.md');
