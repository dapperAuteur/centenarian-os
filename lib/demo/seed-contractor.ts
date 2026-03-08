// lib/demo/seed-contractor.ts
// Seeds a realistic contractor account with real venues and sports schedules.

import { SupabaseClient } from '@supabase/supabase-js';

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
}
