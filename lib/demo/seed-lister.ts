// lib/demo/seed-lister.ts
// Seeds a realistic lister/crew coordinator account with roster, jobs, assignments, and messages.

import { SupabaseClient } from '@supabase/supabase-js';
import { daysAgo } from './seed';

const ROSTER_MEMBERS = [
  { name: 'Jake Morrison', email: 'jmorrison@example.com', phone: '317-555-4001', skills: ['Camera Op', 'Jib', 'Steadicam'], notes: 'IATSE 317. 15yrs exp. Prefers NFL/NCAA.' },
  { name: 'Amanda Liu', email: 'aliu@example.com', phone: '317-555-4002', skills: ['Camera Op', 'RF Camera'], notes: 'IATSE 317. Great with handheld. Available weekends.' },
  { name: 'Carlos Reyes', email: 'creyes@example.com', phone: '317-555-4003', skills: ['Audio A1', 'Audio A2'], notes: 'IBEW 1220. Owns comms package.' },
  { name: 'Nicole Foster', email: 'nfoster@example.com', phone: '317-555-4004', skills: ['Utility', 'Cable', 'EVS Replay'], notes: 'Non-union. Reliable, always early.' },
  { name: 'Marcus Johnson', email: 'mjohnson@example.com', phone: '317-555-4005', skills: ['Camera Op', 'Studio Camera'], notes: 'IATSE 317. Prefers basketball. Available Nov-Apr.' },
  { name: 'Emily Tanaka', email: 'etanaka@example.com', phone: '480-555-5001', skills: ['Camera Op', 'Jib', 'Rail Cam'], notes: 'Works AZ market. Can travel.' },
  { name: 'Bryan Scott', email: 'bscott@example.com', phone: '480-555-5002', skills: ['Utility', 'EIC', 'Shader'], notes: 'Technical director assist. AZ-based.' },
  { name: 'Priya Sharma', email: 'psharma@example.com', phone: '520-555-6001', skills: ['Camera Op', 'Robotic Camera'], notes: 'Tucson-based. U of A regular.' },
  { name: 'David Park', email: 'dpark@example.com', phone: '812-555-7001', skills: ['Audio A2', 'Parabolic'], notes: 'Bloomington local. IU games regular.' },
  { name: 'Rachel Green', email: 'rgreen@example.com', phone: '317-555-4006', skills: ['Graphics', 'Chyron', 'Telestrator'], notes: 'IATSE 317. In-house at Fieldhouse.' },
];

const LISTER_EVENTS = [
  { event: 'Colts vs Dolphins', client: 'CBS Sports', venue: 'Lucas Oil Stadium', start: '2025-09-07', positions: 3 },
  { event: 'Colts vs Broncos', client: 'CBS Sports', venue: 'Lucas Oil Stadium', start: '2025-09-14', positions: 3 },
  { event: 'Pacers vs Thunder', client: 'ESPN', venue: 'Gainbridge Fieldhouse', start: '2025-10-23', positions: 2 },
  { event: 'Pacers vs Warriors', client: 'NBC Sports', venue: 'Gainbridge Fieldhouse', start: '2025-11-01', positions: 2 },
  { event: 'IU vs Michigan State', client: 'Big Ten Network', venue: 'Memorial Stadium', start: '2025-10-18', positions: 2 },
  { event: 'B1G Women\'s BBall Tournament', client: 'CBS Sports', venue: 'Gainbridge Fieldhouse', start: '2026-03-04', positions: 4 },
  { event: 'NFL Draft Combine 2026', client: 'NFL Network', venue: 'Lucas Oil Stadium', start: '2026-02-23', positions: 6 },
  { event: 'Cardinals vs Seahawks (TNF)', client: 'ESPN', venue: 'State Farm Stadium', start: '2025-09-25', positions: 2 },
  { event: 'ASU vs Arizona (Territorial Cup)', client: 'Fox Sports', venue: 'Mountain America Stadium', start: '2025-11-28', positions: 2 },
  { event: 'Arizona vs UCLA', client: 'ESPN', venue: 'McKale Center at ALKEME Arena', start: '2025-11-14', positions: 2 },
  { event: 'Colts vs Texans', client: 'NBC Sports', venue: 'Lucas Oil Stadium', start: '2025-11-30', positions: 3 },
  { event: 'IU vs Purdue', client: 'Big Ten Network', venue: 'Simon Skjodt Assembly Hall', start: '2026-01-27', positions: 2 },
];

export async function seedLister(db: SupabaseClient, userId: string): Promise<void> {
  // Set lister profile
  await db.from('profiles').update({
    contractor_role: 'lister',
    lister_company_name: 'Midwest Crew Services',
    lister_union_local: 'IATSE 317',
  }).eq('id', userId);

  // 1. Create roster contacts
  const contactInserts = ROSTER_MEMBERS.map((m) => ({
    user_id: userId,
    name: m.name,
    contact_type: 'vendor' as const,
    email: m.email,
    phone: m.phone,
    skills: m.skills,
    availability_notes: m.notes,
    is_contractor: true,
  }));
  const { data: contacts, error: cErr } = await db.from('user_contacts').insert(contactInserts).select('id, name');
  if (cErr) throw new Error(`Roster contacts: ${cErr.message}`);

  // 2. Create lister jobs
  const today = new Date().toISOString().split('T')[0];
  const jobInserts = LISTER_EVENTS.map((e, i) => ({
    user_id: userId,
    lister_id: userId,
    job_number: `L-${100000 + i}`,
    client_name: e.client,
    event_name: e.event,
    location_name: e.venue,
    status: e.start < today ? 'completed' : 'confirmed',
    start_date: e.start,
    end_date: e.start,
    is_lister_job: true,
    pay_rate: 60,
    ot_rate: 90,
    rate_type: 'hourly',
    department: 'Camera',
    notes: `${e.positions} positions to fill`,
  }));
  const { data: jobs, error: jErr } = await db.from('contractor_jobs').insert(jobInserts).select('id, job_number, status');
  if (jErr) throw new Error(`Lister jobs: ${jErr.message}`);

  // 2b. Create job assignments (lister assigns roster members to jobs)
  const assignmentInserts = [];
  const statuses = ['accepted', 'accepted', 'offered', 'declined'] as const;
  for (let i = 0; i < Math.min((jobs ?? []).length, 8); i++) {
    const job = jobs![i];
    const positions = LISTER_EVENTS[i]?.positions ?? 2;
    for (let p = 0; p < Math.min(positions, (contacts ?? []).length); p++) {
      const contactIdx = (i * 2 + p) % (contacts ?? []).length;
      const s = statuses[(i + p) % statuses.length];
      assignmentInserts.push({
        job_id: job.id,
        assigned_by: userId,
        assigned_to: userId, // self-reference since no real contractor accounts exist
        status: s,
        message: `${LISTER_EVENTS[i].event} — Position ${p + 1}. Contact: ${contacts![contactIdx].name}`,
        response_note: s === 'accepted' ? 'Confirmed, see you there.' : s === 'declined' ? 'Sorry, already booked.' : null,
        responded_at: s !== 'offered' ? new Date().toISOString() : null,
      });
    }
  }
  if (assignmentInserts.length > 0) {
    // Insert one per job to avoid unique constraint (job_id, assigned_to)
    const uniqueAssignments = [];
    const seen = new Set<string>();
    for (const a of assignmentInserts) {
      const key = `${a.job_id}-${a.assigned_to}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueAssignments.push(a);
      }
    }
    const { error: aErr } = await db.from('contractor_job_assignments').insert(uniqueAssignments);
    if (aErr) throw new Error(`Assignments: ${aErr.message}`);
  }

  // 3. Create message groups
  const groups = [
    { lister_id: userId, name: 'Camera Department', description: 'All camera operators in Indiana/Arizona markets' },
    { lister_id: userId, name: 'Audio Team', description: 'Audio A1 and A2 operators' },
    { lister_id: userId, name: 'Indianapolis Crew', description: 'All crew members based in Indianapolis area' },
  ];
  const { data: createdGroups, error: gErr } = await db.from('lister_message_groups').insert(groups).select('id, name');
  if (gErr) throw new Error(`Groups: ${gErr.message}`);

  // 4. Add members to groups (use lister's own ID since no real contractor accounts)
  // In a real scenario these would be actual contractor user IDs
  if (createdGroups && createdGroups.length > 0) {
    // Add self to all groups as a placeholder member
    const memberInserts = createdGroups.map((g) => ({
      group_id: g.id,
      user_id: userId,
    }));
    const { error: gmErr } = await db.from('lister_message_group_members').insert(memberInserts);
    if (gmErr) throw new Error(`Group members: ${gmErr.message}`);
  }

  // 5. Create messages — group messages
  const groupMessages = [
    { sender_id: userId, subject: 'NFL Combine 2026 — Crew Call', body: 'Looking for 6 camera ops for the NFL Combine at Lucas Oil, Feb 23 - Mar 2. IATSE 317 rates. Long days but great gig. Reply if interested.' },
    { sender_id: userId, subject: 'B1G Tournament Crew', body: 'Need 4 camera ops for the B1G Women\'s Basketball Tournament at Gainbridge, Mar 4-8. CBS Sports rate card applies.' },
    { sender_id: userId, subject: 'Territorial Cup — AZ crew needed', body: 'ASU vs Arizona at Mountain America Stadium, Nov 28. Need 2 camera ops. Fox Sports rates. Who\'s available?' },
    { sender_id: userId, subject: 'Holiday Schedule Reminder', body: 'Heads up — Colts vs 49ers on Dec 22 and Suns vs Lakers on Dec 23. Both need full crews. Let me know availability ASAP so I can get assignments out.' },
    { sender_id: userId, subject: 'Rate Update — CBS Sports', body: 'CBS has updated their rate card for 2026 season. Camera ops now at $65/hr ST, $97.50 OT. Will apply to all CBS bookings going forward.' },
  ];

  if (createdGroups && createdGroups.length > 0) {
    const groupMsgInserts = groupMessages.map((m, i) => ({
      ...m,
      group_id: createdGroups[i % createdGroups.length].id,
    }));
    const { error: mErr } = await db.from('lister_messages').insert(groupMsgInserts);
    if (mErr) throw new Error(`Group messages: ${mErr.message}`);
  }

  // 6. Create individual messages (lister to self as placeholder)
  const individualMessages = [
    { sender_id: userId, recipient_id: userId, subject: 'Colts vs Dolphins — Confirmed', body: 'You\'re confirmed for Camera 3 at Lucas Oil, Sep 7. Call time 8:00 AM. Park in Lot 1, badge at Gate 1.' },
    { sender_id: userId, recipient_id: userId, subject: 'IU vs Purdue — Call Sheet Attached', body: 'Call sheet for IU vs Purdue at Assembly Hall, Jan 27. Camera positions assigned. Check your email for the PDF.' },
    { sender_id: userId, recipient_id: userId, subject: 'Availability Check — March', body: 'Checking your availability for the full B1G Tournament run, Mar 4-8. Five consecutive days at Gainbridge. Let me know.' },
    { sender_id: userId, recipient_id: userId, subject: 'W9 Reminder', body: 'Hey, CBS is asking for updated W9s before they\'ll process January invoices. Can you get yours in this week?' },
    { sender_id: userId, recipient_id: userId, subject: 'Great job last weekend', body: 'Client feedback from the Pacers game was excellent. You\'re on the shortlist for playoff games if they make the run.' },
  ];
  const { error: imErr } = await db.from('lister_messages').insert(individualMessages);
  if (imErr) throw new Error(`Individual messages: ${imErr.message}`);

  // ─── CENTOS MODULE DATA ──────────────────────────────────────────────────

  // 7. Financial Accounts + Transactions
  const { data: accts, error: acctErr } = await db
    .from('financial_accounts')
    .insert([
      { user_id: userId, name: 'Business Checking', account_type: 'checking', opening_balance: 12000.00, is_active: true },
      { user_id: userId, name: 'Business Credit Card', account_type: 'credit_card', opening_balance: 0, credit_limit: 20000, is_active: true },
    ])
    .select('id, name');
  if (acctErr) throw new Error(`Lister accounts: ${acctErr.message}`);

  const bizCheckingId = accts?.find(a => a.name === 'Business Checking')?.id;
  const bizCreditId = accts?.find(a => a.name === 'Business Credit Card')?.id;

  const { error: txErr } = await db.from('financial_transactions').insert([
    { user_id: userId, amount: 1200.00, type: 'expense', description: 'Camera crew — Colts vs Dolphins', vendor: 'Jake Morrison', transaction_date: daysAgo(5), source: 'manual', account_id: bizCheckingId },
    { user_id: userId, amount: 900.00, type: 'expense', description: 'Audio crew — Pacers vs Thunder', vendor: 'Carlos Reyes', transaction_date: daysAgo(8), source: 'manual', account_id: bizCheckingId },
    { user_id: userId, amount: 600.00, type: 'expense', description: 'Utility crew — IU vs Michigan State', vendor: 'Nicole Foster', transaction_date: daysAgo(12), source: 'manual', account_id: bizCheckingId },
    { user_id: userId, amount: 49.99, type: 'expense', description: 'CrewOps monthly subscription', vendor: 'CentenarianOS', transaction_date: daysAgo(15), source: 'manual', account_id: bizCreditId },
    { user_id: userId, amount: 29.99, type: 'expense', description: 'Google Workspace subscription', vendor: 'Google', transaction_date: daysAgo(18), source: 'manual', account_id: bizCreditId },
    { user_id: userId, amount: 245.00, type: 'expense', description: 'Office supplies — printer ink + paper', vendor: 'Staples', transaction_date: daysAgo(22), source: 'manual', account_id: bizCreditId },
  ]);
  if (txErr) throw new Error(`Lister transactions: ${txErr.message}`);

  // 8. Vehicle + Fuel Logs + Trips
  const { data: veh, error: vehErr } = await db
    .from('vehicles')
    .insert([{ user_id: userId, nickname: 'Work Truck', type: 'truck', make: 'Ford', model: 'F-150', year: 2023, ownership_type: 'owned', active: true }])
    .select('id');
  if (vehErr) throw new Error(`Lister vehicle: ${vehErr.message}`);
  const vehicleId = veh?.[0]?.id;

  if (vehicleId) {
    const { error: fuelErr } = await db.from('fuel_logs').insert([
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(4), odometer_miles: 18200, miles_since_last_fill: 280, gallons: 14.2, total_cost: 48.96, cost_per_gallon: 3.449, mpg_display: 19.7, station: 'Speedway', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(18), odometer_miles: 17920, miles_since_last_fill: 265, gallons: 13.8, total_cost: 47.61, cost_per_gallon: 3.450, mpg_display: 19.2, station: 'Circle K', fuel_grade: 'regular', source: 'manual' },
    ]);
    if (fuelErr) throw new Error(`Lister fuel logs: ${fuelErr.message}`);
  }

  const { error: tripErr } = await db.from('trips').insert([
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(3), mode: 'car', origin: 'Office', destination: 'Lucas Oil Stadium', distance_miles: 8.5, duration_min: 18, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(10), mode: 'car', origin: 'Office', destination: 'Gainbridge Fieldhouse', distance_miles: 6.2, duration_min: 14, trip_category: 'travel', tax_category: 'business', source: 'manual' },
  ]);
  if (tripErr) throw new Error(`Lister trips: ${tripErr.message}`);

  // 9. Equipment Categories + Equipment
  const { data: eqCats, error: eqCatErr } = await db
    .from('equipment_categories')
    .insert([
      { user_id: userId, name: 'Office', sort_order: 1 },
      { user_id: userId, name: 'Electronics', sort_order: 2 },
    ])
    .select('id, name');
  if (eqCatErr) throw new Error(`Lister equipment categories: ${eqCatErr.message}`);
  const eqCatIdFn = (name: string) => eqCats?.find(c => c.name === name)?.id ?? null;

  const { error: eqErr } = await db.from('equipment').insert([
    { user_id: userId, name: 'MacBook Pro 16"', category_id: eqCatIdFn('Electronics'), brand: 'Apple', purchase_date: daysAgo(120), purchase_price: 2499, current_value: 2100, condition: 'excellent' },
    { user_id: userId, name: 'iPhone 15 Pro', category_id: eqCatIdFn('Electronics'), brand: 'Apple', purchase_date: daysAgo(90), purchase_price: 1199, current_value: 1050, condition: 'good' },
    { user_id: userId, name: 'Ring Light', category_id: eqCatIdFn('Office'), brand: 'Neewer', purchase_date: daysAgo(60), purchase_price: 89, current_value: 75, condition: 'good' },
  ]);
  if (eqErr) throw new Error(`Lister equipment: ${eqErr.message}`);

  // 10. Exercise Categories + Exercises
  const { data: exCats, error: exCatErr } = await db
    .from('exercise_categories')
    .insert([
      { user_id: userId, name: 'Cardio', sort_order: 1 },
      { user_id: userId, name: 'Strength', sort_order: 2 },
      { user_id: userId, name: 'Flexibility', sort_order: 3 },
    ])
    .select('id, name');
  if (exCatErr) throw new Error(`Lister exercise categories: ${exCatErr.message}`);
  const exCatId = (name: string) => exCats?.find(c => c.name === name)?.id ?? null;

  const { data: exerciseData, error: exErr } = await db
    .from('exercises')
    .insert([
      { user_id: userId, name: 'Morning Walk', category_id: exCatId('Cardio'), default_duration_sec: 1800, primary_muscles: ['legs', 'cardio'] },
      { user_id: userId, name: 'Desk Stretches', category_id: exCatId('Flexibility'), default_sets: 3, default_duration_sec: 60, primary_muscles: ['back', 'shoulders'] },
      { user_id: userId, name: 'Dumbbell Rows', category_id: exCatId('Strength'), default_sets: 3, default_reps: 12, primary_muscles: ['back', 'biceps'] },
    ])
    .select('id, name');
  if (exErr) throw new Error(`Lister exercises: ${exErr.message}`);

  // 11. Workout Log with 2 exercises
  const { data: logData, error: logErr } = await db
    .from('workout_logs')
    .insert([{ user_id: userId, name: 'Quick Morning Routine', date: daysAgo(1), duration_min: 30, overall_feeling: 4, purpose: ['health', 'energy'] }])
    .select('id');
  if (logErr) throw new Error(`Lister workout log: ${logErr.message}`);
  const logId = logData?.[0]?.id;

  if (logId && exerciseData) {
    const exId = (name: string) => exerciseData.find(e => e.name === name)?.id ?? null;
    const { error: logExErr } = await db.from('workout_log_exercises').insert([
      { log_id: logId, name: 'Morning Walk', exercise_id: exId('Morning Walk'), sets_completed: 1, duration_sec: 1800, sort_order: 1, phase: 'warmup' },
      { log_id: logId, name: 'Dumbbell Rows', exercise_id: exId('Dumbbell Rows'), sets_completed: 3, reps_completed: 12, weight_lbs: 35, sort_order: 2, phase: 'working', rpe: 7 },
    ]);
    if (logExErr) throw new Error(`Lister workout log exercises: ${logExErr.message}`);
  }

  // 12. Health Metrics (7 days)
  const healthRows = Array.from({ length: 7 }, (_, i) => ({
    user_id: userId,
    logged_date: daysAgo(i),
    resting_hr: 62 + Math.floor(Math.random() * 6),
    steps: 5000 + Math.floor(Math.random() * 4000),
    sleep_hours: +(6 + Math.random() * 2).toFixed(1),
    activity_min: 15 + Math.floor(Math.random() * 40),
    source: 'manual' as const,
  }));
  const { error: hmErr } = await db.from('user_health_metrics').insert(healthRows);
  if (hmErr) throw new Error(`Lister health metrics: ${hmErr.message}`);

  // 13. Life Categories
  const { error: lcErr } = await db.from('life_categories').insert([
    { user_id: userId, name: 'Career', icon: 'briefcase', color: '#6366f1', sort_order: 1 },
    { user_id: userId, name: 'Health', icon: 'heart', color: '#ef4444', sort_order: 2 },
    { user_id: userId, name: 'Finance', icon: 'dollar-sign', color: '#10b981', sort_order: 3 },
    { user_id: userId, name: 'Relationships', icon: 'users', color: '#f59e0b', sort_order: 4 },
  ]);
  if (lcErr) throw new Error(`Lister life categories: ${lcErr.message}`);

  // 14. Focus Sessions
  const { error: fsErr } = await db.from('focus_sessions').insert([
    { user_id: userId, start_time: new Date(Date.now() - 86400000 - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 86400000 - 40 * 60000).toISOString(), duration: 50, notes: 'Crew scheduling for B1G Tournament — assigning 4 camera positions', session_type: 'work' },
    { user_id: userId, start_time: new Date(Date.now() - 172800000 - 60 * 60000).toISOString(), end_time: new Date(Date.now() - 172800000 - 30 * 60000).toISOString(), duration: 30, notes: 'Reviewing CBS Sports contracts and updated rate cards for 2026', session_type: 'focus' },
  ]);
  if (fsErr) throw new Error(`Lister focus sessions: ${fsErr.message}`);

  // 15. Blog Post
  const { error: blogErr } = await db.from('blog_posts').insert([
    {
      user_id: userId, title: 'How I Manage 50+ Contractors Without Losing My Mind',
      slug: 'manage-50-contractors',
      excerpt: 'Systems, tools, and habits that keep my freelance crew operation running smoothly across multiple markets.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'When you coordinate camera crews across Indiana and Arizona for CBS, ESPN, and Fox Sports, things can spiral fast. I manage over 50 freelance contractors across 12+ events per season. The key is systems: every crew member is in my roster with skills tagged, every job has a number and a status, and every assignment gets tracked from offer to acceptance. I use CrewOps to send group messages by department, track who\'s available, and keep a paper trail of every booking. The biggest lesson? Over-communicate early so you never scramble late. A 5-minute availability check on Monday saves a 2-hour panic on Friday.' }] }] },
      visibility: 'public', tags: ['crew-management', 'freelance', 'operations'],
      published_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ]);
  if (blogErr) throw new Error(`Lister blog post: ${blogErr.message}`);
}
