// app/api/ai/recipe-ideas/route.ts
// POST: generate recipe ideas from user's current inventory via Gemini

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
}

// ── POST ─────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fetch inventory items with quantity > 0
  const { data: items, error } = await db
    .from('inventory')
    .select('quantity, unit, ingredient:ingredients(name, ncv_score)')
    .eq('user_id', user.id)
    .gt('quantity', 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ recipes: [], message: 'No inventory items found' });
  }

  // Build ingredient list for prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingredientList = items.map((item: any) => {
    const ing = Array.isArray(item.ingredient) ? item.ingredient[0] : item.ingredient;
    if (!ing) return null;
    return `${ing.name} (${item.quantity} ${item.unit}, NCV: ${ing.ncv_score})`;
  }).filter(Boolean);

  if (ingredientList.length === 0) {
    return NextResponse.json({ recipes: [], message: 'No ingredients found in inventory' });
  }

  const prompt = `You are a longevity-focused chef for CentenarianOS. The user has these ingredients in stock:

${ingredientList.join('\n')}

Suggest exactly 3 recipes that primarily use these ingredients. Prioritize "Green" NCV-scored ingredients. Each recipe should be healthy and longevity-oriented.

Return a JSON array of 3 objects with this shape:
[{
  "name": "Recipe Name",
  "description": "One sentence description",
  "ingredients_used": ["ingredient1", "ingredient2"],
  "extra_ingredients": ["any ingredients not in their inventory"],
  "instructions": ["Step 1...", "Step 2...", "Step 3..."],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "servings": 2,
  "nutritional_highlight": "High in fiber and omega-3s",
  "tags": ["high-protein", "anti-inflammatory"]
}]`;

  try {
    const raw = await callGemini(prompt);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return NextResponse.json({ recipes: parsed.slice(0, 3) });
    }
    return NextResponse.json({ recipes: [] });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate recipe ideas' },
      { status: 500 },
    );
  }
}
