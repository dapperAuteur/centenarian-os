'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Route, Trash2, Pencil, Copy } from 'lucide-react';

interface RouteLeg {
  id: string;
  mode: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  co2_kg: number | null;
  leg_order: number;
}

interface RouteData {
  id: string;
  name: string | null;
  date: string;
  total_distance: number | null;
  total_duration: number | null;
  total_cost: number | null;
  total_co2_kg: number | null;
  is_round_trip: boolean;
  leg_count: number;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface RouteCardProps {
  route: RouteData;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onExpand?: (id: string) => Promise<RouteLeg[]>;
}

export default function RouteCard({ route, onDelete, onEdit, onDuplicate, onExpand }: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (legs.length === 0 && onExpand) {
      setLoading(true);
      try {
        const data = await onExpand(route.id);
        setLegs(data);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <Route className="w-4 h-4 text-sky-500 shrink-0" />
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {route.name || 'Multi-stop route'}
            </span>
            {route.is_round_trip && (
              <span className="text-xs bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                RT
              </span>
            )}
            <span className="text-xs text-gray-400 shrink-0">{route.leg_count} legs</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span>{route.date}</span>
            {route.total_distance != null && <span>{fmt(route.total_distance)} mi</span>}
            {route.total_duration != null && <span>{route.total_duration} min</span>}
            {route.total_cost != null && route.total_cost > 0 && (
              <span className="text-green-600">${fmt(route.total_cost, 2)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(route.id); }}
              className="text-gray-400 hover:text-sky-600 transition p-1"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDuplicate(route.id); }}
              className="text-gray-400 hover:text-sky-600 transition p-1"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(route.id); }}
              className="text-red-400 hover:text-red-600 transition p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </button>

      {/* Expanded legs */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2 space-y-1">
          {loading ? (
            <p className="text-xs text-gray-400 py-2 text-center">Loading legs...</p>
          ) : legs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">No legs found.</p>
          ) : (
            legs.map((leg, i) => (
              <div key={leg.id} className="flex items-center gap-2 text-xs py-1">
                <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                <span>{MODE_ICONS[leg.mode] ?? '🚐'}</span>
                <span className="text-gray-700 truncate flex-1">
                  {leg.origin || '?'} → {leg.destination || '?'}
                </span>
                <span className="text-gray-500 tabular-nums">{fmt(leg.distance_miles)} mi</span>
                {leg.cost != null && leg.cost > 0 && (
                  <span className="text-green-600 tabular-nums">${fmt(leg.cost, 2)}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
