// app/api/academy/courses/[id]/claims/route.ts
// Teacher claim-verification for a course.
// GET   -> { claims: [...with joined source], sources: [...] }
// POST  -> add a claim { claim_text, location?, lesson_id? }
// PATCH -> { claim_id, action: 'confirm' | 'drop' | 'reopen', source?: {...} }
//          confirm: create/link a course_source and mark the claim confirmed.
// Teacher-owned (or admin) only. Service-role client; ownership checked in code.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
type Params = { params: Promise<{ id: string }> };

async function requireOwner(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).maybeSingle();
  if (!course) return { error: NextResponse.json({ error: 'Course not found' }, { status: 404 }) };
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { db, user };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const ctx = await requireOwner(courseId);
  if (ctx.error) return ctx.error;
  const { db } = ctx;
  const { data: claims } = await db
    .from('course_claims')
    .select('id, claim_text, location, status, notes, lesson_id, source_id, confirmed_at, created_at, course_sources(id, in_text, apa, doi, url, pdf_url)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });
  const { data: sources } = await db
    .from('course_sources')
    .select('id, in_text, apa, doi, url, pdf_url, verified, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });
  return NextResponse.json({ claims: claims ?? [], sources: sources ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const ctx = await requireOwner(courseId);
  if (ctx.error) return ctx.error;
  const { db } = ctx;
  const { claim_text, location, lesson_id } = await request.json();
  if (!claim_text?.trim()) return NextResponse.json({ error: 'claim_text required' }, { status: 400 });
  const { data, error } = await db
    .from('course_claims')
    .insert({ course_id: courseId, claim_text: claim_text.trim(), location: location?.trim() || null, lesson_id: lesson_id || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const ctx = await requireOwner(courseId);
  if (ctx.error) return ctx.error;
  const { db, user } = ctx;
  const { claim_id, action, source } = await request.json();
  if (!claim_id || !['confirm', 'drop', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'claim_id and a valid action required' }, { status: 400 });
  }
  // claim must belong to this course
  const { data: claim } = await db.from('course_claims').select('id').eq('id', claim_id).eq('course_id', courseId).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

  if (action === 'drop') {
    const { data, error } = await db.from('course_claims').update({ status: 'dropped', confirmed_at: null }).eq('id', claim_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === 'reopen') {
    const { data, error } = await db.from('course_claims').update({ status: 'unconfirmed', source_id: null, confirmed_at: null }).eq('id', claim_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  // confirm: requires a source (a verified citation). Create or reuse it.
  if (!source || !(source.apa || source.doi || source.url)) {
    return NextResponse.json({ error: 'A source (apa, doi, or url) is required to confirm.' }, { status: 400 });
  }
  let sourceId: string | null = null;
  if (source.doi) {
    const { data: existing } = await db.from('course_sources').select('id').eq('course_id', courseId).eq('doi', source.doi).maybeSingle();
    if (existing) sourceId = existing.id;
  }
  if (!sourceId) {
    const { data: newSource, error: srcErr } = await db
      .from('course_sources')
      .insert({ course_id: courseId, in_text: source.in_text || null, apa: source.apa || null, doi: source.doi || null, url: source.url || null, pdf_url: source.pdf_url || source.pdfUrl || null, verified: true })
      .select('id')
      .single();
    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });
    sourceId = newSource.id;
  }
  const { data, error } = await db
    .from('course_claims')
    .update({ status: 'confirmed', source_id: sourceId, confirmed_at: new Date().toISOString(), confirmed_by: user.id })
    .eq('id', claim_id)
    .select('id, claim_text, location, status, source_id, course_sources(id, in_text, apa, doi, url, pdf_url)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
