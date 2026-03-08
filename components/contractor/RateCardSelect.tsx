'use client';

import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';

interface Benefit {
  name: string;
  amount: number;
}

interface RateCard {
  id: string;
  name: string;
  union_local: string | null;
  department: string | null;
  rate_type: string;
  st_rate: number | null;
  ot_rate: number | null;
  dt_rate: number | null;
  benefits: Benefit[];
  travel_benefits: Record<string, number>;
}

interface RateCardSelectProps {
  onSelect: (card: RateCard) => void;
}

export default function RateCardSelect({ onSelect }: RateCardSelectProps) {
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/contractor/rate-cards')
      .then((r) => r.json())
      .then((d) => { setCards(d.rate_cards ?? []); setLoaded(true); });
  }, []);

  if (!loaded || cards.length === 0) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">
        <CreditCard size={14} className="inline mr-1" />
        Apply Rate Card
      </label>
      <select
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
        defaultValue=""
        onChange={(e) => {
          const card = cards.find((c) => c.id === e.target.value);
          if (card) {
            onSelect(card);
            // Increment use_count
            fetch(`/api/contractor/rate-cards/${card.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}), // triggers updated_at; use_count handled separately
            });
          }
        }}
      >
        <option value="" disabled>Select a rate card to pre-fill...</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.union_local ? ` (${c.union_local})` : ''}
            {c.st_rate ? ` — $${c.st_rate}/hr` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
