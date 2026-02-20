// app/api/feedback/route.ts
// Accepts user feedback submissions and stores them in user_feedback table.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_CATEGORIES = ['bug', 'feature', 'general'] as const;
type Category = typeof VALID_CATEGORIES[number];

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { category?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { category, message } = body;

  if (!category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: 'category must be one of: bug, feature, general' }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: 'message must be 2000 characters or fewer' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('user_feedback')
    .insert({ user_id: user.id, category, message: message.trim() })
    .select('id')
    .single();

  if (error) {
    console.error('[feedback] Insert failed:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
