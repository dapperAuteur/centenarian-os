// lib/ocr/classify.ts — Document type classification via Gemini Vision

import { callGemini, type GeminiImagePart } from './gemini';

export type DocumentType =
  | 'receipt'
  | 'recipe'
  | 'fuel_receipt'
  | 'maintenance_invoice'
  | 'medical'
  | 'unknown';

export interface ClassificationResult {
  document_type: DocumentType;
  confidence: number; // 0–1
  reasoning: string;
}

const CLASSIFY_PROMPT = `You are a document classification AI. Examine the image(s) and determine the document type.

Classify as ONE of these types:
- "receipt" — a store, restaurant, or general purchase receipt showing items and a total
- "recipe" — a recipe card, cookbook page, handwritten recipe, or printed recipe
- "fuel_receipt" — a gas station pump receipt or a car dashboard showing fuel/odometer displays
- "maintenance_invoice" — a mechanic, auto shop, or vehicle service invoice
- "medical" — a medical bill, lab result, prescription, or health-related document
- "unknown" — cannot determine the document type

Return ONLY valid JSON:
{
  "document_type": "<type>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief one-sentence explanation>"
}`;

export async function classifyDocument(
  imageParts: GeminiImagePart[],
): Promise<ClassificationResult> {
  return callGemini<ClassificationResult>(CLASSIFY_PROMPT, imageParts);
}
