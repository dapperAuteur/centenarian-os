/**
 * This file contains schema definitions for structured responses
 * from the Gemini API. We can use this to strongly type the
 * AI's output.
 */

import { z } from 'zod';

/**
 * Defines the schema for a single flashcard.
 * This is what we *expect* the AI to generate.
 */
export const FlashcardSchema = z.object({
  front: z.string().min(1, 'Front text cannot be empty'),
  back: z.string().min(1, 'Back text cannot be empty'),
  notes: z.string().optional(),
});

/**
 * Defines the schema for a list of flashcards.
 * The AI should be prompted to return data in this format.
 */
export const FlashcardSetSchema = z.object({
  title: z.string().min(1, 'Set title cannot be empty'),
  language: z.string().optional(),
  cards: z.array(FlashcardSchema).min(1, 'Must have at least one card'),
});

// Type definitions inferred from schemas
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type FlashcardSet = z.infer<typeof FlashcardSetSchema>;


/**
 * Helper function to parse flashcards from a simple text block.
 * This is a fallback for when the AI doesn't return JSON.
 * * We are prompting the AI to use this format in the instructions:
 * [START_FLASHCARDS]
 * F:: Front of card 1
 * B:: Back of card 1
 * F:: Front of card 2
 * B:: Back of card 2
 * [END_FLASHCARDS]
 */
export function parseFlashcardsFromText(text: string): Flashcard[] {
  const flashcards: Flashcard[] = [];
  
  // Isolate the flashcard block
  const blockMatch = text.match(/\[START_FLASHCARDS\]([\s\S]*?)\[END_FLASHCARDS\]/);
  if (!blockMatch) {
    return [];
  }

  const blockContent = blockMatch[1];
  
  // Regex to find F:: and B:: pairs
  // It looks for 'F::' followed by any content, then 'B::' followed by any content
  // 'gs' flags: g = global (find all), s = dotall ('.' matches newlines)
  const flashcardRegex = new RegExp(/F::(.*?)\nB::(.*?)(?=\nF::|\n*$)/, 'gs');

  let match;
  while ((match = flashcardRegex.exec(blockContent)) !== null) {
    const front = match[1]?.trim();
    const back = match[2]?.trim();

    if (front && back) {
      flashcards.push({ front, back });
    }
  }

  return flashcards;
}

/**
 * ====================================================================
 * EXAMPLE: How to modify the `Gemini Gem Instructions Draft.md`
 * to use this new format.
 * ====================================================================
 * * You should add this to your "Active Production Flashcard System"
 * instructions in your `gem_personas` table:
 * * "When you generate flashcards, you MUST output them in the
 * following format, inside a special block.
 * * [START_FLASHCARDS]
 * F:: [Spanish phrase]
 * B:: [English translation]
 * F:: [Spanish word]
 * B:: [English definition]
 * [END_FLASHCARDS]
 * * Only use this format. Do not add any other text inside the
 * [START_FLASHCARDS] and [END_FLASHCARDS] block."
 */
