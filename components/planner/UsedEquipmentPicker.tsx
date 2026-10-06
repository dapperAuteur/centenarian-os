'use client';

// "Used equipment" on a planner task (synced Google Calendar events are tasks
// too). Each pick is an activity link task <-> equipment; "for work" sets the
// link's relationship to 'work', which the equipment's Work use section counts
// as a work use (lib/equipment/depreciation-server.ts).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Wrench, X } from 'lucide-react';

interface Props {
  taskId: string;
}

interface Equipment {
  id: string;
  name: string;
}

interface EquipmentLink {
  id: string;
  linked_id: string;
  linked_display_name: string;
  relationship: string | null;
}

const isWork = (r: string | null) => (r ?? '').trim().toLowerCase() === 'work';

export default function UsedEquipmentPicker({ taskId }: Props) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [links, setLinks] = useState<EquipmentLink[]>([]);
  const [choice, setChoice] = useState('');
  const [forWork, setForWork] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const res = await fetch(`/api/activity-links?entity_type=task&entity_id=${taskId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as (EquipmentLink & { linked_type: string })[];
    setLinks(data.filter((l) => l.linked_type === 'equipment'));
  }, [taskId]);

  useEffect(() => {
    fetch('/api/equipment', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { equipment: [] }))
      .then((d) => setEquipment((d.equipment ?? []).map((e: Equipment) => ({ id: e.id, name: e.name }))))
      .catch(() => setEquipment([]));
    loadLinks();
  }, [loadLinks]);

  const addLink = async (equipmentId: string, work: boolean) => {
    const res = await fetch('/api/activity-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: 'task',
        source_id: taskId,
        target_type: 'equipment',
        target_id: equipmentId,
        relationship: work ? 'work' : 'used',
      }),
    });
    if (!res.ok && res.status !== 409) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Could not link equipment');
    }
  };

  const removeLink = async (linkId: string) => {
    const res = await fetch('/api/activity-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: linkId }),
    });
    if (!res.ok) throw new Error('Could not remove the link');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const linkedIds = new Set(links.map((l) => l.linked_id));
  const available = equipment.filter((e) => !linkedIds.has(e.id));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <Wrench className="w-4 h-4 text-gray-500" aria-hidden="true" /> Used equipment
      </h3>

      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-1 pl-3 rounded-full bg-gray-100 text-xs text-gray-700">
              <Link href={`/dashboard/equipment/${l.linked_id}`} className="hover:underline">{l.linked_display_name}</Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => { await removeLink(l.id); await addLink(l.linked_id, !isWork(l.relationship)); })}
                className={`min-h-11 px-2 flex items-center gap-1 ${isWork(l.relationship) ? 'text-sky-700 font-medium' : 'text-gray-500'}`}
                aria-label={isWork(l.relationship) ? `${l.linked_display_name}: work use. Switch to personal use` : `${l.linked_display_name}: personal use. Switch to work use`}
              >
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                {isWork(l.relationship) ? 'Work' : 'Personal'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => removeLink(l.id))}
                className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-red-600"
                aria-label={`Remove ${l.linked_display_name}`}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label htmlFor={`used-eq-${taskId}`} className="sr-only">Equipment used</label>
          <select
            id={`used-eq-${taskId}`}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="flex-1 min-h-11 border border-gray-300 rounded-lg px-3 text-sm"
          >
            <option value="">Choose equipment...</option>
            {available.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-11">
            <input type="checkbox" checked={forWork} onChange={(e) => setForWork(e.target.checked)} className="w-4 h-4" />
            for work
          </label>
          <button
            type="button"
            disabled={!choice || busy}
            onClick={() => run(async () => { await addLink(choice, forWork); setChoice(''); })}
            className="min-h-11 px-4 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : equipment.length === 0 ? (
        <p className="text-xs text-gray-500">No equipment yet. Add items under Equipment to track what each task uses.</p>
      ) : null}

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
