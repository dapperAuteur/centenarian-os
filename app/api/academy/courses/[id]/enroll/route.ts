// app/api/academy/courses/[id]/enroll/route.ts
// POST: enroll in a course.
//   - Free courses: direct enrollment.
//   - Paid courses: create Stripe checkout.
//     - Platform teachers (PLATFORM_TEACHER_EMAILS): payment goes directly to platform account, no Connect fees.
//     - Third-party teachers: application_fee + transfer_data via Stripe Connect.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function isPlatformTeacherEmail(email: string): boolean {
  // Admin is always a platform teacher (payments go to platform account)
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) return true;

  const platformEmails = (process.env.PLATFORM_TEACHER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return platformEmails.length > 0 && platformEmails.includes(email.toLowerCase());
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();

  // Get course details — separate query for teacher_profiles since there's no direct FK from courses
  const { data: course, error: courseErr } = await db
    .from('courses')
    .select('id, title, price, price_type, is_published, teacher_id, stripe_price_id, stripe_product_id, trial_period_days')
    .eq('id', courseId)
    .maybeSingle();

  if (courseErr || !course || !course.is_published) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const isFree = course.price_type === 'free' || Number(course.price) === 0;

  // Unauthenticated users: free courses grant guest access, paid courses prompt login
  if (!user) {
    if (isFree) {
      return NextResponse.json({ enrolled: true, guest: true });
    }
    return NextResponse.json(
      { error: 'Login required to enroll', login_required: true },
      { status: 401 },
    );
  }

  // Fetch teacher's Connect info separately (may not exist for platform teachers)
  const { data: teacherProfile } = await db
    .from('teacher_profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('user_id', course.teacher_id)
    .maybeSingle();

  // Block teacher from enrolling in own course
  if (course.teacher_id === user.id) {
    return NextResponse.json({ error: 'You cannot enroll in your own course' }, { status: 400 });
  }

  // Parse optional reattempt flag from request body
  let reattempt = false;
  try {
    const reqBody = await request.clone().json();
    reattempt = reqBody?.reattempt === true;
  } catch { /* no body or invalid JSON — default enrollment */ }

  // Check existing enrollments (ordered by latest attempt)
  const { data: existingEnrollments } = await db
    .from('enrollments')
    .select('status, attempt_number, metric_slots')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .order('attempt_number', { ascending: false });

  const latestEnrollment = existingEnrollments?.[0];

  if (latestEnrollment?.status === 'active') {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 400 });
  }

  // Determine attempt number and metric slots for re-enrollment
  const attemptNumber = reattempt && latestEnrollment
    ? latestEnrollment.attempt_number + 1
    : latestEnrollment?.attempt_number ?? 1;
  const metricSlots = Math.min(attemptNumber, 3);

  // ── Prerequisite check ──
  const { data: prereqs } = await db
    .from('course_prerequisites')
    .select('prerequisite_course_id, enforcement, courses!course_prerequisites_prerequisite_course_id_fkey(title)')
    .eq('course_id', courseId)
    .eq('enforcement', 'required');

  const requiredPrereqs = prereqs ?? [];

  if (requiredPrereqs.length > 0) {
    // Check for a teacher override first
    const { data: override } = await db
      .from('prerequisite_overrides')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!override) {
      // Check completion of each required prerequisite
      const missing: { id: string; title: string }[] = [];

      for (const p of requiredPrereqs) {
        const prereqId = p.prerequisite_course_id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prereqCourse = (p as any).courses as { title: string } | null;

        // Get all lesson IDs in the prerequisite course
        const { data: modules } = await db
          .from('course_modules')
          .select('id')
          .eq('course_id', prereqId);
        const moduleIds = (modules ?? []).map((m) => m.id);

        if (moduleIds.length === 0) continue; // no modules = no prereq to satisfy

        const { data: lessons } = await db
          .from('lessons')
          .select('id')
          .in('module_id', moduleIds);
        const lessonIds = (lessons ?? []).map((l) => l.id);

        if (lessonIds.length === 0) continue;

        const { count: done } = await db
          .from('lesson_progress')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
          .not('completed_at', 'is', null);

        if ((done ?? 0) < lessonIds.length) {
          missing.push({ id: prereqId, title: prereqCourse?.title ?? 'Unknown Course' });
        }
      }

      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'Prerequisites not met', missing_prerequisites: missing },
          { status: 403 },
        );
      }
    }
  }

  // Free course — enroll directly
  if (course.price_type === 'free' || Number(course.price) === 0) {
    await db.from('enrollments').insert({
      user_id: user.id,
      course_id: courseId,
      status: 'active',
      attempt_number: attemptNumber,
      metric_slots: metricSlots,
    });

    return NextResponse.json({ enrolled: true });
  }

  // Determine if this is a platform teacher (payments go directly to platform, no Connect fees)
  const { data: { user: teacherAuthUser } } = await db.auth.admin.getUserById(course.teacher_id);
  const isPlatformTeacher = !!teacherAuthUser?.email && isPlatformTeacherEmail(teacherAuthUser.email);

  // Third-party teachers must have completed Connect onboarding
  if (!isPlatformTeacher && (!teacherProfile?.stripe_connect_account_id || !teacherProfile?.stripe_connect_onboarded)) {
    return NextResponse.json({ error: 'Teacher has not set up payouts yet' }, { status: 503 });
  }

  // Get platform fee (only relevant for Connect teachers)
  const { data: feeSetting } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'teacher_fee_percent')
    .maybeSingle();

  const feePercent = Number(feeSetting?.value ?? '15');
  const priceInCents = Math.round(Number(course.price) * 100);
  const applicationFee = Math.round(priceInCents * (feePercent / 100));

  // Get or create Stripe customer for the student
  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? 'http://localhost:3000';

  if (course.price_type === 'one_time') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let priceId = (course as any).stripe_price_id as string | undefined;

    if (!priceId) {
      if (isPlatformTeacher) {
        // Create product + price on the platform account directly (no stripeAccount option)
        const product = await stripe.products.create({ name: course.title, metadata: { course_id: courseId } });
        const price = await stripe.prices.create({ unit_amount: priceInCents, currency: 'usd', product: product.id });
        priceId = price.id;
        await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
      } else {
        // Create product + price on teacher's Connect account
        const product = await stripe.products.create(
          { name: course.title, metadata: { course_id: courseId } },
          { stripeAccount: teacherProfile!.stripe_connect_account_id },
        );
        const price = await stripe.prices.create(
          { unit_amount: priceInCents, currency: 'usd', product: product.id },
          { stripeAccount: teacherProfile!.stripe_connect_account_id },
        );
        priceId = price.id;
        await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
      }
    }

    if (isPlatformTeacher) {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/academy/${courseId}`,
        metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment', attempt_number: String(attemptNumber) },
      });
      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: teacherProfile!.stripe_connect_account_id },
      },
      success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/academy/${courseId}`,
      metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment', attempt_number: String(attemptNumber) },
    }, { stripeAccount: teacherProfile!.stripe_connect_account_id });

    return NextResponse.json({ url: session.url });
  }

  // Subscription course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let priceId = (course as any).stripe_price_id as string | undefined;
  if (!priceId) {
    if (isPlatformTeacher) {
      const product = await stripe.products.create({ name: course.title, metadata: { course_id: courseId } });
      const price = await stripe.prices.create({
        unit_amount: priceInCents,
        currency: 'usd',
        product: product.id,
        recurring: { interval: 'month' },
      });
      priceId = price.id;
      await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
    } else {
      const product = await stripe.products.create(
        { name: course.title, metadata: { course_id: courseId } },
        { stripeAccount: teacherProfile!.stripe_connect_account_id },
      );
      const price = await stripe.prices.create(
        { unit_amount: priceInCents, currency: 'usd', product: product.id, recurring: { interval: 'month' } },
        { stripeAccount: teacherProfile!.stripe_connect_account_id },
      );
      priceId = price.id;
      await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trialDays = Number((course as any).trial_period_days ?? 0);

  if (isPlatformTeacher) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialDays > 0 && {
        subscription_data: {
          trial_period_days: trialDays,
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        },
      }),
      success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/academy/${courseId}`,
      metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment', attempt_number: String(attemptNumber) },
    });
    return NextResponse.json({ url: session.url });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      application_fee_percent: feePercent,
      transfer_data: { destination: teacherProfile!.stripe_connect_account_id },
      ...(trialDays > 0 && {
        trial_period_days: trialDays,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      }),
    },
    success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/academy/${courseId}`,
    metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment', attempt_number: String(attemptNumber) },
  }, { stripeAccount: teacherProfile!.stripe_connect_account_id });

  return NextResponse.json({ url: session.url });
}
