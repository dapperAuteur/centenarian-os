'use client';

// MuscleDiagram.tsx
// SVG-based front/back body diagram. Highlights muscles from the primary_muscles array.
// Maps the app's muscle string values to SVG region IDs on a simplified body silhouette.

interface Props {
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  size?: 'sm' | 'md' | 'lg';
}

// Maps app muscle name strings → SVG path IDs (one or more regions per muscle group)
const MUSCLE_TO_PATHS: Record<string, string[]> = {
  // Front
  'chest':               ['f-chest-l', 'f-chest-r'],
  'pectorals':           ['f-chest-l', 'f-chest-r'],
  'anterior deltoid':    ['f-delt-l', 'f-delt-r'],
  'medial deltoid':      ['f-delt-l', 'f-delt-r'],
  'shoulders':           ['f-delt-l', 'f-delt-r', 'b-delt-l', 'b-delt-r'],
  'biceps':              ['f-bicep-l', 'f-bicep-r'],
  'forearms':            ['f-forearm-l', 'f-forearm-r'],
  'core':                ['f-abs'],
  'abs':                 ['f-abs'],
  'abdominals':          ['f-abs'],
  'obliques':            ['f-oblique-l', 'f-oblique-r'],
  'hip flexors':         ['f-hip-l', 'f-hip-r'],
  'quads':               ['f-quad-l', 'f-quad-r'],
  'quadriceps':          ['f-quad-l', 'f-quad-r'],
  'tibialis anterior':   ['f-shin-l', 'f-shin-r'],
  'tibialis':            ['f-shin-l', 'f-shin-r'],
  // Back
  'posterior deltoid':   ['b-delt-l', 'b-delt-r'],
  'traps':               ['b-trap-l', 'b-trap-r'],
  'trapezius':           ['b-trap-l', 'b-trap-r'],
  'rhomboids':           ['b-rhomb'],
  'upper back':          ['b-trap-l', 'b-trap-r', 'b-rhomb'],
  'lats':                ['b-lat-l', 'b-lat-r'],
  'latissimus dorsi':    ['b-lat-l', 'b-lat-r'],
  'lower back':          ['b-lower-back'],
  'spinal erectors':     ['b-lower-back'],
  'glutes':              ['b-glute-l', 'b-glute-r'],
  'hamstrings':          ['b-ham-l', 'b-ham-r'],
  'calves':              ['b-calf-l', 'b-calf-r', 'f-calf-l', 'f-calf-r'],
  'triceps':             ['b-tricep-l', 'b-tricep-r'],
  'neck':                ['f-neck', 'b-neck'],
  // Multi-view
  'full body':           [],
};

function normalizeMuscle(m: string): string {
  return m.toLowerCase().trim();
}

function getActivePaths(muscles: string[]): Set<string> {
  const active = new Set<string>();
  for (const m of muscles) {
    const key = normalizeMuscle(m);
    const paths = MUSCLE_TO_PATHS[key];
    if (paths) {
      paths.forEach((p) => active.add(p));
    } else {
      // Fuzzy: check if any key contains the word
      for (const [k, v] of Object.entries(MUSCLE_TO_PATHS)) {
        if (k.includes(key) || key.includes(k)) {
          v.forEach((p) => active.add(p));
          break;
        }
      }
    }
  }
  return active;
}

interface BodyPathProps {
  id: string;
  d: string;
  active: boolean;
  secondary?: boolean;
}

function BodyPath({ id, d, active, secondary }: BodyPathProps) {
  return (
    <path
      id={id}
      d={d}
      fill={active ? '#d946ef' : secondary ? '#f0abfc' : '#e5e7eb'}
      stroke={active ? '#a21caf' : '#d1d5db'}
      strokeWidth="0.5"
      opacity={active ? 0.9 : 0.6}
    />
  );
}

export default function MuscleDiagram({ primaryMuscles, secondaryMuscles = [], size = 'md' }: Props) {
  const primaryPaths  = getActivePaths(primaryMuscles);
  const secondaryPaths = getActivePaths(secondaryMuscles);

  const sizeClass = size === 'sm' ? 'h-40' : size === 'lg' ? 'h-72' : 'h-56';

  // Simplified body silhouette paths — viewBox 0 0 200 320 per figure (front + back side by side)
  // These are anatomically-inspired simplified regions, not exact medical diagrams.
  const isActive = (id: string) => primaryPaths.has(id);
  const isSecondary = (id: string) => secondaryPaths.has(id) && !primaryPaths.has(id);

  const paths = (id: string, d: string) => (
    <BodyPath key={id} id={id} d={d} active={isActive(id)} secondary={isSecondary(id)} />
  );

  const hasAny = primaryMuscles.length > 0 || secondaryMuscles.length > 0;

  return (
    <div>
      <div className={`flex justify-center gap-6 ${sizeClass}`}>
        {/* FRONT VIEW */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Front</span>
          <svg viewBox="0 0 100 200" className="h-full w-auto" role="img" aria-label="Front body view">
            {/* Body silhouette fill */}
            <ellipse cx="50" cy="14" rx="10" ry="11" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5" />
            {/* Neck */}
            {paths('f-neck', 'M44,24 L56,24 L55,31 L45,31 Z')}
            {/* Shoulders */}
            {paths('f-delt-l', 'M28,32 Q20,34 20,44 L28,44 L30,32 Z')}
            {paths('f-delt-r', 'M72,32 Q80,34 80,44 L72,44 L70,32 Z')}
            {/* Chest */}
            {paths('f-chest-l', 'M30,32 L50,33 L49,52 L30,50 Z')}
            {paths('f-chest-r', 'M50,33 L70,32 L70,50 L51,52 Z')}
            {/* Abs */}
            {paths('f-abs', 'M41,52 L59,52 L59,80 L41,80 Z')}
            {/* Obliques */}
            {paths('f-oblique-l', 'M30,50 L41,52 L41,78 L30,75 Z')}
            {paths('f-oblique-r', 'M59,52 L70,50 L70,75 L59,78 Z')}
            {/* Biceps */}
            {paths('f-bicep-l', 'M20,44 L28,44 L27,68 L18,66 Z')}
            {paths('f-bicep-r', 'M72,44 L80,44 L82,66 L73,68 Z')}
            {/* Forearms */}
            {paths('f-forearm-l', 'M18,66 L27,68 L25,92 L16,88 Z')}
            {paths('f-forearm-r', 'M73,68 L82,66 L84,88 L75,92 Z')}
            {/* Hips */}
            {paths('f-hip-l', 'M30,78 L50,80 L48,95 L28,92 Z')}
            {paths('f-hip-r', 'M50,80 L70,78 L72,92 L52,95 Z')}
            {/* Quads */}
            {paths('f-quad-l', 'M28,92 L48,95 L46,140 L26,136 Z')}
            {paths('f-quad-r', 'M52,95 L72,92 L74,136 L54,140 Z')}
            {/* Shins/Tibialis */}
            {paths('f-shin-l', 'M26,144 L44,148 L43,185 L24,182 Z')}
            {paths('f-shin-r', 'M56,148 L74,144 L76,182 L57,185 Z')}
            {/* Calves (front visible part) */}
            {paths('f-calf-l', 'M24,182 L43,185 L42,198 L23,196 Z')}
            {paths('f-calf-r', 'M57,185 L76,182 L77,196 L58,198 Z')}
            {/* Knee gap areas */}
            <rect x="26" y="138" width="18" height="10" fill="#f9fafb" stroke="#d1d5db" strokeWidth="0.3" rx="2" />
            <rect x="56" y="138" width="18" height="10" fill="#f9fafb" stroke="#d1d5db" strokeWidth="0.3" rx="2" />
          </svg>
        </div>

        {/* BACK VIEW */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Back</span>
          <svg viewBox="0 0 100 200" className="h-full w-auto" role="img" aria-label="Back body view">
            {/* Head */}
            <ellipse cx="50" cy="14" rx="10" ry="11" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5" />
            {/* Neck */}
            {paths('b-neck', 'M44,24 L56,24 L55,31 L45,31 Z')}
            {/* Traps */}
            {paths('b-trap-l', 'M30,32 L50,30 L49,46 L28,44 Z')}
            {paths('b-trap-r', 'M50,30 L70,32 L72,44 L51,46 Z')}
            {/* Rear delts */}
            {paths('b-delt-l', 'M20,33 Q18,36 20,46 L28,44 L30,32 Z')}
            {paths('b-delt-r', 'M80,33 Q82,36 80,46 L72,44 L70,32 Z')}
            {/* Rhomboids (mid-upper back) */}
            {paths('b-rhomb', 'M40,46 L60,46 L60,62 L40,62 Z')}
            {/* Lats */}
            {paths('b-lat-l', 'M28,44 L40,46 L38,78 L26,75 Z')}
            {paths('b-lat-r', 'M60,46 L72,44 L74,75 L62,78 Z')}
            {/* Lower back */}
            {paths('b-lower-back', 'M38,62 L62,62 L62,82 L38,82 Z')}
            {/* Triceps */}
            {paths('b-tricep-l', 'M20,46 L28,44 L27,70 L18,68 Z')}
            {paths('b-tricep-r', 'M72,44 L80,46 L82,68 L73,70 Z')}
            {/* Forearms back */}
            <path d="M18,68 L27,70 L25,92 L16,88 Z" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="0.5" opacity="0.6" />
            <path d="M73,70 L82,68 L84,88 L75,92 Z" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="0.5" opacity="0.6" />
            {/* Glutes */}
            {paths('b-glute-l', 'M28,82 L50,82 L48,102 L26,99 Z')}
            {paths('b-glute-r', 'M50,82 L72,82 L74,99 L52,102 Z')}
            {/* Hamstrings */}
            {paths('b-ham-l', 'M26,99 L48,102 L46,142 L24,138 Z')}
            {paths('b-ham-r', 'M52,102 L74,99 L76,138 L54,142 Z')}
            {/* Calves */}
            {paths('b-calf-l', 'M24,148 L44,152 L42,198 L22,194 Z')}
            {paths('b-calf-r', 'M56,152 L76,148 L78,194 L58,198 Z')}
            {/* Knee gaps */}
            <rect x="24" y="140" width="20" height="10" fill="#f9fafb" stroke="#d1d5db" strokeWidth="0.3" rx="2" />
            <rect x="56" y="140" width="20" height="10" fill="#f9fafb" stroke="#d1d5db" strokeWidth="0.3" rx="2" />
          </svg>
        </div>
      </div>

      {/* Legend */}
      {hasAny && (
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-gray-500">
          {primaryMuscles.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-fuchsia-500" />
              Primary: {primaryMuscles.join(', ')}
            </span>
          )}
          {secondaryMuscles.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-fuchsia-200" />
              Secondary: {secondaryMuscles.join(', ')}
            </span>
          )}
        </div>
      )}

      {!hasAny && (
        <p className="text-center text-xs text-gray-400 mt-2">No muscles tagged</p>
      )}
    </div>
  );
}
