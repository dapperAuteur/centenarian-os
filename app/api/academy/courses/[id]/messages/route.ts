// app/api/academy/courses/[id]/messages/route.ts
// GET: fetch message thread between current user and a partner for this course
// POST: send a message to a partner in this course

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const partnerId = request.nextUrl.searchParams.get('partner_id');
  if (!partnerId) return NextResponse.json({ error: 'partner_id required' }, { status: 400 });

  const db = getDb();

  // Fetch thread between user and partner for this course
  const { data: messages, error } = await db
    .from('course_messages')
    .select('id, course_id, sender_id, recipient_id, body, media_url, is_read, created_at')
    .eq('course_id', courseId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark received messages as read
  await db
    .from('course_messages')
    .update({ is_read: true })
    .eq('course_id', courseId)
    .eq('sender_id', partnerId)
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  return NextResponse.json(messages ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { recipient_id, body: msgBody, media_url } = body;

  if (!recipient_id || !msgBody?.trim()) {
    return NextResponse.json({ error: 'recipient_id and body are required' }, { status: 400 });
  }

  // Verify course exists
  const { data: course } = await db
    .from('courses')
    .select('id, teacher_id')
    .eq('id', courseId)
    .single();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // Sender must be enrolled student or teacher of this course
  const isTeacher = course.teacher_id === user.id;
  if (!isTeacher) {
    const { data: enrollment } = await db
      .from('enrollments')
      .select('status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ error: 'You must be enrolled or the teacher to send messages' }, { status: 403 });
    }
  }

  const { data: message, error } = await db
    .from('course_messages')
    .insert({
      course_id: courseId,
      sender_id: user.id,
      recipient_id,
      body: msgBody.trim(),
      media_url: media_url || null,
    })
    .select('id, course_id, sender_id, recipient_id, body, media_url, is_read, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(message);
}
