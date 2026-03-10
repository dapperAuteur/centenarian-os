// lib/ocr/extractors.ts — Module-specific extraction prompts and types

import { callGemini, type GeminiImagePart } from './gemini';
import type { DocumentType } from './classify';

// ── Receipt ─────────────────────────────────────────────────────
export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  category_hint: string | null;
}

export interface ReceiptExtraction {
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
  total_amount: number | null;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  payment_method: string | null;
  currency: string | null;
  line_items: ReceiptLineItem[];
  suggested_category: string | null;
  confidence_notes: string;
}

// ── Recipe ──────────────────────────────────────────────────────
export interface RecipeIngredientExtraction {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeExtraction {
  title: string | null;
  author: string | null;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  ingredients: RecipeIngredientExtraction[];
  instructions: string | null;
  source: string;
  confidence_notes: string;
}

// ── Maintenance Invoice ─────────────────────────────────────────
export interface MaintenanceExtraction {
  shop_name: string | null;
  date: string | null;
  vehicle_description: string | null;
  odometer: number | null;
  services: { description: string; cost: number }[];
  parts: { name: string; quantity: number; cost: number }[];
  total_cost: number | null;
  labor_cost: number | null;
  parts_cost: number | null;
  confidence_notes: string;
}

// ── Fuel Receipt (matches existing OcrResult) ───────────────────
export interface FuelReceiptExtraction {
  odometer_miles: number | null;
  miles_since_last_fill: number | null;
  miles_this_month: number | null;
  mpg_display: number | null;
  gallons: number | null;
  total_cost: number | null;
  cost_per_gallon: number | null;
  fuel_grade: string | null;
  station: string | null;
  date: string | null;
  confidence_notes: string;
}

// ── Pay Stub / Estimated Pay ────────────────────────────────────
export interface PayStubLineItem {
  type: string;       // e.g. "ST", "OT", "DT", "MM2", "Vacation"
  rate: number | null;
  hours: number | null;
  amount: number;
}

export interface PayStubBenefit {
  name: string;       // e.g. "IBEW 1220 CBS 401K", "IATSE 317 Indiana Pension"
  amount: number;
}

export interface PayStubExtraction {
  client_name: string | null;
  job_number: string | null;
  event_name: string | null;
  work_date: string | null;      // YYYY-MM-DD
  est_pay_date: string | null;   // YYYY-MM-DD
  time_in: string | null;        // HH:MM AM/PM
  time_out: string | null;       // HH:MM AM/PM
  total_hours: number | null;
  earnings: PayStubLineItem[];
  est_earnings: number | null;
  benefits: PayStubBenefit[];
  est_benefits: number | null;
  poc_name: string | null;
  crew_coordinator: string | null;
  location_name: string | null;
  confidence_notes: string;
}

// ── Union type ──────────────────────────────────────────────────
export type ExtractionResult =
  | { type: 'receipt'; data: ReceiptExtraction }
  | { type: 'recipe'; data: RecipeExtraction }
  | { type: 'maintenance_invoice'; data: MaintenanceExtraction }
  | { type: 'fuel_receipt'; data: FuelReceiptExtraction }
  | { type: 'pay_stub'; data: PayStubExtraction }
  | { type: 'medical'; data: Record<string, unknown> }
  | { type: 'unknown'; data: Record<string, unknown> };

// ── Extraction Prompts ──────────────────────────────────────────

const RECEIPT_PROMPT = `You are extracting data from a store or restaurant receipt photo.

Extract all visible information and return ONLY valid JSON matching this schema:
{
  "vendor": "<store/restaurant name or null>",
  "date": "<YYYY-MM-DD or null>",
  "total_amount": <total charged as a number or null>,
  "subtotal": <subtotal before tax/tip or null>,
  "tax": <tax amount or null>,
  "tip": <tip amount or null>,
  "payment_method": "<cash, credit, debit, or null>",
  "currency": "<USD, EUR, etc. or null>",
  "line_items": [
    {
      "description": "<item name>",
      "quantity": <number, default 1>,
      "unit_price": <price per unit>,
      "total": <line total>,
      "category_hint": "<grocery, produce, dairy, meat, bakery, beverage, household, restaurant, clothing, electronics, or null>"
    }
  ],
  "suggested_category": "<overall category: groceries, dining, shopping, pharmacy, hardware, etc. or null>",
  "confidence_notes": "<brief note about extraction quality or uncertainty>"
}

Be precise with numbers. If a value is unclear, use null rather than guessing.`;

const RECIPE_PROMPT = `You are extracting recipe data from a cookbook page, recipe card, handwritten recipe, or printed recipe.

Extract all visible information and return ONLY valid JSON matching this schema:
{
  "title": "<recipe name or null>",
  "author": "<author/source name or null>",
  "servings": <number or null>,
  "prep_time_minutes": <number or null>,
  "cook_time_minutes": <number or null>,
  "ingredients": [
    {
      "name": "<ingredient name>",
      "quantity": <number or null>,
      "unit": "<g, kg, oz, lb, ml, L, cup, tbsp, tsp, piece, slice, whole, or null>"
    }
  ],
  "instructions": "<full instructions text or null>",
  "source": "scanned from image",
  "confidence_notes": "<brief note about extraction quality>"
}

Parse fraction quantities (½, ¼, ⅓, 1/2, etc.) into decimal numbers. Be thorough with ingredients — capture every listed ingredient.`;

const MAINTENANCE_PROMPT = `You are extracting data from a vehicle service or mechanic invoice/receipt.

Extract all visible information and return ONLY valid JSON matching this schema:
{
  "shop_name": "<mechanic/shop name or null>",
  "date": "<YYYY-MM-DD or null>",
  "vehicle_description": "<year make model or null>",
  "odometer": <mileage reading or null>,
  "services": [
    { "description": "<service performed>", "cost": <cost as number> }
  ],
  "parts": [
    { "name": "<part name>", "quantity": <number>, "cost": <cost as number> }
  ],
  "total_cost": <total amount or null>,
  "labor_cost": <labor total or null>,
  "parts_cost": <parts total or null>,
  "confidence_notes": "<brief note about extraction quality>"
}

Be precise with costs. Separate labor from parts if possible.`;

const FUEL_RECEIPT_PROMPT = `You are extracting fuel fill-up data from photos of a car dashboard and/or fuel pump.

The user photographs their dashboard showing multiple screens:
- Trip A display: miles driven since last fuel fill-up (resets at each fill-up)
- Trip B display: miles driven this calendar month (resets monthly; may equal Trip A if only one fill-up this month)
- ODO display: total odometer reading in miles
- MPG display (labeled "After Reset"): fuel economy since last reset

They may also include a photo of the fuel pump receipt showing total cost, gallons dispensed, and price per gallon.

Extract all available data and return ONLY valid JSON matching this schema exactly:
{
  "odometer_miles": <number or null>,
  "miles_since_last_fill": <number from Trip A display or null>,
  "miles_this_month": <number from Trip B display or null>,
  "mpg_display": <number labeled "After Reset" MPG or null>,
  "gallons": <gallons from pump display or null>,
  "total_cost": <dollar amount from pump or null>,
  "cost_per_gallon": <price per gallon from pump or null>,
  "fuel_grade": <"regular", "midgrade", "premium", "diesel", or null>,
  "station": <station name if visible or null>,
  "date": <date in YYYY-MM-DD format if determinable from image metadata or visible text, else null>,
  "confidence_notes": <brief string noting any uncertainty>
}

Return only the JSON object, no markdown, no explanation.`;

const PAY_STUB_PROMPT = `You are extracting data from a pay stub, estimated pay screen, or work invoice screenshot.

This is commonly from broadcast/production staffing apps (e.g., ProCrewz, MasterMind) showing pay details for a work day.

Extract all visible information and return ONLY valid JSON matching this schema:
{
  "client_name": "<company/org name, e.g. 'CBS Sports' or null>",
  "job_number": "<job ID like 'J-223680' or null>",
  "event_name": "<event name like '2026 BIG10 Women\\'s Championship' or null>",
  "work_date": "<YYYY-MM-DD or null>",
  "est_pay_date": "<YYYY-MM-DD or null>",
  "time_in": "<HH:MM AM/PM — prefer adjusted time over punch time, or null>",
  "time_out": "<HH:MM AM/PM — prefer adjusted time over punch time, or null>",
  "total_hours": <number or null>,
  "earnings": [
    {
      "type": "<pay type code: ST, OT, DT, MM2, Vacation, etc.>",
      "rate": <hourly rate as number or null>,
      "hours": <hours as number or null>,
      "amount": <dollar amount as number>
    }
  ],
  "est_earnings": <total estimated earnings as number or null>,
  "benefits": [
    {
      "name": "<benefit name, e.g. 'IBEW 1220 CBS 401K', 'IATSE 317 Indiana Pension'>",
      "amount": <dollar amount as number>
    }
  ],
  "est_benefits": <total estimated benefits as number or null>,
  "poc_name": "<point of contact name or null>",
  "crew_coordinator": "<crew coordinator name or null>",
  "location_name": "<venue name or null>",
  "confidence_notes": "<brief note about extraction quality>"
}

Be precise with numbers and rates. Capture ALL earning line items and ALL benefit line items separately.
If "Punch" and "Adjusted" times are shown, prefer the "Adjusted" values.
Return only the JSON object, no markdown, no explanation.`;

const EXTRACTION_PROMPTS: Record<string, string> = {
  receipt: RECEIPT_PROMPT,
  recipe: RECIPE_PROMPT,
  maintenance_invoice: MAINTENANCE_PROMPT,
  fuel_receipt: FUEL_RECEIPT_PROMPT,
  pay_stub: PAY_STUB_PROMPT,
};

export async function extractDocument(
  documentType: DocumentType,
  imageParts: GeminiImagePart[],
): Promise<ExtractionResult> {
  const prompt = EXTRACTION_PROMPTS[documentType];
  if (!prompt) {
    return { type: documentType as 'unknown', data: {} };
  }

  const data = await callGemini(prompt, imageParts);
  return { type: documentType, data } as ExtractionResult;
}
