// app/api/workouts/nomad/seed/route.ts
// POST: seed Nomad Longevity OS exercises and workout templates for the authenticated user.
// Idempotent — skips rows that already exist by name.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// Nomad Glossary — exercise name → instructions
// ---------------------------------------------------------------------------
const GLOSSARY: Record<string, string> = {
  'Half-Kneeling Hip Flexor Stretch': 'Kneel on one knee with the front foot flat on the floor. Draw your belly button in (drawing-in maneuver) and squeeze the glute of your kneeling leg to tuck your pelvis under. Lean forward slightly until you feel a stretch in the front of your thigh. For an active stretch, hold for 2 seconds and repeat 10 times. For a static stretch, hold for 60 seconds.',
  'Glute Bridges': 'Lie on your back with knees bent and feet flat on the floor. Draw your belly button in. Squeeze your glutes and push through your heels to lift your hips until your knees, hips, and shoulders form a straight line. Hold for 2 seconds at the top, then lower slowly.',
  'Cat-Cow Flow': 'Start on your hands and knees. Draw your belly button in. Arch your back upward toward the ceiling (Cat), tucking your chin. Then, slowly let your belly drop toward the floor while lifting your chest and tailbone (Cow).',
  'Bird-Dogs': 'Start on your hands and knees. Draw your belly button in and brace your core. Keep your spine perfectly neutral (do not let your lower back arch) as you simultaneously extend one arm forward and the opposite leg backward. Hold for 2 seconds, then return to the start.',
  'Standing Band Pull-Aparts': 'Stand tall holding the band out in front of your chest. Draw your belly button in and keep your shoulders down. Initiate the movement by squeezing your shoulder blades together to pull the band apart until it touches your chest. Hold for 2 seconds, return slowly.',
  'Wall Pectoral Stretch': 'Extend your arm with your palm facing forward, then bend the elbow to a 90-degree angle. Place your forearm/elbow against a doorframe or wall. Drop your shoulders away from your ears, draw your belly button in, and brace your core. Lightly lean your body forward. For an active stretch, hold 2 seconds and repeat 12-15 times. For a static stretch, hold for 60 seconds.',
  'Latissimus Dorsi Doorframe Stretch': 'Stand facing a doorframe. Grab the frame with one hand at about shoulder height. Keeping your arm straight, push your hips back and away from the doorframe, letting your chest drop until you feel a deep stretch down the side of your back. Hold statically for 60 seconds.',
  'Twisting Reverse Lunge': 'Stand tall. Step one foot backward and lower your hips until both knees are bent at a 90-degree angle. Ensure your front knee tracks directly over your second and third toes. Pause for 2 seconds at the bottom, simultaneously rotating your torso toward the front leg. Push through the front heel to return to the start. (Tempo: 4/2/1/1)',
  'Wall Push-Ups': 'Stand facing a wall, hands placed slightly wider than shoulder-width. Perform the drawing-in maneuver (pull belly button to spine), squeeze your glutes, and tuck your chin so your body forms a perfectly straight line from head to heels. Take 4 seconds to lower your chest toward the wall. Hold for 2 seconds at the bottom without letting your hips sag or shoulders elevate, then press back up in 1 second. (Tempo: 4/2/1/1)',
  'Bent-Over Band Row': 'Stand on the center of the resistance band. Hinge at your hips, pushing them backward. Maintain a neutral spine and a proud chest—do not let your upper back round. Draw your belly button in. Initiate the pull by squeezing your shoulder blades together before bending your elbows. Pull the handles to your sides, hold peak tension for 2 seconds, and take 4 seconds to slowly lower. (Tempo: 4/2/1/1)',
  'Band Squat to Press (Thruster)': 'Stand on the resistance band with feet shoulder-width apart, holding the handles at shoulder height. Keeping your chest up, squat down as if sitting in a chair. Pause at the bottom, then stand up explosively, using the momentum to press the handles straight overhead. (Tempo: 4/2/1/1)',
  'Jump Rope': 'Keep your elbows tucked in close to your ribs and use your wrists to turn the rope. Take small jumps, ensuring you land softly on the balls of your feet to absorb the impact and protect your Achilles tendons.',
  'Manual Calf/Foot Release': 'Use your thumbs to apply firm pressure to the arches of your feet and tight spots in your calves, mimicking a foam roller.',
  'Plank': 'Draw your belly button in, squeeze your glutes, and maintain a perfectly straight line from head to heels.',
  'Active Walking Lunge': 'Step forward and lower your hips until both knees are bent at a 90-degree angle. Push off the front foot to bring your back foot forward into the next step.',
  'Box Breathing (In Bed)': 'Lie flat. Inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds. Focus on deep diaphragmatic expansion.',
  "Child's Pose": 'Kneel, sit back on your heels, and reach your arms forward on the floor. Take deep diaphragmatic breaths into your lower back.',
  'Legs-Up-The-Wall Pose': 'Lie on your back, resting your legs vertically against the wall to promote venous return and reduce lower body swelling from flights.',
  'Mental Wind-Down': 'Engage in guided journaling away from blue light (screens) to reduce cognitive arousal before sleep.',
  'Foam Rolling (Gym)': 'Since you are in a full gym, utilize a foam roller. Target the calves, quadriceps, and latissimus dorsi. Roll slowly until you find a tender spot, then hold pressure on that exact spot for 30 to 60 seconds until the tension releases. This inhibits overactive tissue.',
  'Dumbbell Goblet Squat': 'Hold a dumbbell vertically against your chest. Perform the drawing-in maneuver (pull belly button toward spine) and brace your core tightly. Keeping your chest proud and spine neutral, push your hips back and squat down until your thighs are parallel to the floor. Ensure your knees track over your second and third toes. Hold the bottom position for 2 seconds, then push through your heels to stand. (Tempo: 4/2/1/1)',
  'Standing Cable Row': 'Stand facing a cable machine with handles attached at chest height. Perform the drawing-in maneuver and brace your abdominals. Initiate the movement by retracting (squeezing) your shoulder blades together, then pull the handles toward your ribs. Keep your shoulders dropped away from your ears. Hold the peak contraction for 2 seconds before slowly returning to the start over 4 seconds. (Tempo: 4/2/1/1)',
  'Stability Ball Dumbbell Chest Press': 'Sit on a stability ball with dumbbells, then walk your feet forward until your head and upper back are supported by the ball. Squeeze your glutes to lift your hips into a bridge position, forming a straight line from knees to shoulders. Draw your belly button in and brace your core to prevent your hips from sagging. Lower the dumbbells slowly for 4 seconds, pause for 2 seconds at the bottom stretch to maximize stabilization, then press back up. (Tempo: 4/2/1/1)',
  'Single-Leg Scaption': 'Stand on one leg with a light dumbbell in each hand. Draw your belly button in and brace your core to maintain a neutral, stable pelvis. Raise both arms slightly in front of your body (at a 45-degree angle in the scapular plane) until they reach shoulder height. Keep your shoulders pressed down. Hold for 2 seconds at the top, then lower over 4 seconds. (Tempo: 4/2/1/1)',
  'Step-Up to Balance': 'Stand facing a plyo box or bench with dumbbells in hand. Draw in and brace your core. Step one foot onto the box, pushing through the heel to stand up, simultaneously driving your opposite knee up to hip height. Hold this single-leg balance position for 2 seconds, ensuring your standing leg is fully straight and glute is squeezed. Step back down slowly. (Tempo: 4/2/1/1)',
  'Standing Cable Chest Press': 'Stand facing away from a cable machine holding a handle in each hand, using a staggered (split) stance for stability. Draw your belly button in and brace your midsection to prevent your lower back from arching. Press the cables straight forward. Hold for 1 second, then slowly let your arms return over 4 seconds, pausing for 2 seconds at the stretch. (Tempo: 4/2/1/1)',
  'Single-Leg Dumbbell Curl to Press': 'Stand on one leg holding dumbbells. Perform the drawing-in maneuver and brace your core to stabilize your spine. Curl the dumbbells up to your shoulders, then immediately press them overhead. Lower them back to your shoulders, then down to your sides. Maintain perfect balance and a neutral spine throughout. (Tempo: 4/2/1/1)',
  'Multiplanar Lunge to Balance': 'Hold dumbbells at your sides. Step forward into a lunge (sagittal plane), dropping your hips until both knees are at 90 degrees. Push off the front foot to return to the start, but instead of putting the foot down, drive the knee up and balance on one leg for 2 seconds. Draw your belly button in and brace your core to maintain perfect alignment during the balance phase. (Tempo: 4/2/1/1)',
};

// ---------------------------------------------------------------------------
// Category assignment for each exercise
// ---------------------------------------------------------------------------
const EXERCISE_CATEGORIES: Record<string, string> = {
  'Half-Kneeling Hip Flexor Stretch': 'Flexibility',
  'Glute Bridges': 'Core',
  'Cat-Cow Flow': 'Flexibility',
  'Bird-Dogs': 'Core',
  'Standing Band Pull-Aparts': 'Pull',
  'Wall Pectoral Stretch': 'Flexibility',
  'Latissimus Dorsi Doorframe Stretch': 'Flexibility',
  'Twisting Reverse Lunge': 'Legs',
  'Wall Push-Ups': 'Push',
  'Bent-Over Band Row': 'Pull',
  'Band Squat to Press (Thruster)': 'Legs',
  'Jump Rope': 'Cardio',
  'Manual Calf/Foot Release': 'Flexibility',
  'Plank': 'Core',
  'Active Walking Lunge': 'Legs',
  'Box Breathing (In Bed)': 'Other',
  "Child's Pose": 'Flexibility',
  'Legs-Up-The-Wall Pose': 'Flexibility',
  'Mental Wind-Down': 'Other',
  'Foam Rolling (Gym)': 'Flexibility',
  'Dumbbell Goblet Squat': 'Legs',
  'Standing Cable Row': 'Pull',
  'Stability Ball Dumbbell Chest Press': 'Push',
  'Single-Leg Scaption': 'Balance',
  'Step-Up to Balance': 'Balance',
  'Standing Cable Chest Press': 'Push',
  'Single-Leg Dumbbell Curl to Press': 'Balance',
  'Multiplanar Lunge to Balance': 'Balance',
};

// ---------------------------------------------------------------------------
// Nomad workout templates to seed
// ---------------------------------------------------------------------------
interface SeedExercise { name: string; reps: string; phase?: 'warmup' | 'working' | 'cooldown'; is_circuit?: boolean; }
interface SeedTemplate {
  name: string;
  category: string;
  estimated_duration_min: number;
  purpose: string[];
  exercises: SeedExercise[];
}

const TEMPLATES: SeedTemplate[] = [
  // AM Priming
  {
    name: 'Nomad AM 5min',
    category: 'Flexibility',
    estimated_duration_min: 5,
    purpose: ['mobility'],
    exercises: [
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: '10 reps per side (hold 2s per rep)', phase: 'working' },
      { name: 'Glute Bridges', reps: '15 controlled reps', phase: 'working' },
    ],
  },
  {
    name: 'Nomad AM 15min',
    category: 'Flexibility',
    estimated_duration_min: 15,
    purpose: ['mobility'],
    exercises: [
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: '10 reps per side', phase: 'working' },
      { name: 'Glute Bridges', reps: '15 controlled reps', phase: 'working' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'working' },
      { name: 'Bird-Dogs', reps: '10 reps per side', phase: 'working' },
      { name: 'Standing Band Pull-Aparts', reps: '2 sets of 15 reps', phase: 'working' },
    ],
  },
  {
    name: 'Nomad AM 30min',
    category: 'Flexibility',
    estimated_duration_min: 30,
    purpose: ['mobility'],
    exercises: [
      { name: 'Manual Calf/Foot Release', reps: '5 minutes', phase: 'warmup' },
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: '10 reps per side', phase: 'working' },
      { name: 'Glute Bridges', reps: '15 controlled reps', phase: 'working' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'working' },
      { name: 'Bird-Dogs', reps: '10 reps per side', phase: 'working' },
      { name: 'Standing Band Pull-Aparts', reps: '2 sets of 15 reps', phase: 'working' },
      { name: 'Plank', reps: '3 sets of 30-60 second holds', phase: 'working' },
      { name: 'Active Walking Lunge', reps: '2 sets of 10 reps per leg', phase: 'working' },
    ],
  },
  // PM Recovery
  {
    name: 'Nomad PM 5min',
    category: 'Flexibility',
    estimated_duration_min: 5,
    purpose: ['recovery'],
    exercises: [
      { name: 'Wall Pectoral Stretch', reps: '60 seconds per side (Static)', phase: 'working' },
      { name: 'Box Breathing (In Bed)', reps: '2 minutes', phase: 'cooldown' },
    ],
  },
  {
    name: 'Nomad PM 15min',
    category: 'Flexibility',
    estimated_duration_min: 15,
    purpose: ['recovery'],
    exercises: [
      { name: 'Wall Pectoral Stretch', reps: '60 seconds per side (Static)', phase: 'working' },
      { name: "Child's Pose", reps: '2 minutes', phase: 'cooldown' },
      { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds per side', phase: 'cooldown' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'cooldown' },
      { name: 'Box Breathing (In Bed)', reps: '2 minutes', phase: 'cooldown' },
    ],
  },
  {
    name: 'Nomad PM 30min',
    category: 'Flexibility',
    estimated_duration_min: 30,
    purpose: ['recovery'],
    exercises: [
      { name: 'Wall Pectoral Stretch', reps: '60 seconds per side (Static)', phase: 'working' },
      { name: "Child's Pose", reps: '2 minutes', phase: 'cooldown' },
      { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds per side', phase: 'cooldown' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'cooldown' },
      { name: 'Box Breathing (In Bed)', reps: '2 minutes', phase: 'cooldown' },
      { name: 'Legs-Up-The-Wall Pose', reps: '5 minutes', phase: 'cooldown' },
      { name: 'Mental Wind-Down', reps: '10 minutes of journaling', phase: 'cooldown' },
    ],
  },
  // Hotel Workout
  {
    name: 'Nomad Hotel 5min',
    category: 'HIIT',
    estimated_duration_min: 5,
    purpose: ['conditioning'],
    exercises: [
      { name: 'Twisting Reverse Lunge', reps: '10 reps per leg — AMRAP 5 min', phase: 'working', is_circuit: true },
      { name: 'Wall Push-Ups', reps: '10 reps — AMRAP 5 min', phase: 'working', is_circuit: true },
    ],
  },
  {
    name: 'Nomad Hotel 15min',
    category: 'HIIT',
    estimated_duration_min: 15,
    purpose: ['conditioning'],
    exercises: [
      { name: 'Twisting Reverse Lunge', reps: '12-15 reps per leg — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Wall Push-Ups', reps: '12-15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Bent-Over Band Row', reps: '12-15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Jump Rope', reps: '60 seconds — 3 rounds', phase: 'working', is_circuit: true },
    ],
  },
  {
    name: 'Nomad Hotel 45min',
    category: 'HIIT',
    estimated_duration_min: 45,
    purpose: ['conditioning'],
    exercises: [
      { name: 'Manual Calf/Foot Release', reps: '3 mins', phase: 'warmup' },
      { name: 'Wall Pectoral Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Glute Bridges', reps: '15 reps', phase: 'warmup' },
      { name: 'Bird-Dogs', reps: '10 reps/side', phase: 'warmup' },
      { name: 'Twisting Reverse Lunge', reps: '15 reps per leg — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Wall Push-Ups', reps: '15 reps — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Bent-Over Band Row', reps: '15 reps — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Band Squat to Press (Thruster)', reps: '15 reps — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Jump Rope', reps: '2 minutes — 4 rounds', phase: 'working', is_circuit: true },
      { name: "Child's Pose", reps: '2 minutes', phase: 'cooldown' },
      { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds/side', phase: 'cooldown' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'cooldown' },
    ],
  },
  // Gym Workout
  {
    name: 'Nomad Gym 30min',
    category: 'Strength',
    estimated_duration_min: 30,
    purpose: ['strength', 'balance'],
    exercises: [
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Wall Pectoral Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Dumbbell Goblet Squat', reps: '15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Standing Cable Row', reps: '15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Stability Ball Dumbbell Chest Press', reps: '15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Single-Leg Scaption', reps: '10 reps per leg — 3 rounds', phase: 'working', is_circuit: true },
    ],
  },
  {
    name: 'Nomad Gym 45min',
    category: 'Strength',
    estimated_duration_min: 45,
    purpose: ['strength', 'balance'],
    exercises: [
      { name: 'Foam Rolling (Gym)', reps: '5 mins (Calves, Quads, Lats)', phase: 'warmup' },
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Plank', reps: '2 sets of 45-second holds', phase: 'warmup' },
      { name: 'Step-Up to Balance', reps: '12-15 reps per leg — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Standing Cable Chest Press', reps: '12-15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Standing Cable Row', reps: '12-15 reps — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Single-Leg Dumbbell Curl to Press', reps: '10 reps per leg — 3 rounds', phase: 'working', is_circuit: true },
      { name: 'Foam Rolling (Gym)', reps: 'Roll tight areas', phase: 'cooldown' },
      { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds/side (Static)', phase: 'cooldown' },
    ],
  },
  {
    name: 'Nomad Gym 60min',
    category: 'Strength',
    estimated_duration_min: 60,
    purpose: ['strength', 'balance', 'conditioning'],
    exercises: [
      { name: 'Foam Rolling (Gym)', reps: '5 mins', phase: 'warmup' },
      { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Wall Pectoral Stretch', reps: 'Active — 10 reps/side', phase: 'warmup' },
      { name: 'Jump Rope', reps: '3 mins light cardio', phase: 'warmup' },
      { name: 'Glute Bridges', reps: '2 sets of 15', phase: 'warmup' },
      { name: 'Plank', reps: '2 sets of 60 seconds', phase: 'warmup' },
      { name: 'Bird-Dogs', reps: '2 sets of 10/side', phase: 'warmup' },
      { name: 'Multiplanar Lunge to Balance', reps: '15 reps per leg — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Stability Ball Dumbbell Chest Press', reps: '15 reps — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Standing Cable Row', reps: '15 reps — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Single-Leg Scaption', reps: '12 reps per leg — 4 rounds', phase: 'working', is_circuit: true },
      { name: 'Single-Leg Dumbbell Curl to Press', reps: '12 reps per leg — 4 rounds', phase: 'working', is_circuit: true },
      { name: "Child's Pose", reps: '2 minutes', phase: 'cooldown' },
      { name: 'Cat-Cow Flow', reps: '10 slow transitions', phase: 'cooldown' },
    ],
  },
];

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fast idempotency guard: if any Nomad template already exists, skip all inserts.
  // This prevents duplicate exercises when the endpoint is called concurrently
  // (e.g. React 18 StrictMode double-invoking effects).
  const { count: nomadTemplateCount } = await db
    .from('workout_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .ilike('name', 'Nomad %');

  if ((nomadTemplateCount ?? 0) > 0) {
    return NextResponse.json({ success: true, exercises_seeded: 0, templates_seeded: 0, already_seeded: true });
  }

  // 1. Ensure exercise categories exist (auto-seed if empty)
  const { data: categories } = await db
    .from('exercise_categories')
    .select('id, name')
    .eq('user_id', user.id);

  const categoryMap: Record<string, string> = {};

  if (!categories || categories.length === 0) {
    // Seed default categories
    const DEFAULT_CATEGORIES = [
      { name: 'Push', sort_order: 0 }, { name: 'Pull', sort_order: 1 },
      { name: 'Legs', sort_order: 2 }, { name: 'Core', sort_order: 3 },
      { name: 'Cardio', sort_order: 4 }, { name: 'Flexibility', sort_order: 5 },
      { name: 'Olympic', sort_order: 6 }, { name: 'Plyometric', sort_order: 7 },
      { name: 'Balance', sort_order: 8 }, { name: 'Other', sort_order: 9 },
    ];
    const { data: seeded } = await db
      .from('exercise_categories')
      .insert(DEFAULT_CATEGORIES.map((c) => ({ user_id: user.id, ...c })))
      .select('id, name');
    for (const cat of seeded ?? []) categoryMap[cat.name] = cat.id;
  } else {
    for (const cat of categories) categoryMap[cat.name] = cat.id;
  }

  // 2. Get existing exercises for this user to skip duplicates
  const { data: existingExercises } = await db
    .from('exercises')
    .select('name')
    .eq('user_id', user.id);

  const existingNames = new Set((existingExercises ?? []).map((e: { name: string }) => e.name));

  // 3. Insert missing exercises
  const exercisesToInsert = Object.entries(GLOSSARY)
    .filter(([name]) => !existingNames.has(name))
    .map(([name, instructions]) => ({
      user_id: user.id,
      name,
      instructions,
      category_id: categoryMap[EXERCISE_CATEGORIES[name] ?? 'Other'] ?? null,
      is_active: true,
      use_count: 0,
    }));

  let exercisesSeeded = 0;
  if (exercisesToInsert.length > 0) {
    const { data: inserted, error } = await db
      .from('exercises')
      .insert(exercisesToInsert)
      .select('id, name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    exercisesSeeded = inserted?.length ?? 0;
    // Update existingNames with newly inserted
    for (const ex of inserted ?? []) existingNames.add(ex.name);
  }

  // 4. Build a map from exercise name → exercise_id for template seeding
  const { data: allExercises } = await db
    .from('exercises')
    .select('id, name')
    .eq('user_id', user.id);

  const exerciseIdMap: Record<string, string> = {};
  for (const ex of allExercises ?? []) exerciseIdMap[ex.name] = ex.id;

  // 5. Get existing templates to skip duplicates
  const { data: existingTemplates } = await db
    .from('workout_templates')
    .select('name')
    .eq('user_id', user.id);

  const existingTemplateNames = new Set((existingTemplates ?? []).map((t: { name: string }) => t.name));

  // 6. Seed missing templates
  let templatesSeeded = 0;

  for (const tmpl of TEMPLATES) {
    if (existingTemplateNames.has(tmpl.name)) continue;

    const { data: template, error: tmplErr } = await db
      .from('workout_templates')
      .insert({
        user_id: user.id,
        name: tmpl.name,
        category: tmpl.category,
        estimated_duration_min: tmpl.estimated_duration_min,
        purpose: tmpl.purpose,
      })
      .select('id')
      .single();

    if (tmplErr || !template) continue;

    const exerciseRows = tmpl.exercises.map((ex, i) => ({
      template_id: template.id,
      name: ex.name,
      exercise_id: exerciseIdMap[ex.name] ?? null,
      notes: ex.reps,
      phase: ex.phase ?? 'working',
      is_circuit: ex.is_circuit ?? false,
      sort_order: i,
      rest_sec: 60,
    }));

    await db.from('workout_template_exercises').insert(exerciseRows);
    templatesSeeded++;
  }

  return NextResponse.json({
    success: true,
    exercises_seeded: exercisesSeeded,
    templates_seeded: templatesSeeded,
  });
}
