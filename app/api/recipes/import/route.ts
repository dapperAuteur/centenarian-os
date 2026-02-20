// app/api/recipes/import/route.ts
// Fetches a recipe URL server-side, extracts schema.org/Recipe JSON-LD data,
// and returns normalized recipe fields for the RecipeForm to pre-populate.
// No extra packages — uses fetch + regex + JSON.parse.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DraftIngredient } from '@/components/recipes/RecipeIngredientBuilder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration (e.g. PT1H30M) → total minutes */
function parseDuration(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  return (+(match[1] ?? 0) * 60) + +(match[2] ?? 0);
}

/** Parse Unicode fraction characters and slash fractions → number */
function parseFraction(s: string): number {
  const fractions: Record<string, number> = {
    '½': 0.5, '¼': 0.25, '¾': 0.75,
    '⅓': 0.333, '⅔': 0.667,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  let result = 0;
  for (const [char, val] of Object.entries(fractions)) {
    if (s.includes(char)) { result += val; s = s.replace(char, ''); }
  }
  // Handle slash fractions like 1/2
  const slashMatch = s.trim().match(/^(\d+)\/(\d+)$/);
  if (slashMatch) return result + parseInt(slashMatch[1]) / parseInt(slashMatch[2]);
  const num = parseFloat(s.trim());
  return result + (isNaN(num) ? 0 : num);
}

/** Parse an ingredient string like "2 1/2 cups all-purpose flour" → DraftIngredient */
function parseIngredient(str: string, index: number): DraftIngredient {
  // Strip leading bullet/dash/asterisk
  const cleaned = str.replace(/^[-•*]\s*/, '').trim();

  // Match: optional_quantity optional_unit rest
  const match = cleaned.match(
    /^([¼½¾⅓⅔⅛⅜⅝⅞\d.\s/]+)?\s*([a-zA-Z]+\.?)?\s*(.*)/
  );

  const rawQty = (match?.[1] ?? '').trim();
  let quantity = 0;
  if (rawQty) {
    // Handle compound quantities like "1 1/2"
    const parts = rawQty.split(/\s+/);
    quantity = parts.reduce((acc, p) => acc + parseFraction(p), 0);
  }

  const unit = match?.[2]?.trim() ?? '';
  const name = (match?.[3]?.trim() || cleaned) || cleaned;

  return {
    name: name || cleaned,
    quantity: quantity > 0 ? quantity : 1,
    unit,
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fiber_g: null,
    usda_fdc_id: null,
    off_barcode: null,
    brand: null,
    sort_order: index,
  };
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

/** Extract first number from a string like "4 servings" or "4-6" */
function parseServings(val: unknown): number | null {
  if (!val) return null;
  const str = Array.isArray(val) ? val[0] : String(val);
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let url: string;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Basic URL validation
  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Fetch the page server-side (avoids CORS restrictions)
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CentenarianOS/1.0; recipe-importer)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error('[recipe-import] Fetch failed:', err);
    return NextResponse.json({ error: 'Could not fetch the URL. Check that it is publicly accessible.' }, { status: 422 });
  }

  // Extract all JSON-LD script blocks
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let recipeData: Record<string, unknown> | null = null;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      // Handle @graph array or direct object
      const items: unknown[] = parsed['@graph'] ?? (Array.isArray(parsed) ? parsed : [parsed]);
      const recipe = items.find((item) => {
        const t = (item as Record<string, unknown>)['@type'];
        return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
      });
      if (recipe) { recipeData = recipe as Record<string, unknown>; break; }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  if (!recipeData) {
    return NextResponse.json(
      { error: 'No recipe data found on this page. The site may not use structured data (schema.org/Recipe).' },
      { status: 422 }
    );
  }

  // Map schema.org/Recipe fields to our form fields
  const title = typeof recipeData.name === 'string' ? stripHtml(recipeData.name) : '';
  const description = typeof recipeData.description === 'string' ? stripHtml(recipeData.description) : '';
  const servings = parseServings(recipeData.recipeYield);
  const prepTime = parseDuration(String(recipeData.prepTime ?? ''));
  const cookTime = parseDuration(String(recipeData.cookTime ?? ''));

  const rawIngredients: string[] = Array.isArray(recipeData.recipeIngredient)
    ? (recipeData.recipeIngredient as unknown[]).map(String)
    : [];

  const ingredients: DraftIngredient[] = rawIngredients
    .filter((s) => s.trim().length > 0)
    .map((s, i) => parseIngredient(s, i));

  return NextResponse.json({
    title,
    description,
    servings: servings ?? undefined,
    prepTime: prepTime || undefined,
    cookTime: cookTime || undefined,
    ingredients,
    sourceUrl: url,
  });
}
