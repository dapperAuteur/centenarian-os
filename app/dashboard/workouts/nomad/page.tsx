'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon, Zap, Dumbbell, Clock, ChevronDown, ChevronUp, CheckCircle2, Info, Activity, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import WorkoutLogForm from '@/components/workouts/WorkoutLogForm';
import WorkoutFeedbackModal from '@/components/workouts/WorkoutFeedbackModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryKey = 'AM' | 'PM' | 'WORKOUT_HOTEL' | 'WORKOUT_GYM';
type DurationId = '5' | '15' | '30' | '45' | '60';
type ActiveDurations = Record<CategoryKey, DurationId>;

interface Exercise {
  name: string;
  reps: string;
}

interface RoutineSection {
  name: string;
  context?: string;
  exercises: Exercise[];
}

interface RoutineTab {
  id: DurationId;
  label: string;
  title: string;
  context: string;
  exercises?: Exercise[];
  sections?: RoutineSection[];
}

interface RoutineCategory {
  icon: React.ReactNode;
  title: string;
  goal: string;
  tabs: RoutineTab[];
}

interface FrictionScenario {
  condition: string;
  action: string;
}

// ---------------------------------------------------------------------------
// Data
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

const ROUTINES: Record<CategoryKey, RoutineCategory> = {
  AM: {
    icon: <Sun className="w-5 h-5" />,
    title: 'AM Priming',
    goal: 'Undo the physical shortening of sleep and prepare the kinetic chain for a day of sitting or travel.',
    tabs: [
      {
        id: '5', label: '5 Min', title: 'The 5-Minute Quick Reset',
        context: 'Low Time / Low Energy. Do this immediately upon waking before checking emails.',
        exercises: [
          { name: 'Half-Kneeling Hip Flexor Stretch', reps: '10 reps per side (hold 2s per rep)' },
          { name: 'Glute Bridges', reps: '15 controlled reps' },
        ],
      },
      {
        id: '15', label: '15 Min', title: 'The 15-Minute Daily Maintenance',
        context: 'Standard Morning. Complete the 5-Minute Reset, plus:',
        exercises: [
          { name: 'Half-Kneeling Hip Flexor Stretch', reps: '10 reps per side' },
          { name: 'Glute Bridges', reps: '15 controlled reps' },
          { name: 'Cat-Cow Flow', reps: '10 slow transitions' },
          { name: 'Bird-Dogs', reps: '10 reps per side' },
          { name: 'Standing Band Pull-Aparts', reps: '2 sets of 15 reps' },
        ],
      },
      {
        id: '30', label: '30 Min', title: 'The 30-Minute Deep System Prep',
        context: 'Optimal Travel Day. Complete the 15-Minute Maintenance, plus:',
        exercises: [
          { name: 'Manual Calf/Foot Release', reps: '5 minutes' },
          { name: 'Plank', reps: '3 sets of 30-60 second holds' },
          { name: 'Active Walking Lunge', reps: '2 sets of 10 reps per leg' },
        ],
      },
    ],
  },
  PM: {
    icon: <Moon className="w-5 h-5" />,
    title: 'PM Recovery',
    goal: 'Down-regulate the Autonomic Nervous System from Sympathetic (Fight/Flight) to Parasympathetic (Rest/Digest).',
    tabs: [
      {
        id: '5', label: '5 Min', title: 'The 5-Minute Sleep Signal',
        context: 'High Fatigue / Late Arrival. Do this immediately after getting into bed or winding down.',
        exercises: [
          { name: 'Wall Pectoral Stretch', reps: '60 seconds per side (Static)' },
          { name: 'Box Breathing (In Bed)', reps: '2 minutes' },
        ],
      },
      {
        id: '15', label: '15 Min', title: 'The 15-Minute Stress Offload',
        context: 'Standard Evening. Complete the 5-Minute Sleep Signal, plus:',
        exercises: [
          { name: "Child's Pose", reps: '2 minutes' },
          { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds per side' },
          { name: 'Cat-Cow Flow', reps: '10 slow transitions' },
        ],
      },
      {
        id: '30', label: '30 Min', title: 'The 30-Minute Tissue Restoration',
        context: 'High Stress Day. Complete the 15-Minute Stress Offload, plus:',
        exercises: [
          { name: 'Legs-Up-The-Wall Pose', reps: '5 minutes' },
          { name: 'Mental Wind-Down', reps: '10 minutes of journaling' },
        ],
      },
    ],
  },
  WORKOUT_HOTEL: {
    icon: <Zap className="w-5 h-5" />,
    title: 'Metabolic Engine (Hotel)',
    goal: 'Maximize caloric expenditure using Bands & Bodyweight. ALL resistance movements follow a strict 4/2/1/1 Tempo.',
    tabs: [
      {
        id: '5', label: '5 Min', title: 'The 5-Minute Emergency Burn',
        context: 'Time is critical but you refuse to break your habit. AMRAP (As Many Rounds As Possible) in 5 minutes. No rest.',
        exercises: [
          { name: 'Twisting Reverse Lunge', reps: '10 reps per leg' },
          { name: 'Wall Push-Ups', reps: '10 reps' },
        ],
      },
      {
        id: '15', label: '15 Min', title: 'The 15-Minute Hotel Circuit',
        context: 'Standard high-density metabolic driver. 3 Rounds. 60s rest between rounds.',
        exercises: [
          { name: 'Twisting Reverse Lunge', reps: '12-15 reps per leg' },
          { name: 'Wall Push-Ups', reps: '12-15 reps' },
          { name: 'Bent-Over Band Row', reps: '12-15 reps' },
          { name: 'Jump Rope', reps: '60 seconds' },
        ],
      },
      {
        id: '45', label: '45 Min', title: 'The 45-Minute Deep Work',
        context: 'Full Phase 1 Integration. Use on days with full schedule control.',
        sections: [
          {
            name: 'Phase 1: Warm-Up (10 Mins)',
            exercises: [
              { name: 'Manual Calf/Foot Release', reps: '3 mins' },
              { name: 'Wall Pectoral Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Glute Bridges', reps: '15 reps' },
              { name: 'Bird-Dogs', reps: '10 reps/side' },
            ],
          },
          {
            name: 'Phase 2: Extended Circuit (25 Mins)',
            context: '4 Rounds. Rest 60s between rounds.',
            exercises: [
              { name: 'Twisting Reverse Lunge', reps: '15 reps per leg' },
              { name: 'Wall Push-Ups', reps: '15 reps' },
              { name: 'Bent-Over Band Row', reps: '15 reps' },
              { name: 'Band Squat to Press (Thruster)', reps: '15 reps' },
              { name: 'Jump Rope', reps: '2 Minutes' },
            ],
          },
          {
            name: 'Phase 3: Cool-Down (10 Mins)',
            exercises: [
              { name: "Child's Pose", reps: '2 minutes' },
              { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds/side' },
              { name: 'Cat-Cow Flow', reps: '10 slow transitions' },
            ],
          },
        ],
      },
    ],
  },
  WORKOUT_GYM: {
    icon: <Dumbbell className="w-5 h-5" />,
    title: 'Metabolic Engine (Full Gym)',
    goal: 'For when you have time and access to a full gym. Leverages cables, dumbbells, and stability balls for maximum Phase 1 adaptations.',
    tabs: [
      {
        id: '30', label: '30 Min', title: 'The 30-Minute Gym Circuit',
        context: 'High-density gym stabilization. 3 Rounds. 60s rest between rounds. Focus strictly on the 4/2/1/1 tempo.',
        sections: [
          {
            name: 'Warm-Up (5 Mins)',
            exercises: [
              { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Wall Pectoral Stretch', reps: 'Active - 10 reps/side' },
            ],
          },
          {
            name: 'The Circuit (25 Mins)',
            exercises: [
              { name: 'Dumbbell Goblet Squat', reps: '15 reps' },
              { name: 'Standing Cable Row', reps: '15 reps' },
              { name: 'Stability Ball Dumbbell Chest Press', reps: '15 reps' },
              { name: 'Single-Leg Scaption', reps: '10 reps per leg' },
            ],
          },
        ],
      },
      {
        id: '45', label: '45 Min', title: 'The 45-Minute Gym Standard',
        context: "The standard Phase 1 OPT workout. Utilize the gym's foam roller for a true release.",
        sections: [
          {
            name: 'Phase 1: Warm-Up & Activation (10 Mins)',
            exercises: [
              { name: 'Foam Rolling (Gym)', reps: '5 Mins (Calves, Quads, Lats)' },
              { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Plank', reps: '2 sets of 45-second holds' },
            ],
          },
          {
            name: 'Phase 2: The Circuit (3 Rounds)',
            context: 'Rest 60s between rounds.',
            exercises: [
              { name: 'Step-Up to Balance', reps: '12-15 reps per leg' },
              { name: 'Standing Cable Chest Press', reps: '12-15 reps' },
              { name: 'Standing Cable Row', reps: '12-15 reps' },
              { name: 'Single-Leg Dumbbell Curl to Press', reps: '10 reps per leg' },
            ],
          },
          {
            name: 'Phase 3: Cool-Down (5 Mins)',
            exercises: [
              { name: 'Foam Rolling (Gym)', reps: 'Roll tight areas' },
              { name: 'Latissimus Dorsi Doorframe Stretch', reps: '60 seconds/side (Static)' },
            ],
          },
        ],
      },
      {
        id: '60', label: '60 Min', title: 'The 60-Minute Phase 1 Integration',
        context: 'The ultimate Phase 1 workout when you have full facility access and schedule control.',
        sections: [
          {
            name: 'Phase 1: Warm-Up (15 Mins)',
            exercises: [
              { name: 'Foam Rolling (Gym)', reps: '5 Mins' },
              { name: 'Half-Kneeling Hip Flexor Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Wall Pectoral Stretch', reps: 'Active - 10 reps/side' },
              { name: 'Jump Rope', reps: '3 Mins light cardio' },
            ],
          },
          {
            name: 'Phase 2: Activation (10 Mins)',
            exercises: [
              { name: 'Glute Bridges', reps: '2 sets of 15' },
              { name: 'Plank', reps: '2 sets of 60 seconds' },
              { name: 'Bird-Dogs', reps: '2 sets of 10/side' },
            ],
          },
          {
            name: 'Phase 3: The Extended Circuit (4 Rounds)',
            context: 'Rest 60s between rounds.',
            exercises: [
              { name: 'Multiplanar Lunge to Balance', reps: '15 reps per leg' },
              { name: 'Stability Ball Dumbbell Chest Press', reps: '15 reps' },
              { name: 'Standing Cable Row', reps: '15 reps' },
              { name: 'Single-Leg Scaption', reps: '12 reps per leg' },
              { name: 'Single-Leg Dumbbell Curl to Press', reps: '12 reps per leg' },
            ],
          },
          {
            name: 'Phase 4: Cool-Down (5 Mins)',
            exercises: [
              { name: "Child's Pose", reps: '2 minutes' },
              { name: 'Cat-Cow Flow', reps: '10 slow transitions' },
            ],
          },
        ],
      },
    ],
  },
};

const FRICTION_PROTOCOL: FrictionScenario[] = [
  {
    condition: 'Arrive at hotel late and exhausted (High Stress/Low Energy)',
    action: 'Execute the 5-Minute PM Recovery (Sleep Signal) to shift into a restorative state without taxing muscles.',
  },
  {
    condition: 'Stuck in an airport with a long layover or short gap between calls',
    action: 'Execute the 5-Minute Emergency Burn Workout to counteract postural damage and maintain streak.',
  },
  {
    condition: 'Wake up sluggish but have time before your first meeting',
    action: 'Do not force the 45-min workout. Execute the 15-Minute AM Priming to gently wake the nervous system.',
  },
  {
    condition: 'Forced to eat airport/convenience food',
    action: 'Pair any carbohydrate with a protein and healthy fat (e.g., apple + almonds) to blunt the insulin spike.',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
  estimated_duration_min?: number | null;
  purpose?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workout_template_exercises?: any[];
}

export default function NomadOSPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('WORKOUT_GYM');
  const [activeDurations, setActiveDurations] = useState<ActiveDurations>({ AM: '5', PM: '15', WORKOUT_HOTEL: '15', WORKOUT_GYM: '45' });
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [showFriction, setShowFriction] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  // useRef persists across StrictMode double-invocations without causing re-renders
  const seedCalledRef = useRef(false);

  // Log workout modal
  const [logTemplate, setLogTemplate] = useState<Template | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  // Feedback modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLogId, setFeedbackLogId] = useState<string | undefined>();
  const [feedbackCategory, setFeedbackCategory] = useState<CategoryKey>('WORKOUT_GYM');
  const [feedbackDuration, setFeedbackDuration] = useState<DurationId>('45');

  // Seed + load templates on mount
  const loadTemplates = useCallback(async () => {
    const res = await offlineFetch('/api/workouts');
    if (res.ok) {
      const all = await res.json();
      setTemplates((all as Template[]).filter((t) => t.name.startsWith('Nomad ')));
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // seedCalledRef prevents double-call in React 18 StrictMode;
      // the API also has its own idempotency guard as a safety net.
      if (!seedCalledRef.current) {
        seedCalledRef.current = true;
        await offlineFetch('/api/workouts/nomad/seed', { method: 'POST' }).catch(() => {});
      }
      await loadTemplates();
    };
    init();
  }, [loadTemplates]);

  const handleDurationChange = (duration: DurationId) => {
    setActiveDurations((prev) => ({ ...prev, [activeCategory]: duration }));
    setExpandedExercise(null);
  };

  const toggleExercise = (name: string) => {
    setExpandedExercise(expandedExercise === name ? null : name);
  };

  const getTemplateForCurrent = () => {
    const dur = activeDurations[activeCategory];
    const templateName = `Nomad ${
      activeCategory === 'AM' ? 'AM' :
      activeCategory === 'PM' ? 'PM' :
      activeCategory === 'WORKOUT_HOTEL' ? 'Hotel' :
      'Gym'
    } ${dur}min`;
    return templates.find((t) => t.name === templateName) ?? null;
  };

  const handleLogWorkout = () => {
    const tmpl = getTemplateForCurrent();
    if (tmpl) {
      setLogTemplate(tmpl);
      setLogOpen(true);
    }
  };

  const handleLogSaved = (logId?: string) => {
    setLogOpen(false);
    const dur = activeDurations[activeCategory];
    setFeedbackLogId(logId);
    setFeedbackCategory(activeCategory);
    setFeedbackDuration(dur);
    setFeedbackOpen(true);
    loadTemplates();
  };

  const currentData = ROUTINES[activeCategory];
  const currentRoutine = currentData.tabs.find((t) => t.id === activeDurations[activeCategory]);
  const currentTemplate = getTemplateForCurrent();

  const renderExerciseList = (exercises: Exercise[], sectionIdx = 0) => (
    <div className="space-y-2">
      {exercises.map((ex, idx) => {
        const panelId = `ex-detail-${sectionIdx}-${idx}`;
        const isExpanded = expandedExercise === ex.name;
        return (
          <div
            key={idx}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => toggleExercise(ex.name)}
              className="w-full text-left p-3.5 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{ex.name}</p>
                  <p className="text-xs text-gray-600">{ex.reps}</p>
                </div>
              </div>
              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />}
            </button>
            {isExpanded && (
              <div id={panelId} className="p-3.5 bg-white border-t border-gray-100 text-gray-700 text-sm leading-relaxed">
                <div className="flex gap-2">
                  <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" aria-hidden="true" />
                  <p>{GLOSSARY[ex.name] ?? 'Execution details pending.'}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!currentRoutine) return null;

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* Header */}
      <header className="bg-linear-to-br from-gray-900 to-indigo-900 text-white pt-10 pb-8 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard/workouts" className="inline-flex items-center gap-1.5 text-indigo-300 text-sm hover:text-white transition mb-4">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Workouts
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <Activity className="w-7 h-7 text-indigo-400" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">Nomad Longevity OS</h1>
            <span className="bg-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">v1.1</span>
          </div>
          <p className="text-indigo-300 text-xs uppercase tracking-widest font-semibold mb-5">Structured routines for travelers</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-indigo-800/50 pt-4">
            <div>
              <p className="text-gray-400 mb-0.5 text-xs">Objective</p>
              <p className="font-medium text-sm">Weight Loss · Postural Correction · Sleep</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5 text-xs">Equipment</p>
              <p className="font-medium text-sm">Hotel (Bands/Bodyweight) · Full Gym</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">

        {/* Category nav */}
        <div className="bg-white rounded-2xl shadow-sm p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.entries(ROUTINES) as [CategoryKey, RoutineCategory][]).map(([key, data]) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeCategory === key && !showFriction}
              onClick={() => { setActiveCategory(key); setExpandedExercise(null); setShowFriction(false); }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-semibold transition-all text-sm ${
                activeCategory === key && !showFriction
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span aria-hidden="true">{data.icon}</span>
              <span className="text-center leading-tight text-xs">{data.title}</span>
            </button>
          ))}
        </div>

        {/* Friction Protocol toggle */}
        <button
          type="button"
          aria-expanded={showFriction}
          aria-controls="friction-protocol-panel"
          onClick={() => setShowFriction(!showFriction)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition font-medium text-sm ${
            showFriction
              ? 'bg-orange-50 border-orange-300 text-orange-800'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            Friction Protocol — if/then responses to travel obstacles
          </div>
          {showFriction
            ? <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />}
        </button>

        {/* Friction Protocol content */}
        {showFriction && (
          <div id="friction-protocol-panel" className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
            <div className="bg-orange-50 px-5 py-4 border-b border-orange-200">
              <h2 className="font-bold text-orange-900">Friction Protocol</h2>
              <p className="text-sm text-orange-800 mt-0.5">Pre-planned if/then decisions for common travel obstacles.</p>
            </div>
            <div className="p-4 space-y-3">
              {FRICTION_PROTOCOL.map((scenario, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">If...</p>
                  <p className="text-sm font-semibold text-gray-800 mb-2">{scenario.condition}</p>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Then...</p>
                  <p className="text-sm text-gray-700">{scenario.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Category */}
        {!showFriction && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category header */}
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-1">{currentData.title}</h2>
              <p className="text-gray-600 text-sm">{currentData.goal}</p>
              {(activeCategory === 'WORKOUT_HOTEL' || activeCategory === 'WORKOUT_GYM') && (
                <div className="mt-3 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg flex items-start gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-900">
                    <span className="font-bold">Tempo Rule (4/2/1/1):</span> 4s lower, 2s hold at hardest point, 1s up, 1s rest. The 2-second hold builds stability.
                  </p>
                </div>
              )}
            </div>

            {/* Duration tabs */}
            <div className="px-5 pt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Duration options">
              {currentData.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeDurations[activeCategory] === tab.id}
                  onClick={() => handleDurationChange(tab.id)}
                  className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-colors ${
                    activeDurations[activeCategory] === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label} Option
                </button>
              ))}
            </div>

            {/* Routine content */}
            <div className="p-5">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{currentRoutine.title}</h3>
                <p className="text-gray-500 text-sm mt-0.5 font-medium">{currentRoutine.context}</p>
              </div>

              {currentRoutine.exercises ? (
                renderExerciseList(currentRoutine.exercises, 0)
              ) : currentRoutine.sections ? (
                <div className="space-y-6">
                  {currentRoutine.sections.map((sec, idx) => (
                    <div key={idx}>
                      <div className="mb-2">
                        <h4 className="font-bold text-gray-700 text-sm">{sec.name}</h4>
                        {sec.context && <p className="text-xs text-gray-600 mt-0.5">{sec.context}</p>}
                      </div>
                      {renderExerciseList(sec.exercises, idx)}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Log workout CTA */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleLogWorkout}
                  disabled={!currentTemplate}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Log This Workout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackCategory(activeCategory);
                    setFeedbackDuration(activeDurations[activeCategory]);
                    setFeedbackLogId(undefined);
                    setFeedbackOpen(true);
                  }}
                  className="sm:px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Rate workout
                </button>
              </div>
              {!currentTemplate && (
                <p className="text-xs text-gray-400 text-center mt-2">Templates loading — refresh if this persists.</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Log workout modal */}
      <WorkoutLogForm
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={loadTemplates}
        onWorkoutLogged={(logId) => handleLogSaved(logId)}
        template={logTemplate}
      />

      {/* Feedback modal */}
      <WorkoutFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        workoutLogId={feedbackLogId}
        defaultCategory={feedbackCategory}
        defaultDuration={feedbackDuration}
      />
    </div>
  );
}
