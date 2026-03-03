"use client"

import React, { useState } from 'react';
import { Sun, Moon, Zap, Clock, ChevronDown, ChevronUp, CheckCircle2, Info, Activity, ShieldAlert, MessageSquare, Send, Loader2, AlertTriangle, Dumbbell } from 'lucide-react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { WorkoutFeedbackFormData, WorkoutFeedbackResponse, MoodRating, DifficultyPreference, InstructionPreference } from './workout-feedback';

// --- TYPE DEFINITIONS ---

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

// --- DATA MODEL ---

const GLOSSARY: Record<string, string> = {
  "Half-Kneeling Hip Flexor Stretch": "Kneel on one knee with the front foot flat on the floor. Draw your belly button in (drawing-in maneuver) and squeeze the glute of your kneeling leg to tuck your pelvis under. Lean forward slightly until you feel a stretch in the front of your thigh. For an active stretch, hold for 2 seconds and repeat 10 times. For a static stretch, hold for 60 seconds.",
  "Glute Bridges": "Lie on your back with knees bent and feet flat on the floor. Draw your belly button in. Squeeze your glutes and push through your heels to lift your hips until your knees, hips, and shoulders form a straight line. Hold for 2 seconds at the top, then lower slowly.",
  "Cat-Cow Flow": "Start on your hands and knees. Draw your belly button in. Arch your back upward toward the ceiling (Cat), tucking your chin. Then, slowly let your belly drop toward the floor while lifting your chest and tailbone (Cow).",
  "Bird-Dogs": "Start on your hands and knees. Draw your belly button in and brace your core. Keep your spine perfectly neutral (do not let your lower back arch) as you simultaneously extend one arm forward and the opposite leg backward. Hold for 2 seconds, then return to the start.",
  "Standing Band Pull-Aparts": "Stand tall holding the band out in front of your chest. Draw your belly button in and keep your shoulders down. Initiate the movement by squeezing your shoulder blades together to pull the band apart until it touches your chest. Hold for 2 seconds, return slowly.",
  "Wall Pectoral Stretch": "Extend your arm with your palm facing forward, then bend the elbow to a 90-degree angle. Place your forearm/elbow against a doorframe or wall. Drop your shoulders away from your ears, draw your belly button in, and brace your core. Lightly lean your body forward. For an active stretch, hold 2 seconds and repeat 12-15 times. For a static stretch, hold for 60 seconds.",
  "Latissimus Dorsi Doorframe Stretch": "Stand facing a doorframe. Grab the frame with one hand at about shoulder height. Keeping your arm straight, push your hips back and away from the doorframe, letting your chest drop until you feel a deep stretch down the side of your back. Hold statically for 60 seconds.",
  "Twisting Reverse Lunge": "Stand tall. Step one foot backward and lower your hips until both knees are bent at a 90-degree angle. Ensure your front knee tracks directly over your second and third toes. Pause for 2 seconds at the bottom, simultaneously rotating your torso toward the front leg. Push through the front heel to return to the start. (Tempo: 4/2/1/1)",
  "Wall Push-Ups": "Stand facing a wall, hands placed slightly wider than shoulder-width. Perform the drawing-in maneuver (pull belly button to spine), squeeze your glutes, and tuck your chin so your body forms a perfectly straight line from head to heels. Take 4 seconds to lower your chest toward the wall. Hold for 2 seconds at the bottom without letting your hips sag or shoulders elevate, then press back up in 1 second. (Tempo: 4/2/1/1)",
  "Bent-Over Band Row": "Stand on the center of the resistance band. Hinge at your hips, pushing them backward. Maintain a neutral spine and a proud chest—do not let your upper back round. Draw your belly button in. Initiate the pull by squeezing your shoulder blades together before bending your elbows. Pull the handles to your sides, hold peak tension for 2 seconds, and take 4 seconds to slowly lower. (Tempo: 4/2/1/1)",
  "Band Squat to Press (Thruster)": "Stand on the resistance band with feet shoulder-width apart, holding the handles at shoulder height. Keeping your chest up, squat down as if sitting in a chair. Pause at the bottom, then stand up explosively, using the momentum to press the handles straight overhead. (Tempo: 4/2/1/1)",
  "Jump Rope": "Keep your elbows tucked in close to your ribs and use your wrists to turn the rope. Take small jumps, ensuring you land softly on the balls of your feet to absorb the impact and protect your Achilles tendons.",
  "Manual Calf/Foot Release": "Use your thumbs to apply firm pressure to the arches of your feet and tight spots in your calves, mimicking a foam roller.",
  "Plank": "Draw your belly button in, squeeze your glutes, and maintain a perfectly straight line from head to heels.",
  "Active Walking Lunge": "Step forward and lower your hips until both knees are bent at a 90-degree angle. Push off the front foot to bring your back foot forward into the next step.",
  "Box Breathing (In Bed)": "Lie flat. Inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds. Focus on deep diaphragmatic expansion.",
  "Child's Pose": "Kneel, sit back on your heels, and reach your arms forward on the floor. Take deep diaphragmatic breaths into your lower back.",
  "Legs-Up-The-Wall Pose": "Lie on your back, resting your legs vertically against the wall to promote venous return and reduce lower body swelling from flights.",
  "Mental Wind-Down": "Engage in guided journaling away from blue light (screens) to reduce cognitive arousal before sleep.",
  "Foam Rolling (Gym)": "Since you are in a full gym, utilize a foam roller. Target the calves, quadriceps, and latissimus dorsi. Roll slowly until you find a tender spot, then hold pressure on that exact spot for 30 to 60 seconds until the tension releases. This inhibits overactive tissue.",
  "Dumbbell Goblet Squat": "Hold a dumbbell vertically against your chest. Perform the drawing-in maneuver (pull belly button toward spine) and brace your core tightly. Keeping your chest proud and spine neutral, push your hips back and squat down until your thighs are parallel to the floor. Ensure your knees track over your second and third toes. Hold the bottom position for 2 seconds, then push through your heels to stand. (Tempo: 4/2/1/1)",
  "Standing Cable Row": "Stand facing a cable machine with handles attached at chest height. Perform the drawing-in maneuver and brace your abdominals. Initiate the movement by retracting (squeezing) your shoulder blades together, then pull the handles toward your ribs. Keep your shoulders dropped away from your ears. Hold the peak contraction for 2 seconds before slowly returning to the start over 4 seconds. (Tempo: 4/2/1/1)",
  "Stability Ball Dumbbell Chest Press": "Sit on a stability ball with dumbbells, then walk your feet forward until your head and upper back are supported by the ball. Squeeze your glutes to lift your hips into a bridge position, forming a straight line from knees to shoulders. Draw your belly button in and brace your core to prevent your hips from sagging. Lower the dumbbells slowly for 4 seconds, pause for 2 seconds at the bottom stretch to maximize stabilization, then press back up. (Tempo: 4/2/1/1)",
  "Single-Leg Scaption": "Stand on one leg with a light dumbbell in each hand. Draw your belly button in and brace your core to maintain a neutral, stable pelvis. Raise both arms slightly in front of your body (at a 45-degree angle in the scapular plane) until they reach shoulder height. Keep your shoulders pressed down. Hold for 2 seconds at the top, then lower over 4 seconds. (Tempo: 4/2/1/1)",
  "Step-Up to Balance": "Stand facing a plyo box or bench with dumbbells in hand. Draw in and brace your core. Step one foot onto the box, pushing through the heel to stand up, simultaneously driving your opposite knee up to hip height. Hold this single-leg balance position for 2 seconds, ensuring your standing leg is fully straight and glute is squeezed. Step back down slowly. (Tempo: 4/2/1/1)",
  "Standing Cable Chest Press": "Stand facing away from a cable machine holding a handle in each hand, using a staggered (split) stance for stability. Draw your belly button in and brace your midsection to prevent your lower back from arching. Press the cables straight forward. Hold for 1 second, then slowly let your arms return over 4 seconds, pausing for 2 seconds at the stretch. (Tempo: 4/2/1/1)",
  "Single-Leg Dumbbell Curl to Press": "Stand on one leg holding dumbbells. Perform the drawing-in maneuver and brace your core to stabilize your spine. Curl the dumbbells up to your shoulders, then immediately press them overhead. Lower them back to your shoulders, then down to your sides. Maintain perfect balance and a neutral spine throughout. (Tempo: 4/2/1/1)",
  "Multiplanar Lunge to Balance": "Hold dumbbells at your sides. Step forward into a lunge (sagittal plane), dropping your hips until both knees are at 90 degrees. Push off the front foot to return to the start, but instead of putting the foot down, drive the knee up and balance on one leg for 2 seconds. Draw your belly button in and brace your core to maintain perfect alignment during the balance phase. (Tempo: 4/2/1/1)"
};

const ROUTINES: Record<CategoryKey, RoutineCategory> = {
  AM: {
    icon: <Sun className="w-5 h-5" />,
    title: "AM Priming",
    goal: "Undo the physical shortening of sleep and prepare the kinetic chain for a day of sitting or travel.",
    tabs: [
      {
        id: '5',
        label: "5 Min",
        title: "The 5-Minute Quick Reset",
        context: "Low Time / Low Energy. Do this immediately upon waking before checking emails.",
        exercises: [
          { name: "Half-Kneeling Hip Flexor Stretch", reps: "10 reps per side (hold 2s per rep)" },
          { name: "Glute Bridges", reps: "15 controlled reps" }
        ]
      },
      {
        id: '15',
        label: "15 Min",
        title: "The 15-Minute Daily Maintenance",
        context: "Standard Morning. Complete the 5-Minute Reset, plus:",
        exercises: [
          { name: "Half-Kneeling Hip Flexor Stretch", reps: "10 reps per side" },
          { name: "Glute Bridges", reps: "15 controlled reps" },
          { name: "Cat-Cow Flow", reps: "10 slow transitions" },
          { name: "Bird-Dogs", reps: "10 reps per side" },
          { name: "Standing Band Pull-Aparts", reps: "2 sets of 15 reps" }
        ]
      },
      {
        id: '30',
        label: "30 Min",
        title: "The 30-Minute Deep System Prep",
        context: "Optimal Travel Day. Complete the 15-Minute Maintenance, plus:",
        exercises: [
          { name: "Manual Calf/Foot Release", reps: "5 minutes" },
          { name: "Plank", reps: "3 sets of 30-60 second holds" },
          { name: "Active Walking Lunge", reps: "2 sets of 10 reps per leg" }
        ]
      }
    ]
  },
  PM: {
    icon: <Moon className="w-5 h-5" />,
    title: "PM Recovery",
    goal: "Down-regulate the Autonomic Nervous System from Sympathetic (Fight/Flight) to Parasympathetic (Rest/Digest).",
    tabs: [
      {
        id: '5',
        label: "5 Min",
        title: "The 5-Minute Sleep Signal",
        context: "High Fatigue / Late Arrival. Do this immediately after getting into bed or winding down.",
        exercises: [
          { name: "Wall Pectoral Stretch", reps: "60 seconds per side (Static)" },
          { name: "Box Breathing (In Bed)", reps: "2 minutes" }
        ]
      },
      {
        id: '15',
        label: "15 Min",
        title: "The 15-Minute Stress Offload",
        context: "Standard Evening. Complete the 5-Minute Sleep Signal, plus:",
        exercises: [
          { name: "Child's Pose", reps: "2 minutes" },
          { name: "Latissimus Dorsi Doorframe Stretch", reps: "60 seconds per side" },
          { name: "Cat-Cow Flow", reps: "10 slow transitions" }
        ]
      },
      {
        id: '30',
        label: "30 Min",
        title: "The 30-Minute Tissue Restoration",
        context: "High Stress Day. Complete the 15-Minute Stress Offload, plus:",
        exercises: [
          { name: "Legs-Up-The-Wall Pose", reps: "5 minutes" },
          { name: "Mental Wind-Down", reps: "10 minutes of journaling" }
        ]
      }
    ]
  },
  WORKOUT_HOTEL: {
    icon: <Zap className="w-5 h-5" />,
    title: "Metabolic Engine (Hotel)",
    goal: "Maximize caloric expenditure using Bands & Bodyweight. ALL resistance movements follow a strict 4/2/1/1 Tempo.",
    tabs: [
      {
        id: '5',
        label: "5 Min",
        title: "The 5-Minute Emergency Burn",
        context: "Time is critical but you refuse to break your habit. AMRAP (As Many Rounds As Possible) in 5 minutes. No rest.",
        exercises: [
          { name: "Twisting Reverse Lunge", reps: "10 reps per leg" },
          { name: "Wall Push-Ups", reps: "10 reps" }
        ]
      },
      {
        id: '15',
        label: "15 Min",
        title: "The 15-Minute Hotel Circuit",
        context: "Standard high-density metabolic driver. 3 Rounds. 60s rest between rounds.",
        exercises: [
          { name: "Twisting Reverse Lunge", reps: "12-15 reps per leg" },
          { name: "Wall Push-Ups", reps: "12-15 reps" },
          { name: "Bent-Over Band Row", reps: "12-15 reps" },
          { name: "Jump Rope", reps: "60 seconds" }
        ]
      },
      {
        id: '45',
        label: "45 Min",
        title: "The 45-Minute Deep Work",
        context: "Full Phase 1 Integration. Use on days with full schedule control.",
        sections: [
          {
            name: "Phase 1: Warm-Up (10 Mins)",
            exercises: [
              { name: "Manual Calf/Foot Release", reps: "3 mins" },
              { name: "Wall Pectoral Stretch", reps: "Active - 10 reps/side" },
              { name: "Half-Kneeling Hip Flexor Stretch", reps: "Active - 10 reps/side" },
              { name: "Glute Bridges", reps: "15 reps" },
              { name: "Bird-Dogs", reps: "10 reps/side" }
            ]
          },
          {
            name: "Phase 2: Extended Circuit (25 Mins)",
            context: "4 Rounds. Rest 60s between rounds.",
            exercises: [
              { name: "Twisting Reverse Lunge", reps: "15 reps per leg" },
              { name: "Wall Push-Ups", reps: "15 reps" },
              { name: "Bent-Over Band Row", reps: "15 reps" },
              { name: "Band Squat to Press (Thruster)", reps: "15 reps" },
              { name: "Jump Rope", reps: "2 Minutes" }
            ]
          },
          {
            name: "Phase 3: Cool-Down (10 Mins)",
            exercises: [
              { name: "Child's Pose", reps: "2 minutes" },
              { name: "Latissimus Dorsi Doorframe Stretch", reps: "60 seconds/side" },
              { name: "Cat-Cow Flow", reps: "10 slow transitions" }
            ]
          }
        ]
      }
    ]
  },
  WORKOUT_GYM: {
    icon: <Dumbbell className="w-5 h-5" />,
    title: "Metabolic Engine (Full Gym)",
    goal: "For when you have time and access to a full gym. Leverages cables, dumbbells, and stability balls for maximum Phase 1 adaptations.",
    tabs: [
      {
        id: '30',
        label: "30 Min",
        title: "The 30-Minute Gym Circuit",
        context: "High-density gym stabilization. 3 Rounds. 60s rest between rounds. Focus strictly on the 4/2/1/1 tempo.",
        sections: [
          {
            name: "Warm-Up (5 Mins)",
            exercises: [
              { name: "Half-Kneeling Hip Flexor Stretch", reps: "Active - 10 reps/side" },
              { name: "Wall Pectoral Stretch", reps: "Active - 10 reps/side" }
            ]
          },
          {
            name: "The Circuit (25 Mins)",
            exercises: [
              { name: "Dumbbell Goblet Squat", reps: "15 reps" },
              { name: "Standing Cable Row", reps: "15 reps" },
              { name: "Stability Ball Dumbbell Chest Press", reps: "15 reps" },
              { name: "Single-Leg Scaption", reps: "10 reps per leg" }
            ]
          }
        ]
      },
      {
        id: '45',
        label: "45 Min",
        title: "The 45-Minute Gym Standard",
        context: "The standard Phase 1 OPT workout. Utilize the gym's foam roller for a true release.",
        sections: [
          {
            name: "Phase 1: Warm-Up & Activation (10 Mins)",
            exercises: [
              { name: "Foam Rolling (Gym)", reps: "5 Mins (Calves, Quads, Lats)" },
              { name: "Half-Kneeling Hip Flexor Stretch", reps: "Active - 10 reps/side" },
              { name: "Plank", reps: "2 sets of 45-second holds" }
            ]
          },
          {
            name: "Phase 2: The Circuit (3 Rounds)",
            context: "Rest 60s between rounds.",
            exercises: [
              { name: "Step-Up to Balance", reps: "12-15 reps per leg" },
              { name: "Standing Cable Chest Press", reps: "12-15 reps" },
              { name: "Standing Cable Row", reps: "12-15 reps" },
              { name: "Single-Leg Dumbbell Curl to Press", reps: "10 reps per leg" }
            ]
          },
          {
            name: "Phase 3: Cool-Down (5 Mins)",
            exercises: [
              { name: "Foam Rolling (Gym)", reps: "Roll tight areas" },
              { name: "Latissimus Dorsi Doorframe Stretch", reps: "60 seconds/side (Static)" }
            ]
          }
        ]
      },
      {
        id: '60',
        label: "60 Min",
        title: "The 60-Minute Phase 1 Integration",
        context: "The ultimate Phase 1 workout when you have full facility access and schedule control.",
        sections: [
          {
            name: "Phase 1: Warm-Up (15 Mins)",
            exercises: [
              { name: "Foam Rolling (Gym)", reps: "5 Mins" },
              { name: "Half-Kneeling Hip Flexor Stretch", reps: "Active - 10 reps/side" },
              { name: "Wall Pectoral Stretch", reps: "Active - 10 reps/side" },
              { name: "Jump Rope", reps: "3 Mins light cardio" }
            ]
          },
          {
            name: "Phase 2: Activation (10 Mins)",
            exercises: [
              { name: "Glute Bridges", reps: "2 sets of 15" },
              { name: "Plank", reps: "2 sets of 60 seconds" },
              { name: "Bird-Dogs", reps: "2 sets of 10/side" }
            ]
          },
          {
            name: "Phase 3: The Extended Circuit (4 Rounds)",
            context: "Rest 60s between rounds.",
            exercises: [
              { name: "Multiplanar Lunge to Balance", reps: "15 reps per leg" },
              { name: "Stability Ball Dumbbell Chest Press", reps: "15 reps" },
              { name: "Standing Cable Row", reps: "15 reps" },
              { name: "Single-Leg Scaption", reps: "12 reps per leg" },
              { name: "Single-Leg Dumbbell Curl to Press", reps: "12 reps per leg" }
            ]
          },
          {
            name: "Phase 4: Cool-Down (5 Mins)",
            exercises: [
              { name: "Child's Pose", reps: "2 minutes" },
              { name: "Cat-Cow Flow", reps: "10 slow transitions" }
            ]
          }
        ]
      }
    ]
  }
};

const FRICTION_PROTOCOL: FrictionScenario[] = [
  {
    condition: "Arrive at hotel late and exhausted (High Stress/Low Energy)",
    action: "Execute the 5-Minute PM Recovery (Sleep Signal) to shift into a restorative state without taxing muscles."
  },
  {
    condition: "Stuck in an airport with a long layover or short gap between calls",
    action: "Execute the 5-Minute Emergency Burn Workout to counteract postural damage and maintain streak."
  },
  {
    condition: "Wake up sluggish but have time before your first meeting",
    action: "Do not force the 45-min workout. Execute the 15-Minute AM Priming to gently wake the nervous system."
  },
  {
    condition: "Forced to eat airport/convenience food",
    action: "Pair any carbohydrate with a protein and healthy fat (e.g., apple + almonds) to blunt the insulin spike."
  }
];

// --- COMPONENTS ---

export default function NomadOS() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('WORKOUT_GYM');
  const [activeDurations, setActiveDurations] = useState<ActiveDurations>({ AM: '5', PM: '15', WORKOUT_HOTEL: '15', WORKOUT_GYM: '45' });
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const handleDurationChange = (duration: DurationId) => {
    setActiveDurations(prev => ({ ...prev, [activeCategory]: duration }));
    setExpandedExercise(null);
  };

  const toggleExercise = (name: string) => {
    setExpandedExercise(expandedExercise === name ? null : name);
  };

  const currentData = ROUTINES[activeCategory];
  const currentRoutine = currentData.tabs.find(t => t.id === activeDurations[activeCategory]);

  if (!currentRoutine) return null;

  const renderExerciseList = (exercises: Exercise[]) => (
    <div className="space-y-3">
      {exercises.map((ex, idx) => (
        <div 
          key={idx} 
          className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
          onClick={() => toggleExercise(ex.name)}
        >
          <div className="p-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">{ex.name}</p>
                <p className="text-sm text-slate-500">{ex.reps}</p>
              </div>
            </div>
            {expandedExercise === ex.name ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
          
          {expandedExercise === ex.name && (
            <div className="p-4 bg-white border-t border-slate-100 text-slate-700 text-sm leading-relaxed">
              <div className="flex space-x-2">
                <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <p>{GLOSSARY[ex.name] || "Execution details pending."}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* HEADER */}
      <header className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white pt-12 pb-8 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-bold tracking-tight">Nomad Longevity OS</h1>
            <span className="bg-indigo-600 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">v1.1</span>
          </div>
          <p className="text-indigo-200 text-sm mb-6 uppercase tracking-widest font-semibold">Beta-Test Case Study 001</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-6 border-t border-indigo-800/50 pt-6">
            <div>
              <p className="text-slate-400 mb-1">Objective</p>
              <p className="font-medium">Weight Loss, Postural Correction, Sleep</p>
            </div>
            <div>
              <p className="text-slate-400 mb-1">Equipment Framework</p>
              <p className="font-medium">Hotel (Bands/Bodyweight) vs. Full Gym</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-4 relative z-10">

        {/* MAIN NAVIGATION */}
        <div className="bg-white rounded-2xl shadow-md p-2 mb-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.entries(ROUTINES) as [CategoryKey, RoutineCategory][]).map(([key, data]) => (
            <button
              key={key}
              onClick={() => { setActiveCategory(key); setExpandedExercise(null); }}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-2 rounded-xl font-semibold transition-all duration-200 text-sm ${
                activeCategory === key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {data.icon}
              <span className="text-center leading-tight">{data.title}</span>
            </button>
          ))}
        </div>

        {/* ACTIVE CATEGORY CONTENT */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          
          {/* Category Header */}
          <div className="bg-slate-50 p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">{currentData.title}</h2>
            <p className="text-slate-600 text-sm">{currentData.goal}</p>
            
            {/* Special rule for workouts */}
            {(activeCategory === 'WORKOUT_HOTEL' || activeCategory === 'WORKOUT_GYM') && (
              <div className="mt-4 bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start space-x-3">
                <Clock className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-indigo-900">
                  <span className="font-bold">Tempo Rule (4/2/1/1):</span> 4s lower, 2s hold at hardest point, 1s up, 1s rest. The 2-second hold builds stability.
                </p>
              </div>
            )}
          </div>

          {/* Duration Sub-tabs */}
          <div className="px-6 pt-6 flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
            {currentData.tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleDurationChange(tab.id)}
                className={`px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${
                  activeDurations[activeCategory] === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tab.label} Option
              </button>
            ))}
          </div>

          {/* Routine Content */}
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900">{currentRoutine.title}</h3>
              <p className="text-slate-500 mt-1 font-medium">{currentRoutine.context}</p>
            </div>

            {/* Flat list of exercises OR Sectioned list */}
            {currentRoutine.exercises ? (
              renderExerciseList(currentRoutine.exercises)
            ) : currentRoutine.sections ? (
              <div className="space-y-8">
                {currentRoutine.sections.map((sec, idx) => (
                  <div key={idx}>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{sec.name}</h4>
                    {sec.context && <p className="text-sm text-slate-500 mb-3 -mt-1">{sec.context}</p>}
                    {renderExerciseList(sec.exercises)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* FRICTION PROTOCOL (Always visible at bottom for quick reference) */}
        <div className="mt-12 mb-8">
          <div className="flex items-center space-x-2 mb-4 px-2">
            <ShieldAlert className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-800">The Friction Protocol</h2>
          </div>
          <p className="text-slate-500 text-sm mb-6 px-2">
            Environmental friction will derail motivation. Do not rely on willpower; rely on this system. Execute these pre-planned "If/Then" responses.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FRICTION_PROTOCOL.map((protocol, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-orange-400">
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">If this happens...</p>
                <p className="font-semibold text-slate-800 mb-4 leading-snug">{protocol.condition}</p>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Then do this:</p>
                  <p className="text-sm text-slate-600">{protocol.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WORKOUT FEEDBACK FORM */}
        <WorkoutFeedbackFormWrapper frictionProtocol={FRICTION_PROTOCOL} routines={ROUTINES} />

      </main>
    </div>
  );
}

// --- FEEDBACK FORM ---

const MOOD_BEFORE_LABELS = ['Exhausted', 'Low Energy', 'Neutral', 'Good', 'Fired Up'];
const MOOD_AFTER_LABELS = ['Worse', 'No Change', 'Slightly Better', 'Good', 'Energized'];

const CATEGORY_LABELS: Record<string, string> = {
  AM: 'AM Priming',
  PM: 'PM Recovery',
  WORKOUT_HOTEL: 'Hotel Workout',
  WORKOUT_GYM: 'Full Gym Workout',
  friction: 'Friction Protocol'
};

interface FeedbackFormProps {
  frictionProtocol: FrictionScenario[];
  routines: Record<CategoryKey, RoutineCategory>;
}

function WorkoutFeedbackFormWrapper({ frictionProtocol, routines }: FeedbackFormProps) {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!recaptchaSiteKey) {
    return (
      <div className="mt-12 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Feedback form is temporarily unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
      <WorkoutFeedbackForm frictionProtocol={frictionProtocol} routines={routines} />
    </GoogleReCaptchaProvider>
  );
}

function WorkoutFeedbackForm({ frictionProtocol, routines }: FeedbackFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('');
  const [selectedFrictionIndex, setSelectedFrictionIndex] = useState<number | null>(null);
  const [moodBefore, setMoodBefore] = useState<MoodRating | null>(null);
  const [moodAfter, setMoodAfter] = useState<MoodRating | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyPreference | null>(null);
  const [instructionPref, setInstructionPref] = useState<InstructionPreference | null>(null);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedDuration('');
    setSelectedFrictionIndex(null);
    setErrors(prev => { const { activity, ...rest } = prev; return rest; });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedCategory) {
      newErrors.activity = 'Please select which activity you did';
    } else if (selectedCategory === 'friction' && selectedFrictionIndex === null) {
      newErrors.activity = 'Please select which scenario you followed';
    } else if (selectedCategory !== 'friction' && !selectedDuration) {
      newErrors.activity = 'Please select which duration you completed';
    }

    if (!moodBefore) newErrors.moodBefore = 'Please rate how you felt before';
    if (!moodAfter) newErrors.moodAfter = 'Please rate how you felt after';
    if (!difficulty) newErrors.difficulty = 'Please select a difficulty preference';
    if (!instructionPref) newErrors.instructionPreference = 'Please select your instruction format preference';

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!executeRecaptcha) {
      setSubmitStatus('error');
      setSubmitMessage('reCAPTCHA is not ready. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const token = await executeRecaptcha('workout_feedback');

      const formData: WorkoutFeedbackFormData = {
        activity: {
          category: selectedCategory as 'AM' | 'PM' | 'WORKOUT_HOTEL' | 'WORKOUT_GYM' | 'friction',
          duration: selectedCategory !== 'friction' ? selectedDuration : null,
          ...(selectedCategory === 'friction' && selectedFrictionIndex !== null ? { frictionScenarioIndex: selectedFrictionIndex } : {})
        },
        moodBefore: moodBefore!,
        moodAfter: moodAfter!,
        difficulty: difficulty!,
        instructionPreference: instructionPref!,
        feedback: feedback.trim() || undefined,
        email: email.trim() || undefined,
        protocolVersion: 'longevity-v0'
      };

      const response = await fetch('/api/workout-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, token })
      });

      const result: WorkoutFeedbackResponse = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setSubmitMessage(result.message);
        // Reset form
        setSelectedCategory('');
        setSelectedDuration('');
        setSelectedFrictionIndex(null);
        setMoodBefore(null);
        setMoodAfter(null);
        setDifficulty(null);
        setInstructionPref(null);
        setFeedback('');
        setEmail('');
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.message);
        if (result.errors) {
          setErrors(result.errors as Record<string, string>);
        }
      }
    } catch {
      setSubmitStatus('error');
      setSubmitMessage('Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDurationOptions = (): { id: string; label: string }[] => {
    if (selectedCategory === 'friction' || !selectedCategory) return [];
    const category = routines[selectedCategory as CategoryKey];
    return category.tabs.map(t => ({ id: t.id, label: t.label }));
  };

  return (
    <div className="mt-12 mb-8">
      <div className="flex items-center space-x-2 mb-4 px-2">
        <MessageSquare className="w-6 h-6 text-slate-700" />
        <h2 className="text-xl font-bold text-slate-800">How Was Your Workout?</h2>
      </div>
      <p className="text-slate-500 text-sm mb-6 px-2">
        Your feedback helps refine these protocols. Takes about 30 seconds.
      </p>

      {submitStatus === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-green-800 font-semibold text-lg">{submitMessage}</p>
          <button
            onClick={() => setSubmitStatus('idle')}
            className="mt-4 text-sm text-green-700 underline hover:text-green-900"
          >
            Submit another response
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8">

          {/* 1. Activity Selection */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">What did you do?</legend>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {(['AM', 'PM', 'WORKOUT_HOTEL', 'WORKOUT_GYM', 'friction'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Duration sub-select for AM/PM/WORKOUT */}
            {selectedCategory && selectedCategory !== 'friction' && (
              <div className="flex flex-wrap gap-2 ml-1">
                {getDurationOptions().map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setSelectedDuration(opt.id); setErrors(prev => { const { activity, ...rest } = prev; return rest; }); }}
                    className={`py-2 px-4 rounded-full text-sm font-medium transition-colors ${
                      selectedDuration === opt.id
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Friction scenario select */}
            {selectedCategory === 'friction' && (
              <div className="space-y-2 ml-1">
                {frictionProtocol.map((scenario, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedFrictionIndex(idx); setErrors(prev => { const { activity, ...rest } = prev; return rest; }); }}
                    className={`w-full text-left py-2.5 px-4 rounded-xl text-sm transition-colors ${
                      selectedFrictionIndex === idx
                        ? 'bg-orange-50 border-2 border-orange-400 text-slate-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-medium">{scenario.condition}</span>
                  </button>
                ))}
              </div>
            )}

            {errors.activity && <p className="text-red-600 text-sm mt-2">{errors.activity}</p>}
          </fieldset>

          {/* 2. Mood Before */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">How did you feel before?</legend>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as MoodRating[]).map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => { setMoodBefore(rating); setErrors(prev => { const { moodBefore, ...rest } = prev; return rest; }); }}
                  className={`flex-1 py-3 rounded-xl text-center transition-colors ${
                    moodBefore === rating
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="text-lg font-bold block">{rating}</span>
                  <span className="text-[10px] leading-tight block mt-0.5">{MOOD_BEFORE_LABELS[rating - 1]}</span>
                </button>
              ))}
            </div>
            {errors.moodBefore && <p className="text-red-600 text-sm mt-2">{errors.moodBefore}</p>}
          </fieldset>

          {/* 3. Mood After */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">How did you feel after?</legend>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as MoodRating[]).map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => { setMoodAfter(rating); setErrors(prev => { const { moodAfter, ...rest } = prev; return rest; }); }}
                  className={`flex-1 py-3 rounded-xl text-center transition-colors ${
                    moodAfter === rating
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="text-lg font-bold block">{rating}</span>
                  <span className="text-[10px] leading-tight block mt-0.5">{MOOD_AFTER_LABELS[rating - 1]}</span>
                </button>
              ))}
            </div>
            {errors.moodAfter && <p className="text-red-600 text-sm mt-2">{errors.moodAfter}</p>}
          </fieldset>

          {/* 4. Difficulty */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Difficulty level</legend>
            <div className="flex gap-2">
              {([
                { value: 'easier' as const, label: 'Too Easy', sub: 'Make it harder' },
                { value: 'just-right' as const, label: 'Just Right', sub: 'Keep it here' },
                { value: 'harder' as const, label: 'Too Hard', sub: 'Dial it back' }
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setDifficulty(opt.value); setErrors(prev => { const { difficulty, ...rest } = prev; return rest; }); }}
                  className={`flex-1 py-3 px-2 rounded-xl text-center transition-colors ${
                    difficulty === opt.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="text-sm font-bold block">{opt.label}</span>
                  <span className="text-[10px] block mt-0.5 opacity-80">{opt.sub}</span>
                </button>
              ))}
            </div>
            {errors.difficulty && <p className="text-red-600 text-sm mt-2">{errors.difficulty}</p>}
          </fieldset>

          {/* 5. Instruction Clarity */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Are the instructions clear enough?</legend>
            <div className="flex gap-2">
              {([
                { value: 'text-is-fine' as const, label: 'Text Is Clear' },
                { value: 'need-images' as const, label: 'Need Images' },
                { value: 'need-video' as const, label: 'Need Video' }
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setInstructionPref(opt.value); setErrors(prev => { const { instructionPreference, ...rest } = prev; return rest; }); }}
                  className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold text-center transition-colors ${
                    instructionPref === opt.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.instructionPreference && <p className="text-red-600 text-sm mt-2">{errors.instructionPreference}</p>}
          </fieldset>

          {/* 6. Open Feedback */}
          <div>
            <label htmlFor="feedback" className="text-sm font-bold text-slate-700 uppercase tracking-wider block mb-3">
              Anything else? <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What would make this workout better for you?"
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{feedback.length}/1000</p>
          </div>

          {/* 7. Email */}
          <div>
            <label htmlFor="email" className="text-sm font-bold text-slate-700 uppercase tracking-wider block mb-3">
              Email <span className="font-normal normal-case text-slate-400">(optional — only if you want follow-up)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(prev => { const { email, ...rest } = prev; return rest; }); }}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.email && <p className="text-red-600 text-sm mt-2">{errors.email}</p>}
          </div>

          {/* Error alert */}
          {submitStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-800 text-sm font-medium">{submitMessage}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Submit Feedback</span>
              </>
            )}
          </button>

          {/* reCAPTCHA notice */}
          <p className="text-xs text-slate-400 text-center">
            This site is protected by reCAPTCHA and the Google{' '}
            <a href="https://policies.google.com/privacy" className="underline hover:text-slate-600" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
            <a href="https://policies.google.com/terms" className="underline hover:text-slate-600" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
          </p>
        </form>
      )}
    </div>
  );
}