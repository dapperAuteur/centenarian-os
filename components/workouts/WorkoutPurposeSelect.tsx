'use client';

const PURPOSE_OPTIONS = [
  'Strength',
  'Hypertrophy',
  'Power',
  'Endurance',
  'Explosiveness',
  'Balance',
  'Recovery',
  'Mobility',
  'Conditioning',
];

interface Props {
  value: string[];
  onChange: (purposes: string[]) => void;
}

export default function WorkoutPurposeSelect({ value, onChange }: Props) {
  const toggle = (p: string) => {
    onChange(
      value.includes(p) ? value.filter((x) => x !== p) : [...value, p],
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5" id="purpose-label">Purpose</label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="purpose-label">
        {PURPOSE_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            aria-pressed={value.includes(p)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
              value.includes(p)
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export { PURPOSE_OPTIONS };
