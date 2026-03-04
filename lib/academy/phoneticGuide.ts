// lib/academy/phoneticGuide.ts
// Static phonetic reference data for dictionary-style pronunciation spelling.

export interface PhoneticEntry {
  symbol: string;
  example_word: string;
  example_phonetic: string;
  category: string;
}

export const PHONETIC_GUIDE: PhoneticEntry[] = [
  // Long Vowels
  { symbol: 'ay', example_word: 'face, late', example_phonetic: 'fayss, layt', category: 'Long Vowels' },
  { symbol: 'ee', example_word: 'feet, easy', example_phonetic: 'feet, EE-zee', category: 'Long Vowels' },
  { symbol: 'eye', example_word: 'time, high', example_phonetic: 'tym, hy', category: 'Long Vowels' },
  { symbol: 'oh', example_word: 'bone, go', example_phonetic: 'bohn, goh', category: 'Long Vowels' },
  { symbol: 'oo', example_word: 'food, true', example_phonetic: 'food, troo', category: 'Long Vowels' },
  { symbol: 'yoo', example_word: 'use, cute', example_phonetic: 'yooz, kyoot', category: 'Long Vowels' },

  // Short Vowels
  { symbol: 'a', example_word: 'cat, snap', example_phonetic: 'kat, snap', category: 'Short Vowels' },
  { symbol: 'e', example_word: 'bed, step', example_phonetic: 'bed, step', category: 'Short Vowels' },
  { symbol: 'i', example_word: 'sit, wish', example_phonetic: 'sit, wish', category: 'Short Vowels' },
  { symbol: 'o', example_word: 'top, hot', example_phonetic: 'top, hot', category: 'Short Vowels' },
  { symbol: 'u', example_word: 'cup, run', example_phonetic: 'kup, run', category: 'Short Vowels' },
  { symbol: 'uh', example_word: 'about, sofa', example_phonetic: 'uh-BOWT, SOH-fuh', category: 'Short Vowels' },

  // R-Controlled Vowels
  { symbol: 'ar', example_word: 'car, start', example_phonetic: 'kar, start', category: 'R-Controlled' },
  { symbol: 'air', example_word: 'care, fair', example_phonetic: 'kair, fair', category: 'R-Controlled' },
  { symbol: 'eer', example_word: 'here, near', example_phonetic: 'heer, neer', category: 'R-Controlled' },
  { symbol: 'or', example_word: 'more, core', example_phonetic: 'mor, kor', category: 'R-Controlled' },
  { symbol: 'ur', example_word: 'turn, bird', example_phonetic: 'turn, burd', category: 'R-Controlled' },

  // Diphthongs
  { symbol: 'ow', example_word: 'cow, house', example_phonetic: 'kow, howss', category: 'Diphthongs' },
  { symbol: 'oy', example_word: 'boy, coin', example_phonetic: 'boy, koyn', category: 'Diphthongs' },
  { symbol: 'aw', example_word: 'law, caught', example_phonetic: 'law, kawt', category: 'Diphthongs' },

  // Consonants (non-obvious spellings only)
  { symbol: 'k', example_word: 'cat, kick, queen', example_phonetic: 'kat, kik, kween', category: 'Consonants' },
  { symbol: 'f', example_word: 'phone, cough', example_phonetic: 'fohn, kof', category: 'Consonants' },
  { symbol: 'j', example_word: 'gem, judge', example_phonetic: 'jem, juj', category: 'Consonants' },
  { symbol: 's', example_word: 'city, scene', example_phonetic: 'SI-tee, seen', category: 'Consonants' },
  { symbol: 'z', example_word: 'his, buzzes', example_phonetic: 'hiz, BUZ-iz', category: 'Consonants' },
  { symbol: 'sh', example_word: 'ship, nation', example_phonetic: 'ship, NAY-shun', category: 'Consonants' },
  { symbol: 'zh', example_word: 'vision, beige', example_phonetic: 'VI-zhun, bayzh', category: 'Consonants' },
  { symbol: 'ch', example_word: 'chip, match', example_phonetic: 'chip, mach', category: 'Consonants' },
  { symbol: 'ng', example_word: 'sing, think', example_phonetic: 'sing, think', category: 'Consonants' },
  { symbol: 'th', example_word: 'think, bath', example_phonetic: 'think, bath', category: 'Consonants' },
  { symbol: 'dh', example_word: 'this, breathe', example_phonetic: 'dhis, breedh', category: 'Consonants' },
  { symbol: 'hw', example_word: 'which, whale', example_phonetic: 'hwitch, hwayl', category: 'Consonants' },
  { symbol: 'r', example_word: 'run, write', example_phonetic: 'run, ryt', category: 'Consonants' },
  { symbol: 'n', example_word: 'know, gnaw', example_phonetic: 'noh, naw', category: 'Consonants' },

  // Silent Letters
  { symbol: '(silent)', example_word: 'knight, psalm', example_phonetic: 'nyt, sahm', category: 'Silent Letters' },
  { symbol: '(silent)', example_word: 'debt, doubt', example_phonetic: 'det, dowt', category: 'Silent Letters' },
  { symbol: '(silent)', example_word: 'island, aisle', example_phonetic: 'EYE-lund, yl', category: 'Silent Letters' },
];

export const PHONETIC_NOTATION_RULES = [
  'Separate syllables with hyphens: neuron → NYOOR-on',
  'Use ALL CAPS for the stressed syllable: synapse → SY-naps',
  'Spell sounds as they are heard, not as they are spelled: colonel → KUR-nul',
  'Use the symbol table for specific sounds (e.g., "ay" for long-A, "oo" for the sound in "food")',
  'Omit silent letters entirely: knight → nyt, psychology → sy-KO-luh-jee',
  'For multi-syllable words, mark only the primary stress: hippopotamus → hi-puh-PO-tuh-mus',
  'The schwa sound (unstressed "uh") is the most common vowel in English — use "uh": banana → buh-NA-nuh',
  'Double consonants in spelling do not mean double sounds: butter → BU-tur (not BUT-TUR)',
];

export const PHONETIC_TIPS = [
  {
    title: 'Common Tricky Words',
    examples: [
      { word: 'Wednesday', phonetic: 'WENZ-day' },
      { word: 'February', phonetic: 'FEB-roo-air-ee' },
      { word: 'Colonel', phonetic: 'KUR-nul' },
      { word: 'Quinoa', phonetic: 'KEEN-wah' },
      { word: 'Entrepreneur', phonetic: 'on-truh-pruh-NUR' },
      { word: 'Worcestershire', phonetic: 'WUS-tur-shur' },
      { word: 'Pneumonia', phonetic: 'noo-MOH-nyuh' },
      { word: 'Archipelago', phonetic: 'ar-kih-PEL-uh-goh' },
    ],
  },
  {
    title: 'Medical / Scientific Terms',
    examples: [
      { word: 'Mitochondria', phonetic: 'my-toh-KON-dree-uh' },
      { word: 'Acetylcholine', phonetic: 'uh-see-tul-KOH-leen' },
      { word: 'Homeostasis', phonetic: 'hoh-mee-oh-STAY-sis' },
      { word: 'Neuroplasticity', phonetic: 'nyoor-oh-plas-TI-sih-tee' },
      { word: 'Telomere', phonetic: 'TEL-oh-meer' },
      { word: 'Autophagy', phonetic: 'aw-TO-fuh-jee' },
    ],
  },
];
