// app/api/academy/courses/[id]/messages/route.ts
// GET: fetch message thread between current user and a partner for this course
// POST: send a message to a partner in this course

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { canSendCourseMessage, hasEnrollment, isUuid } from '@/lib/academy/access';

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
  // partner_id goes into a PostgREST or() filter: only a UUID may reach it.
  if (!isUuid(partnerId) || !isUuid(courseId)) {
    return NextResponse.json({ error: 'Invalid partner_id' }, { status: 400 });
  }

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

  if (!recipient_id || typeof msgBody !== 'string' || !msgBody.trim()) {
    return NextResponse.json({ error: 'recipient_id and body are required' }, { status: 400 });
  }
  if (!isUuid(recipient_id) || !isUuid(courseId)) {
    return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
  }

  // Verify course exists
  const { data: course } = await db
    .from('courses')
    .select('id, teacher_id')
    .eq('id', courseId)
    .maybeSingle();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // Messages run between the teacher and the course's students only: the
  // teacher writes to someone enrolled in this course, an active student
  // writes to the teacher.
  const isTeacher = course.teacher_id === user.id;
  const [senderEnrolled, recipientEnrolled] = await Promise.all([
    isTeacher ? Promise.resolve(false) : hasEnrollment(db, user.id, courseId),
    isTeacher ? hasEnrollment(db, recipient_id, courseId, false) : Promise.resolve(false),
  ]);
  if (!isTeacher && !senderEnrolled) {
    return NextResponse.json({ error: 'You must be enrolled or the teacher to send messages' }, { status: 403 });
  }
  if (!canSendCourseMessage({ course, senderId: user.id, recipientId: recipient_id, senderEnrolled, recipientEnrolled })) {
    return NextResponse.json({ error: 'You can only message the teacher or students of this course' }, { status: 403 });
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
