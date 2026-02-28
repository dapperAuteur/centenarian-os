'use client';

// components/ui/ActivityLinker.tsx
// Reusable component for managing cross-module activity links.
// Embeddable in any module's edit/detail view.

import { useEffect, useState, useCallback } from 'react';
import { Link2, X, Plus, Search } from 'lucide-react';

type EntityType =
  | 'task' | 'trip' | 'route' | 'transaction' | 'recipe'
  | 'fuel_log' | 'maintenance' | 'invoice' | 'workout' | 'equipment';

interface ActivityLink {
  id: string;
  linked_type: EntityType;
  linked_id: string;
  linked_display_name: string;
  relationship: string | null;
}

interface SearchResult {
  id: string;
  display_name: string;
}

interface ActivityLinkerProps {
  entityType: EntityType;
  entityId: string;
}

const TYPE_LABELS: Record<EntityType, string> = {
  task: 'Task',
  trip: 'Trip',
  route: 'Route',
  transaction: 'Transaction',
  recipe: 'Recipe',
  fuel_log: 'Fuel Log',
  maintenance: 'Maintenance',
  invoice: 'Invoice',
  workout: 'Workout',
  equipment: 'Equipment',
};

const TYPE_COLORS: Record<EntityType, string> = {
  task: 'bg-violet-50 text-violet-700 border-violet-200',
  trip: 'bg-sky-50 text-sky-700 border-sky-200',
  route: 'bg-sky-50 text-sky-700 border-sky-200',
  transaction: 'bg-green-50 text-green-700 border-green-200',
  recipe: 'bg-amber-50 text-amber-700 border-amber-200',
  fuel_log: 'bg-orange-50 text-orange-700 border-orange-200',
  maintenance: 'bg-gray-50 text-gray-700 border-gray-200',
  invoice: 'bg-blue-50 text-blue-700 border-blue-200',
  workout: 'bg-rose-50 text-rose-700 border-rose-200',
  equipment: 'bg-teal-50 text-teal-700 border-teal-200',
};

// Linkable types (exclude the current entity type)
const LINKABLE_TYPES: EntityType[] = [
  'task', 'trip', 'route', 'transaction', 'recipe', 'workout', 'equipment',
];

export default function ActivityLinker({ entityType, entityId }: ActivityLinkerProps) {
  const [links, setLinks] = useState<ActivityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<EntityType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/activity-links?entity_type=${entityType}&entity_id=${entityId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleRemove = async (linkId: string) => {
    const res = await fetch('/api/activity-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: linkId }),
    });
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  };

  const handleSearch = async () => {
    if (!addType || !searchQuery.trim()) return;
    setSearching(true);
    try {
      // Search the appropriate module's API for matching items
      let results: SearchResult[] = [];
      const q = searchQuery.trim().toLowerCase();

      switch (addType) {
        case 'trip': {
          const res = await fetch('/api/travel/trips?limit=20');
          if (res.ok) {
            const d = await res.json();
            results = (d.trips || [])
              .filter((t: Record<string, string | null>) => {
                const search = `${t.origin || ''} ${t.destination || ''} ${t.mode || ''} ${t.date || ''}`.toLowerCase();
                return search.includes(q);
              })
              .map((t: Record<string, string | null>) => ({
                id: t.id,
                display_name: `${t.mode}: ${t.origin || '?'} → ${t.destination || '?'} (${t.date})`,
              }));
          }
          break;
        }
        case 'route': {
          const res = await fetch('/api/travel/routes?limit=20');
          if (res.ok) {
            const d = await res.json();
            results = (d.routes || [])
              .filter((r: Record<string, string | null>) => {
                const search = `${r.name || ''} ${r.date || ''}`.toLowerCase();
                return search.includes(q);
              })
              .map((r: Record<string, string | null | number>) => ({
                id: r.id,
                display_name: `${r.name || 'Route'} (${r.date})`,
              }));
          }
          break;
        }
        case 'transaction': {
          const res = await fetch('/api/finance/transactions?limit=20');
          if (res.ok) {
            const d = await res.json();
            const txs = d.transactions || d || [];
            results = (Array.isArray(txs) ? txs : [])
              .filter((t: Record<string, string | null>) => {
                const search = `${t.vendor || ''} ${t.description || ''} ${t.transaction_date || ''}`.toLowerCase();
                return search.includes(q);
              })
              .slice(0, 10)
              .map((t: Record<string, string | number | null>) => ({
                id: String(t.id),
                display_name: `${t.vendor || 'Transaction'} $${Number(t.amount || 0).toFixed(2)} (${t.transaction_date})`,
              }));
          }
          break;
        }
        case 'recipe': {
          const res = await fetch(`/api/recipes?search=${encodeURIComponent(q)}&limit=10`);
          if (res.ok) {
            const d = await res.json();
            const recipes = d.recipes || d || [];
            results = (Array.isArray(recipes) ? recipes : [])
              .map((r: Record<string, string>) => ({
                id: r.id,
                display_name: r.title || 'Recipe',
              }));
          }
          break;
        }
        case 'equipment': {
          const res = await fetch('/api/equipment');
          if (res.ok) {
            const d = await res.json();
            results = (d.equipment || [])
              .filter((e: Record<string, unknown>) => {
                const search = `${e.name || ''} ${e.brand || ''} ${e.model || ''}`.toLowerCase();
                return search.includes(q);
              })
              .slice(0, 10)
              .map((e: Record<string, unknown>) => {
                const cat = e.equipment_categories as { name: string } | null;
                return {
                  id: String(e.id),
                  display_name: cat ? `${e.name} (${cat.name})` : String(e.name),
                };
              });
          }
          break;
        }
        case 'task': {
          // Tasks are queried via supabase client on the planner, not a dedicated API
          // Show a simplified message
          results = [];
          break;
        }
        default:
          break;
      }

      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (targetId: string) => {
    if (!addType) return;
    const res = await fetch('/api/activity-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: entityType,
        source_id: entityId,
        target_type: addType,
        target_id: targetId,
      }),
    });
    if (res.ok) {
      setShowAdd(false);
      setAddType('');
      setSearchQuery('');
      setSearchResults([]);
      loadLinks();
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-gray-400 py-2">Loading links...</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          Linked Activities
        </h4>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Link
        </button>
      </div>

      {/* Existing links */}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link) => (
            <span
              key={link.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${TYPE_COLORS[link.linked_type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
            >
              <span className="font-medium">{TYPE_LABELS[link.linked_type]}:</span>
              <span className="truncate max-w-48">{link.linked_display_name}</span>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                className="ml-0.5 opacity-60 hover:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No linked activities yet.</p>
      )}

      {/* Add link UI */}
      {showAdd && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
          <div className="flex gap-2">
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value as EntityType);
                setSearchResults([]);
                setSearchQuery('');
              }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-shrink-0"
            >
              <option value="">Select type...</option>
              {LINKABLE_TYPES
                .filter((t) => t !== entityType)
                .map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))
              }
            </select>
            {addType && (
              <div className="flex-1 flex gap-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                  placeholder={`Search ${TYPE_LABELS[addType as EntityType] || ''}...`}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-2 py-1.5 bg-sky-600 text-white rounded-lg text-xs hover:bg-sky-700 transition disabled:opacity-50"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleAdd(r.id)}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-sky-50 rounded transition truncate"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-gray-400">Searching...</p>}

          <button
            type="button"
            onClick={() => { setShowAdd(false); setAddType(''); setSearchQuery(''); setSearchResults([]); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
