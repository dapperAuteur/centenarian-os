import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET — admin only: list all courses with teacher info and enrollment counts
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();

  const { data: courses, error } = await db
    .from('courses')
    .select(`
      id, title, is_published, price, price_type, category, created_at, teacher_id,
      profiles!courses_teacher_id_fkey(username, display_name, email),
      enrollments(count)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (courses || []).map((c) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const enrollCount = Array.isArray(c.enrollments) ? c.enrollments[0]?.count ?? 0 : 0;
    return {
      id: c.id,
      title: c.title,
      is_published: c.is_published,
      price: c.price,
      price_type: c.price_type,
      category: c.category,
      created_at: c.created_at,
      teacher_id: c.teacher_id,
      teacher_name: profile?.display_name || profile?.username || 'Unknown',
      teacher_email: profile?.email || '',
      enrollment_count: enrollCount,
    };
  });

  return NextResponse.json({ courses: formatted });
}
