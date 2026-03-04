import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, priorities, message } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    if (name.trim().length > 200 || email.trim().length > 254) {
      return NextResponse.json({ error: 'Input too long.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    if (!priorities?.length) {
      return NextResponse.json({ error: 'Please select at least one priority.' }, { status: 400 });
    }

    if (message && message.trim().length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters).' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Rate limit: 1 application per email per 24 hours
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase
      .from('coaching_applications')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.trim().toLowerCase())
      .gte('created_at', yesterday);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'You have already submitted an application recently. Please try again later.' },
        { status: 429 }
      );
    }

    const { error } = await supabase.from('coaching_applications').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role?.trim() || null,
      priorities,
      message: message?.trim() || null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Coaching application error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
