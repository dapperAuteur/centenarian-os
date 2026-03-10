// lib/demo/seed-contractor.ts
// Seeds a realistic contractor account with real venues and sports schedules.

import { SupabaseClient } from '@supabase/supabase-js';
import { daysAgo } from './seed';

// ─── Real Venues ──────────────────────────────────────────────────────────
const VENUES = [
  { name: 'Lucas Oil Stadium', address: '500 S Capitol Ave, Indianapolis, IN 46225', city: 'Indianapolis', state: 'IN' },
  { name: 'Gainbridge Fieldhouse', address: '125 S Pennsylvania St, Indianapolis, IN 46204', city: 'Indianapolis', state: 'IN' },
  { name: 'Simon Skjodt Assembly Hall', address: '1001 E 17th St, Bloomington, IN 47408', city: 'Bloomington', state: 'IN' },
  { name: 'Memorial Stadium', address: '701 E 17th St, Bloomington, IN 47408', city: 'Bloomington', state: 'IN' },
  { name: 'Mountain America Stadium', address: '500 E Veterans Way, Tempe, AZ 85287', city: 'Tempe', state: 'AZ' },
  { name: 'Desert Financial Arena', address: '600 E Veterans Way, Tempe, AZ 85281', city: 'Tempe', state: 'AZ' },
  { name: 'McKale Center at ALKEME Arena', address: '1 National Championship Dr, Tucson, AZ 85721', city: 'Tucson', state: 'AZ' },
  { name: 'State Farm Stadium', address: '1 Cardinals Dr, Glendale, AZ 85305', city: 'Glendale', state: 'AZ' },
  { name: 'Casino Del Sol Stadium', address: '545 N National Champion Dr, Tucson, AZ 85745', city: 'Tucson', state: 'AZ' },
];

// Knowledge base entries for key venues
const VENUE_KB: Record<string, Record<string, string>> = {
  'Lucas Oil Stadium': {
    parking: 'Lot 1 (crew) off S Meridian St. $20/day. Badge required after 6am.',
    load_in: 'Dock C on south side. Freight elevator to level 4. Badge required.',
    wifi: 'LOS-Production / pw: provided day-of by technical director',
    power: '200A distro at each camera platform. 20A in press box.',
    catering: 'Green room level 3, section 145. Breakfast 6am, lunch 11:30am.',
    security: 'Badge pickup at Gate 1 security office. Photo ID required.',
  },
  'Gainbridge Fieldhouse': {
    parking: 'Garage on Delaware St. Crew validation at production office.',
    load_in: 'Loading dock on Maryland St. Check in with building ops.',
    wifi: 'GBF-Media / pw: rotates monthly, check call sheet',
    power: 'Standard 20A circuits at all camera positions. 60A at video village.',
    catering: 'Media dining room level 2. Open 2hrs before tip.',
    security: 'Credential pickup at media entrance, Pennsylvania St side.',
  },
  'State Farm Stadium': {
    parking: 'Red lot, south side. Free with crew credential. Gate opens 5hrs pre.',
    load_in: 'Loading dock east side off 95th Ave. Ground-level access.',
    wifi: 'SFS-Broadcast / pw: on call sheet',
    power: '400A main distro field level. Tie-in required, coordinate with venue.',
    catering: 'Crew meal tent, north concourse. Opens 4hrs before kickoff.',
    security: 'Credential office at Gate 2. All bags subject to search.',
  },
};

// ─── Real Schedules ───────────────────────────────────────────────────────
interface GameEvent {
  client: string;
  event: string;
  venue: string;
  start: string;
  end: string;
  department: string;
  rate: number;
  ot_rate: number;
  union?: string;
}

const EVENTS: GameEvent[] = [
  // Colts (NFL) — Lucas Oil Stadium
  { client: 'CBS Sports', event: 'Colts vs Dolphins', venue: 'Lucas Oil Stadium', start: '2025-09-07', end: '2025-09-07', department: 'Camera', rate: 65, ot_rate: 97.5, union: 'IATSE 317' },
  { client: 'CBS Sports', event: 'Colts vs Broncos', venue: 'Lucas Oil Stadium', start: '2025-09-14', end: '2025-09-14', department: 'Camera', rate: 65, ot_rate: 97.5, union: 'IATSE 317' },
  { client: 'Fox Sports', event: 'Colts vs Raiders', venue: 'Lucas Oil Stadium', start: '2025-10-05', end: '2025-10-05', department: 'Camera', rate: 65, ot_rate: 97.5, union: 'IATSE 317' },
  { client: 'ESPN', event: 'Colts vs Cardinals', venue: 'Lucas Oil Stadium', start: '2025-10-12', end: '2025-10-12', department: 'Camera', rate: 70, ot_rate: 105, union: 'IATSE 317' },
  { client: 'NBC Sports', event: 'Colts vs Texans', venue: 'Lucas Oil Stadium', start: '2025-11-30', end: '2025-11-30', department: 'Camera', rate: 70, ot_rate: 105, union: 'IATSE 317' },
  { client: 'Fox Sports', event: 'Colts vs 49ers', venue: 'Lucas Oil Stadium', start: '2025-12-22', end: '2025-12-22', department: 'Camera', rate: 65, ot_rate: 97.5, union: 'IATSE 317' },

  // NFL Combine — Lucas Oil
  { client: 'NFL Network', event: 'NFL Draft Combine 2026', venue: 'Lucas Oil Stadium', start: '2026-02-23', end: '2026-03-02', department: 'Camera', rate: 75, ot_rate: 112.5, union: 'IATSE 317' },

  // Pacers (NBA) — Gainbridge Fieldhouse
  { client: 'ESPN', event: 'Pacers vs Thunder', venue: 'Gainbridge Fieldhouse', start: '2025-10-23', end: '2025-10-23', department: 'Camera', rate: 55, ot_rate: 82.5, union: 'IATSE 317' },
  { client: 'NBC Sports', event: 'Pacers vs Warriors', venue: 'Gainbridge Fieldhouse', start: '2025-11-01', end: '2025-11-01', department: 'Camera', rate: 55, ot_rate: 82.5, union: 'IATSE 317' },
  { client: 'Fox Sports Indiana', event: 'Pacers vs Kings', venue: 'Gainbridge Fieldhouse', start: '2025-12-08', end: '2025-12-08', department: 'Camera', rate: 50, ot_rate: 75, union: 'IATSE 317' },
  { client: 'ESPN', event: 'Pacers vs Knicks', venue: 'Gainbridge Fieldhouse', start: '2026-03-13', end: '2026-03-13', department: 'Camera', rate: 55, ot_rate: 82.5, union: 'IATSE 317' },

  // B1G Tourney — Gainbridge
  { client: 'CBS Sports', event: 'B1G Women\'s Basketball Tournament', venue: 'Gainbridge Fieldhouse', start: '2026-03-04', end: '2026-03-08', department: 'Camera', rate: 60, ot_rate: 90, union: 'IATSE 317' },

  // IU Football — Memorial Stadium
  { client: 'Big Ten Network', event: 'IU vs North Texas', venue: 'Memorial Stadium', start: '2025-09-06', end: '2025-09-06', department: 'Utility', rate: 45, ot_rate: 67.5 },
  { client: 'Big Ten Network', event: 'IU vs Michigan State', venue: 'Memorial Stadium', start: '2025-10-18', end: '2025-10-18', department: 'Utility', rate: 45, ot_rate: 67.5 },

  // IU Basketball — Assembly Hall
  { client: 'Big Ten Network', event: 'IU vs Purdue', venue: 'Simon Skjodt Assembly Hall', start: '2026-01-27', end: '2026-01-27', department: 'Camera', rate: 50, ot_rate: 75 },

  // Cardinals (NFL) — State Farm Stadium
  { client: 'Fox Sports', event: 'Cardinals vs Panthers', venue: 'State Farm Stadium', start: '2025-09-14', end: '2025-09-14', department: 'Camera', rate: 70, ot_rate: 105 },
  { client: 'ESPN', event: 'Cardinals vs Seahawks (TNF)', venue: 'State Farm Stadium', start: '2025-09-25', end: '2025-09-25', department: 'Camera', rate: 75, ot_rate: 112.5 },
  { client: 'Fox Sports', event: 'Cardinals vs Packers', venue: 'State Farm Stadium', start: '2025-10-19', end: '2025-10-19', department: 'Camera', rate: 70, ot_rate: 105 },
  { client: 'CBS Sports', event: 'Cardinals vs 49ers', venue: 'State Farm Stadium', start: '2025-11-16', end: '2025-11-16', department: 'Camera', rate: 65, ot_rate: 97.5 },
  { client: 'Fox Sports', event: 'Cardinals vs Rams', venue: 'State Farm Stadium', start: '2025-12-07', end: '2025-12-07', department: 'Camera', rate: 70, ot_rate: 105 },

  // Suns (NBA) — Footprint Center
  { client: 'ESPN', event: 'Suns vs Lakers', venue: 'Footprint Center', start: '2025-12-23', end: '2025-12-23', department: 'Camera', rate: 60, ot_rate: 90 },
  { client: 'TNT', event: 'Suns vs Mavericks', venue: 'Footprint Center', start: '2026-02-10', end: '2026-02-10', department: 'Camera', rate: 60, ot_rate: 90 },

  // ASU Football — Mountain America Stadium
  { client: 'ESPN', event: 'ASU vs TCU', venue: 'Mountain America Stadium', start: '2025-09-26', end: '2025-09-26', department: 'Utility', rate: 45, ot_rate: 67.5 },
  { client: 'Fox Sports', event: 'ASU vs Arizona (Territorial Cup)', venue: 'Mountain America Stadium', start: '2025-11-28', end: '2025-11-28', department: 'Camera', rate: 55, ot_rate: 82.5 },

  // ASU Basketball — Desert Financial Arena
  { client: 'ESPN+', event: 'ASU vs Gonzaga', venue: 'Desert Financial Arena', start: '2025-11-14', end: '2025-11-14', department: 'Camera', rate: 50, ot_rate: 75 },

  // Arizona Football — Arizona Stadium (not in venues list, add Tucson)
  { client: 'ESPN', event: 'Arizona vs BYU', venue: 'Casino Del Sol Stadium', start: '2025-10-11', end: '2025-10-11', department: 'Utility', rate: 45, ot_rate: 67.5 },

  // Arizona Basketball — McKale Center
  { client: 'ESPN', event: 'Arizona vs UCLA', venue: 'McKale Center at ALKEME Arena', start: '2025-11-14', end: '2025-11-14', department: 'Camera', rate: 55, ot_rate: 82.5 },
  { client: 'CBS Sports', event: 'Arizona vs Kansas', venue: 'McKale Center at ALKEME Arena', start: '2026-02-28', end: '2026-02-28', department: 'Camera', rate: 60, ot_rate: 90 },
];

// ─── Fake Contacts ────────────────────────────────────────────────────────
const CONTACTS = [
  { name: 'CBS Sports Production', type: 'vendor' as const, email: 'crewing@cbssports.example.com', phone: '212-555-0100' },
  { name: 'ESPN Events', type: 'vendor' as const, email: 'events@espn.example.com', phone: '860-555-0200' },
  { name: 'Fox Sports Regional', type: 'vendor' as const, email: 'regional@foxsports.example.com', phone: '310-555-0300' },
  { name: 'NBC Sports', type: 'vendor' as const, email: 'production@nbcsports.example.com', phone: '212-555-0400' },
  { name: 'Big Ten Network', type: 'vendor' as const, email: 'crew@btn.example.com', phone: '312-555-0500' },
  { name: 'NFL Network', type: 'vendor' as const, email: 'combine@nflnetwork.example.com', phone: '310-555-0600' },
  { name: 'Mike Torres', type: 'vendor' as const, email: 'mike.torres@example.com', phone: '317-555-1001' },
  { name: 'Sarah Chen', type: 'vendor' as const, email: 'sarah.chen@example.com', phone: '317-555-1002' },
  { name: 'Derek Williams', type: 'vendor' as const, email: 'dwilliams@example.com', phone: '480-555-2001' },
  { name: 'Lisa Patel', type: 'vendor' as const, email: 'lpatel@example.com', phone: '520-555-3001' },
];

// ─── Seed Function ────────────────────────────────────────────────────────
export async function seedContractor(db: SupabaseClient, userId: string): Promise<void> {
  // 0. Set contractor profile
  await db.from('profiles').update({
    contractor_role: 'worker',
    products: ['contractor'],
  }).eq('id', userId);

  // 1. Create contacts
  const contactInserts = CONTACTS.map((c) => ({
    user_id: userId,
    name: c.name,
    contact_type: c.type,
    email: c.email,
    phone: c.phone,
  }));
  const { data: contacts, error: cErr } = await db.from('user_contacts').insert(contactInserts).select('id, name');
  if (cErr) throw new Error(`Contacts: ${cErr.message}`);
  const contactMap: Record<string, string> = {};
  for (const c of contacts ?? []) contactMap[c.name] = c.id;

  // 2. Create locations for venues
  const locationInserts = VENUES.map((v) => ({
    contact_id: contactMap[CONTACTS[0].name], // attach to first contact as placeholder
    label: v.name,
    address: v.address,
    is_default: false,
    notes: `${v.city}, ${v.state}`,
    knowledge_base: VENUE_KB[v.name] ? JSON.stringify(VENUE_KB[v.name]) : null,
  }));
  const { data: locations, error: lErr } = await db.from('contact_locations').insert(locationInserts).select('id, label');
  if (lErr) throw new Error(`Locations: ${lErr.message}`);
  const locationMap: Record<string, string> = {};
  for (const l of locations ?? []) locationMap[l.label] = l.id;

  // 3. Create contractor jobs from events
  const today = new Date().toISOString().split('T')[0];
  const jobInserts = EVENTS.map((e, i) => {
    const isPast = e.end < today;
    const isActive = e.start <= today && e.end >= today;
    let status = 'assigned';
    if (isPast) status = i % 3 === 0 ? 'paid' : 'invoiced';
    else if (isActive) status = 'in_progress';
    else status = i % 2 === 0 ? 'confirmed' : 'assigned';

    return {
      user_id: userId,
      job_number: `J-${230000 + i}`,
      client_name: e.client,
      client_id: contactMap[e.client] ?? null,
      event_name: e.event,
      location_name: e.venue,
      location_id: locationMap[e.venue] ?? null,
      status,
      start_date: e.start,
      end_date: e.end,
      is_multi_day: e.start !== e.end,
      pay_rate: e.rate,
      ot_rate: e.ot_rate,
      dt_rate: e.ot_rate * 1.5,
      rate_type: 'hourly',
      department: e.department,
      union_local: e.union ?? null,
      notes: `${e.event} at ${e.venue}`,
    };
  });

  const { data: jobs, error: jErr } = await db.from('contractor_jobs').insert(jobInserts).select('id, job_number, status, start_date, end_date');
  if (jErr) throw new Error(`Jobs: ${jErr.message}`);

  // 4. Create time entries for past/completed jobs
  const completedJobs = (jobs ?? []).filter((j) => ['invoiced', 'paid', 'completed'].includes(j.status));
  const timeInserts = [];
  for (const job of completedJobs) {
    const start = new Date(job.start_date + 'T00:00:00');
    const end = new Date(job.end_date + 'T00:00:00');
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);

    for (let d = 0; d < Math.min(days, 5); d++) {
      const workDate = new Date(start);
      workDate.setDate(workDate.getDate() + d);
      const dateStr = workDate.toISOString().split('T')[0];
      const stHours = 8;
      const otHours = d % 2 === 0 ? 2 : 0;

      timeInserts.push({
        user_id: userId,
        job_id: job.id,
        work_date: dateStr,
        total_hours: stHours + otHours,
        st_hours: stHours,
        ot_hours: otHours,
        dt_hours: 0,
        break_minutes: 30,
      });
    }
  }

  if (timeInserts.length > 0) {
    const { error: tErr } = await db.from('job_time_entries').insert(timeInserts);
    if (tErr) throw new Error(`Time entries: ${tErr.message}`);
  }

  // 5. Create rate cards
  const rateCards = [
    { user_id: userId, name: 'CBS Camera Op', union_local: 'IATSE 317', department: 'Camera', rate_type: 'hourly', st_rate: 65, ot_rate: 97.5, dt_rate: 130, use_count: 12 },
    { user_id: userId, name: 'ESPN Camera Op', union_local: 'IATSE 317', department: 'Camera', rate_type: 'hourly', st_rate: 70, ot_rate: 105, dt_rate: 140, use_count: 8 },
    { user_id: userId, name: 'BTN Utility', department: 'Utility', rate_type: 'hourly', st_rate: 45, ot_rate: 67.5, dt_rate: 90, use_count: 5 },
  ];
  const { error: rcErr } = await db.from('contractor_rate_cards').insert(rateCards);
  if (rcErr) throw new Error(`Rate cards: ${rcErr.message}`);

  // 6. Create city guides
  const cityGuides = [
    { user_id: userId, city_name: 'Indianapolis', state: 'IN', region: 'Midwest', is_shared: true, notes: 'Regularly work Colts, Pacers, and B1G events here.' },
    { user_id: userId, city_name: 'Bloomington', state: 'IN', region: 'Midwest', is_shared: false, notes: 'IU campus — smaller town, fewer options.' },
    { user_id: userId, city_name: 'Tempe', state: 'AZ', region: 'Southwest', is_shared: true, notes: 'ASU area. Great weather, good food scene.' },
    { user_id: userId, city_name: 'Tucson', state: 'AZ', region: 'Southwest', is_shared: false, notes: 'UofA territory. Hot but affordable.' },
  ];
  const { data: guides, error: gErr } = await db.from('city_guides').insert(cityGuides).select('id, city_name');
  if (gErr) throw new Error(`City guides: ${gErr.message}`);
  const guideMap: Record<string, string> = {};
  for (const g of guides ?? []) guideMap[g.city_name] = g.id;

  // City guide entries
  const entries = [
    // Indianapolis
    { city_guide_id: guideMap['Indianapolis'], category: 'restaurant', name: 'St. Elmo Steak House', address: '127 S Illinois St, Indianapolis', rating: 5, price_range: 4, notes: 'Famous shrimp cocktail. Make reservations.' },
    { city_guide_id: guideMap['Indianapolis'], category: 'restaurant', name: 'Milktooth', address: '534 Virginia Ave, Indianapolis', rating: 5, price_range: 3, notes: 'Best brunch in the city. Get there early.' },
    { city_guide_id: guideMap['Indianapolis'], category: 'hotel', name: 'JW Marriott Indianapolis', address: '10 S West St, Indianapolis', rating: 4, price_range: 3, notes: 'Connected to convention center. Walking distance to Lucas Oil.' },
    { city_guide_id: guideMap['Indianapolis'], category: 'coffee', name: 'Coat Check Coffee', address: '401 E Michigan St, Indianapolis', rating: 5, price_range: 2, notes: 'Best espresso downtown.' },
    { city_guide_id: guideMap['Indianapolis'], category: 'gym', name: 'The Fitness Center at IUPUI', address: '901 W New York St, Indianapolis', rating: 3, price_range: 1, notes: 'Day pass available. Basic but clean.' },
    // Tempe
    { city_guide_id: guideMap['Tempe'], category: 'restaurant', name: 'Four Peaks Brewing', address: '1340 E 8th St, Tempe', rating: 4, price_range: 2, notes: 'Great burgers and local beer.' },
    { city_guide_id: guideMap['Tempe'], category: 'restaurant', name: 'Postino WineCafe', address: '615 N Scottsdale Rd, Tempe', rating: 4, price_range: 2, notes: '$6 wine and bruschetta before 5pm.' },
    { city_guide_id: guideMap['Tempe'], category: 'hotel', name: 'Graduate Tempe', address: '225 E Apache Blvd, Tempe', rating: 4, price_range: 2, notes: 'Walking distance to stadium. Rooftop pool.' },
    { city_guide_id: guideMap['Tempe'], category: 'coffee', name: 'Cartel Coffee Lab', address: '225 W University Dr, Tempe', rating: 5, price_range: 2, notes: 'Excellent pour-over and cold brew.' },
    // Tucson
    { city_guide_id: guideMap['Tucson'], category: 'restaurant', name: 'El Charro Cafe', address: '311 N Court Ave, Tucson', rating: 4, price_range: 2, notes: 'Oldest Mexican restaurant in the US. Try the carne seca.' },
    { city_guide_id: guideMap['Tucson'], category: 'hotel', name: 'Arizona Inn', address: '2200 E Elm St, Tucson', rating: 5, price_range: 3, notes: 'Beautiful old hotel. Great pool area.' },
    // Bloomington
    { city_guide_id: guideMap['Bloomington'], category: 'restaurant', name: 'Nick\'s English Hut', address: '423 E Kirkwood Ave, Bloomington', rating: 4, price_range: 1, notes: 'Classic IU hangout. Sink the Biz game.' },
    { city_guide_id: guideMap['Bloomington'], category: 'restaurant', name: 'FARMbloomington', address: '108 E Kirkwood Ave, Bloomington', rating: 5, price_range: 3, notes: 'Farm-to-table. Excellent cocktails.' },
  ];

  if (Object.keys(guideMap).length > 0) {
    const validEntries = entries.filter((e) => e.city_guide_id);
    if (validEntries.length > 0) {
      const { error: eErr } = await db.from('city_guide_entries').insert(validEntries);
      if (eErr) throw new Error(`City entries: ${eErr.message}`);
    }
  }

  // 7. Union memberships
  const membershipInserts = [
    {
      user_id: userId,
      union_name: 'IATSE',
      local_number: '317',
      member_id: 'IA317-04892',
      status: 'active',
      join_date: '2018-06-15',
      dues_amount: 125.00,
      dues_frequency: 'quarterly',
      next_dues_date: '2026-04-01',
      initiation_fee: 500.00,
      initiation_paid: true,
      notes: 'Primary local — Indiana. Camera department.',
    },
    {
      user_id: userId,
      union_name: 'IBEW',
      local_number: '1220',
      member_id: 'IBEW1220-7831',
      status: 'active',
      join_date: '2021-03-01',
      dues_amount: 95.00,
      dues_frequency: 'quarterly',
      next_dues_date: '2026-03-15',
      initiation_fee: 350.00,
      initiation_paid: true,
      notes: 'Secondary local. Audio/electrical work.',
    },
  ];
  const { data: memberships, error: mErr } = await db.from('union_memberships').insert(membershipInserts).select('id, union_name, local_number');
  if (mErr) throw new Error(`Memberships: ${mErr.message}`);

  // 8. Dues payments for memberships
  const membershipMap: Record<string, string> = {};
  for (const m of memberships ?? []) membershipMap[`${m.union_name}-${m.local_number}`] = m.id;

  const duesInserts = [
    // IATSE 317 — last 3 quarters paid
    { membership_id: membershipMap['IATSE-317'], user_id: userId, amount: 125.00, payment_date: '2025-07-01', period_start: '2025-07-01', period_end: '2025-09-30', payment_method: 'check', confirmation_number: 'IA-2025-Q3' },
    { membership_id: membershipMap['IATSE-317'], user_id: userId, amount: 125.00, payment_date: '2025-10-01', period_start: '2025-10-01', period_end: '2025-12-31', payment_method: 'check', confirmation_number: 'IA-2025-Q4' },
    { membership_id: membershipMap['IATSE-317'], user_id: userId, amount: 125.00, payment_date: '2026-01-05', period_start: '2026-01-01', period_end: '2026-03-31', payment_method: 'online', confirmation_number: 'IA-2026-Q1' },
    // IBEW 1220 — last 2 quarters paid
    { membership_id: membershipMap['IBEW-1220'], user_id: userId, amount: 95.00, payment_date: '2025-09-15', period_start: '2025-10-01', period_end: '2025-12-31', payment_method: 'online', confirmation_number: 'IB-2025-Q4' },
    { membership_id: membershipMap['IBEW-1220'], user_id: userId, amount: 95.00, payment_date: '2025-12-28', period_start: '2026-01-01', period_end: '2026-03-31', payment_method: 'online', confirmation_number: 'IB-2026-Q1' },
  ];
  const validDues = duesInserts.filter((d) => d.membership_id);
  if (validDues.length > 0) {
    const { error: dErr } = await db.from('union_dues_payments').insert(validDues);
    if (dErr) throw new Error(`Dues payments: ${dErr.message}`);
  }

  // 9. Create invoices for paid/invoiced jobs with time entries
  const invoicedJobs = (jobs ?? []).filter((j) => ['invoiced', 'paid'].includes(j.status));
  for (const job of invoicedJobs.slice(0, 6)) {
    const event = EVENTS.find((e) => `J-${230000 + EVENTS.indexOf(e)}` === job.job_number);
    if (!event) continue;

    const stRate = event.rate;
    const otRate = event.ot_rate;
    const jobStart = new Date(job.start_date + 'T00:00:00');
    const jobEnd = new Date(job.end_date + 'T00:00:00');
    const numDays = Math.max(1, Math.ceil((jobEnd.getTime() - jobStart.getTime()) / 86400000) + 1);
    const workDays = Math.min(numDays, 5);
    const totalSt = workDays * 8;
    const totalOt = Math.ceil(workDays / 2) * 2; // every other day has 2h OT
    const totalAmount = (totalSt * stRate) + (totalOt * otRate);

    const dueDate = new Date(new Date(job.end_date + 'T00:00:00').getTime() + 30 * 86400000).toISOString().split('T')[0];
    const { data: inv, error: invErr } = await db.from('invoices').insert({
      user_id: userId,
      direction: 'receivable',
      invoice_number: `INV-${job.job_number}`,
      contact_name: event.client,
      contact_id: contactMap[event.client] ?? null,
      status: job.status === 'paid' ? 'paid' : 'sent',
      invoice_date: job.end_date,
      due_date: dueDate,
      subtotal: totalAmount,
      total: totalAmount,
      amount_paid: job.status === 'paid' ? totalAmount : 0,
      paid_date: job.status === 'paid' ? dueDate : null,
      job_id: job.id,
      notes: `${event.event} — ${workDays} work days`,
    }).select('id').maybeSingle();

    if (invErr) throw new Error(`Invoice: ${invErr.message}`);

    // Invoice line items
    if (inv) {
      const lineItems = [
        { invoice_id: inv.id, description: `Standard Time (${totalSt}h × $${stRate})`, quantity: totalSt, unit_price: stRate, amount: totalSt * stRate, sort_order: 0 },
      ];
      if (totalOt > 0) {
        lineItems.push({ invoice_id: inv.id, description: `Overtime (${totalOt}h × $${otRate})`, quantity: totalOt, unit_price: otRate, amount: totalOt * otRate, sort_order: 1 });
      }
      const { error: liErr } = await db.from('invoice_items').insert(lineItems);
      if (liErr) throw new Error(`Invoice line items: ${liErr.message}`);
    }
  }

  // 10. Financial Accounts + Transactions
  const { data: accts, error: acctErr } = await db
    .from('financial_accounts')
    .insert([
      { user_id: userId, name: 'Business Checking', account_type: 'checking', opening_balance: 12500.00, is_active: true },
      { user_id: userId, name: 'Business Credit Card', account_type: 'credit_card', opening_balance: 0, credit_limit: 15000, is_active: true },
    ])
    .select('id, name');
  if (acctErr) throw new Error(`Contractor accounts: ${acctErr.message}`);

  const bizCheckingId = accts?.find(a => a.name === 'Business Checking')?.id;
  const bizCreditId = accts?.find(a => a.name === 'Business Credit Card')?.id;

  const { data: cats, error: catErr } = await db
    .from('budget_categories')
    .insert([
      { user_id: userId, name: 'Equipment', color: '#f59e0b', monthly_budget: 500, sort_order: 1 },
      { user_id: userId, name: 'Travel', color: '#3b82f6', monthly_budget: 400, sort_order: 2 },
      { user_id: userId, name: 'Meals', color: '#ef4444', monthly_budget: 300, sort_order: 3 },
      { user_id: userId, name: 'Union Dues', color: '#6366f1', monthly_budget: 150, sort_order: 4 },
    ])
    .select('id, name');
  if (catErr) throw new Error(`Contractor budget categories: ${catErr.message}`);

  const catId = (name: string) => cats?.find(c => c.name === name)?.id ?? null;

  const { error: txErr } = await db.from('financial_transactions').insert([
    { user_id: userId, amount: 349.99, type: 'expense', description: 'Pelican 1650 case for camera', vendor: 'B&H Photo', transaction_date: daysAgo(5), source: 'manual', category_id: catId('Equipment'), account_id: bizCreditId },
    { user_id: userId, amount: 89.00, type: 'expense', description: 'BNC cables and adapters', vendor: 'B&H Photo', transaction_date: daysAgo(8), source: 'manual', category_id: catId('Equipment'), account_id: bizCreditId },
    { user_id: userId, amount: 67.20, type: 'expense', description: 'Fuel — drive to Lucas Oil', vendor: 'Costco Gas', transaction_date: daysAgo(10), source: 'manual', category_id: catId('Travel'), account_id: bizCreditId },
    { user_id: userId, amount: 42.50, type: 'expense', description: 'Dinner after Colts game', vendor: 'St. Elmo Steak House', transaction_date: daysAgo(10), source: 'manual', category_id: catId('Meals'), account_id: bizCreditId },
    { user_id: userId, amount: 125.00, type: 'expense', description: 'IATSE 317 quarterly dues', vendor: 'IATSE Local 317', transaction_date: daysAgo(15), source: 'manual', category_id: catId('Union Dues'), account_id: bizCheckingId },
    { user_id: userId, amount: 95.00, type: 'expense', description: 'IBEW 1220 quarterly dues', vendor: 'IBEW Local 1220', transaction_date: daysAgo(15), source: 'manual', category_id: catId('Union Dues'), account_id: bizCheckingId },
    { user_id: userId, amount: 38.75, type: 'expense', description: 'Lunch at stadium — B1G Tourney', vendor: 'Gainbridge Fieldhouse Catering', transaction_date: daysAgo(6), source: 'manual', category_id: catId('Meals'), account_id: bizCreditId },
    { user_id: userId, amount: 54.30, type: 'expense', description: 'Fuel — drive to Bloomington', vendor: 'Shell', transaction_date: daysAgo(20), source: 'manual', category_id: catId('Travel'), account_id: bizCreditId },
  ]);
  if (txErr) throw new Error(`Contractor transactions: ${txErr.message}`);

  // 11. Vehicle + Fuel Logs + Trips
  const { data: veh, error: vehErr } = await db
    .from('vehicles')
    .insert([{ user_id: userId, nickname: 'Work Truck', type: 'truck', make: 'Ford', model: 'F-150', year: 2021, ownership_type: 'owned', active: true }])
    .select('id');
  if (vehErr) throw new Error(`Contractor vehicle: ${vehErr.message}`);
  const vehicleId = veh?.[0]?.id;

  if (vehicleId) {
    const { error: fuelErr } = await db.from('fuel_logs').insert([
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(3), odometer_miles: 48720, miles_since_last_fill: 280, gallons: 16.2, total_cost: 55.89, cost_per_gallon: 3.45, mpg_display: 17.3, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(10), odometer_miles: 48440, miles_since_last_fill: 265, gallons: 15.8, total_cost: 54.51, cost_per_gallon: 3.45, mpg_display: 16.8, station: 'Shell', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(20), odometer_miles: 48175, miles_since_last_fill: 290, gallons: 16.5, total_cost: 57.09, cost_per_gallon: 3.46, mpg_display: 17.6, station: 'Chevron', fuel_grade: 'regular', source: 'manual' },
    ]);
    if (fuelErr) throw new Error(`Contractor fuel logs: ${fuelErr.message}`);
  }

  const { error: tripErr } = await db.from('trips').insert([
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(3), mode: 'car', origin: 'Home', destination: 'Lucas Oil Stadium', distance_miles: 48.5, duration_min: 55, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(6), mode: 'car', origin: 'Home', destination: 'Gainbridge Fieldhouse', distance_miles: 45.2, duration_min: 50, trip_category: 'travel', tax_category: 'business', source: 'manual' },
  ]);
  if (tripErr) throw new Error(`Contractor trips: ${tripErr.message}`);

  // 12. Equipment
  const { data: eqCats, error: eqCatErr } = await db
    .from('equipment_categories')
    .insert([
      { user_id: userId, name: 'Broadcast', sort_order: 1 },
      { user_id: userId, name: 'Electronics', sort_order: 2 },
    ])
    .select('id, name');
  if (eqCatErr) throw new Error(`Contractor equipment categories: ${eqCatErr.message}`);
  const eqCatIdFn = (name: string) => eqCats?.find(c => c.name === name)?.id ?? null;

  const { error: eqErr } = await db.from('equipment').insert([
    { user_id: userId, name: 'Sony PXW-FX9', category_id: eqCatIdFn('Broadcast'), brand: 'Sony', purchase_date: daysAgo(365), purchase_price: 5500, current_value: 4800, condition: 'excellent' },
    { user_id: userId, name: 'Sachtler Video 18 Tripod', category_id: eqCatIdFn('Broadcast'), brand: 'Sachtler', purchase_date: daysAgo(300), purchase_price: 1800, current_value: 1500, condition: 'good' },
    { user_id: userId, name: 'Teradek Bolt 4K', category_id: eqCatIdFn('Broadcast'), brand: 'Teradek', purchase_date: daysAgo(180), purchase_price: 2200, current_value: 2000, condition: 'excellent' },
    { user_id: userId, name: 'iPad Pro 12.9"', category_id: eqCatIdFn('Electronics'), brand: 'Apple', purchase_date: daysAgo(120), purchase_price: 1099, current_value: 950, condition: 'good' },
  ]);
  if (eqErr) throw new Error(`Contractor equipment: ${eqErr.message}`);

  // 13. Exercise Categories + Exercises
  const { data: exCats, error: exCatErr } = await db
    .from('exercise_categories')
    .insert([
      { user_id: userId, name: 'Mobility', sort_order: 1 },
      { user_id: userId, name: 'Strength', sort_order: 2 },
      { user_id: userId, name: 'Cardio', sort_order: 3 },
    ])
    .select('id, name');
  if (exCatErr) throw new Error(`Contractor exercise categories: ${exCatErr.message}`);
  const exCatId = (name: string) => exCats?.find(c => c.name === name)?.id ?? null;

  const { data: exerciseData, error: exErr } = await db
    .from('exercises')
    .insert([
      { user_id: userId, name: 'Shoulder Mobility Circles', category_id: exCatId('Mobility'), default_sets: 2, default_reps: 10, primary_muscles: ['shoulders', 'rotator cuff'] },
      { user_id: userId, name: 'Goblet Squats', category_id: exCatId('Strength'), default_sets: 3, default_reps: 12, primary_muscles: ['quads', 'glutes', 'core'], instructions: 'Hold kettlebell at chest for camera-stability training' },
      { user_id: userId, name: 'Farmer\'s Walks', category_id: exCatId('Strength'), default_sets: 3, default_duration_sec: 60, primary_muscles: ['forearms', 'traps', 'core'], instructions: 'Grip strength for handheld camera work' },
      { user_id: userId, name: 'Treadmill Intervals', category_id: exCatId('Cardio'), default_duration_sec: 1200, primary_muscles: ['legs', 'cardio'] },
    ])
    .select('id, name');
  if (exErr) throw new Error(`Contractor exercises: ${exErr.message}`);

  // 14. Workout Log
  const { data: logData, error: logErr } = await db
    .from('workout_logs')
    .insert([{ user_id: userId, name: 'Pre-Show Warm-up', date: daysAgo(3), duration_min: 35, overall_feeling: 4, purpose: ['mobility', 'strength'] }])
    .select('id');
  if (logErr) throw new Error(`Contractor workout log: ${logErr.message}`);
  const logId = logData?.[0]?.id;

  if (logId && exerciseData) {
    const exId = (name: string) => exerciseData.find(e => e.name === name)?.id ?? null;
    const { error: logExErr } = await db.from('workout_log_exercises').insert([
      { log_id: logId, name: 'Shoulder Mobility Circles', exercise_id: exId('Shoulder Mobility Circles'), sets_completed: 2, reps_completed: 10, sort_order: 1, phase: 'warmup', rpe: 4 },
      { log_id: logId, name: 'Goblet Squats', exercise_id: exId('Goblet Squats'), sets_completed: 3, reps_completed: 12, weight_lbs: 45, sort_order: 2, phase: 'working', rpe: 7 },
      { log_id: logId, name: 'Farmer\'s Walks', exercise_id: exId('Farmer\'s Walks'), sets_completed: 3, duration_sec: 60, weight_lbs: 70, sort_order: 3, phase: 'working', rpe: 8 },
    ]);
    if (logExErr) throw new Error(`Contractor workout log exercises: ${logExErr.message}`);
  }

  // 15. Health Metrics (7 days)
  const healthRows = Array.from({ length: 7 }, (_, i) => ({
    user_id: userId,
    logged_date: daysAgo(i),
    resting_hr: 62 + Math.floor(Math.random() * 8),
    steps: 5000 + Math.floor(Math.random() * 7000),
    sleep_hours: +(6 + Math.random() * 2.5).toFixed(1),
    source: 'manual' as const,
  }));
  const { error: hmErr } = await db.from('user_health_metrics').insert(healthRows);
  if (hmErr) throw new Error(`Contractor health metrics: ${hmErr.message}`);

  // 16. Life Categories
  const { error: lcErr } = await db.from('life_categories').insert([
    { user_id: userId, name: 'Career', icon: 'briefcase', color: '#f59e0b', sort_order: 1 },
    { user_id: userId, name: 'Health', icon: 'heart', color: '#ef4444', sort_order: 2 },
    { user_id: userId, name: 'Finance', icon: 'dollar-sign', color: '#10b981', sort_order: 3 },
    { user_id: userId, name: 'Travel', icon: 'map-pin', color: '#3b82f6', sort_order: 4 },
  ]);
  if (lcErr) throw new Error(`Contractor life categories: ${lcErr.message}`);

  // 17. Focus Sessions
  const { error: fsErr } = await db.from('focus_sessions').insert([
    { user_id: userId, start_time: new Date(Date.now() - 86400000 - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 86400000 - 60 * 60000).toISOString(), duration: 30, notes: 'Reviewing call sheets for B1G Tournament', session_type: 'work' },
    { user_id: userId, start_time: new Date(Date.now() - 172800000 - 60 * 60000).toISOString(), end_time: new Date(Date.now() - 172800000 - 35 * 60000).toISOString(), duration: 25, notes: 'Logging time entries for completed Colts games', session_type: 'work' },
  ]);
  if (fsErr) throw new Error(`Contractor focus sessions: ${fsErr.message}`);

  // 18. Blog Post
  const { error: blogErr } = await db.from('blog_posts').insert([
    {
      user_id: userId, title: 'A Day in the Life of a Freelance Camera Operator',
      slug: 'day-in-the-life-freelance-camera-operator',
      excerpt: 'From call sheets to camera platforms — what a typical game day looks like for a freelance broadcast camera op.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'My alarm goes off at 4:30 AM on game day. By 5:15 I\'m loading the truck with my FX9, Sachtler tripod, and a Pelican case full of cables. The call time is usually 6 hours before kickoff for NFL games, 4 hours for NBA. Once I arrive at the venue, I check in at security, grab my credential, and head to my assigned camera position. The next few hours are a blur of cable runs, lens checks, white balance, and rehearsals with the director. When the red light goes on, all that prep pays off. After wrap, I break down my gear, drive home, log my hours in CentenarianOS, and start prepping for the next show.' }] }] },
      visibility: 'public', tags: ['freelance', 'camera', 'broadcast', 'behind-the-scenes'],
      published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ]);
  if (blogErr) throw new Error(`Contractor blog post: ${blogErr.message}`);
}
