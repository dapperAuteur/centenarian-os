// lib/demo/seed-lister.ts
// Seeds a realistic lister/crew coordinator account with roster, jobs, assignments, and messages.

import { SupabaseClient } from '@supabase/supabase-js';

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
}
