'use client';

import { useState, useEffect } from 'react';
import { DollarSign, MapPin, Dumbbell, Heart, FileText, Check, ChevronDown, Clock, Package, Fuel, Wrench } from 'lucide-react';
import { Task } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

interface TaskCompletionActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

type ActionType = 'transaction' | 'trip' | 'workout' | 'health' | 'invoice' | 'focus' | 'equipment' | 'fuel' | 'maintenance';

interface ActionConfig {
  type: ActionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const ACTIONS: ActionConfig[] = [
  {
    type: 'transaction',
    label: 'Log Transaction',
    description: 'Record an expense or income',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  {
    type: 'trip',
    label: 'Log Trip',
    description: 'Record travel or commute',
    icon: <MapPin className="w-5 h-5" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    type: 'workout',
    label: 'Log Workout',
    description: 'Record exercise session',
    icon: <Dumbbell className="w-5 h-5" />,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
  {
    type: 'health',
    label: 'Log Health Metrics',
    description: 'Record steps, sleep, heart rate',
    icon: <Heart className="w-5 h-5" />,
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  {
    type: 'invoice',
    label: 'Create Invoice',
    description: 'Generate a receivable or payable',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    type: 'focus',
    label: 'Log Focus Time',
    description: 'Record a focus or work session',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  {
    type: 'equipment',
    label: 'Link Equipment',
    description: 'Associate gear used for this task',
    icon: <Package className="w-5 h-5" />,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
  },
  {
    type: 'fuel',
    label: 'Log Fuel Fill-up',
    description: 'Record a fuel stop',
    icon: <Fuel className="w-5 h-5" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    type: 'maintenance',
    label: 'Log Maintenance',
    description: 'Record a vehicle service',
    icon: <Wrench className="w-5 h-5" />,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
];

async function createActivityLink(taskId: string, targetType: string, targetId: string) {
  await fetch('/api/activity-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_type: 'task',
      source_id: taskId,
      target_type: targetType,
      target_id: targetId,
    }),
  });
}

// --- Individual action forms ---

function TransactionForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [amount, setAmount] = useState(task.actual_cost > 0 ? String(task.actual_cost) : '');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [vendor, setVendor] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          type,
          description: task.activity,
          vendor: vendor || null,
          transaction_date: task.date,
          source: 'task',
          source_module: 'task',
          source_module_id: task.id,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'transaction', data.id);
      onDone();
    } catch (err) {
      console.error('Transaction creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['expense', 'income'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${
              type === t
                ? t === 'expense' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <input
        type="text"
        value={vendor}
        onChange={e => setVendor(e.target.value)}
        placeholder="Vendor (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving || !amount || Number(amount) <= 0}
        className="w-full px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

function TripForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [mode, setMode] = useState('car');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [saving, setSaving] = useState(false);

  const modes = ['car', 'bike', 'walk', 'bus', 'train', 'plane', 'rideshare', 'other'];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/travel/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          date: task.date,
          origin: origin || null,
          destination: destination || null,
          purpose: task.activity,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'trip', data.id);
      onDone();
    } catch (err) {
      console.error('Trip creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <select
        value={mode}
        onChange={e => setMode(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      >
        {modes.map(m => (
          <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
        ))}
      </select>
      <input
        type="text"
        value={origin}
        onChange={e => setOrigin(e.target.value)}
        placeholder="Origin"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <input
        type="text"
        value={destination}
        onChange={e => setDestination(e.target.value)}
        placeholder="Destination"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

function WorkoutForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [name, setName] = useState(task.activity);
  const [durationMin, setDurationMin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workouts/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date: task.date,
          duration_min: durationMin ? Number(durationMin) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'workout', data.id);
      onDone();
    } catch (err) {
      console.error('Workout creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Workout name"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <input
        type="number"
        value={durationMin}
        onChange={e => setDurationMin(e.target.value)}
        placeholder="Duration (minutes)"
        min="0"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full px-3 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

function HealthForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [steps, setSteps] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [activityMin, setActivityMin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { logged_date: task.date };
      if (steps) body.steps = Number(steps);
      if (sleepHours) body.sleep_hours = Number(sleepHours);
      if (restingHr) body.resting_hr = Number(restingHr);
      if (activityMin) body.activity_min = Number(activityMin);

      const res = await fetch('/api/health-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      onDone();
    } catch (err) {
      console.error('Health metrics save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          value={steps}
          onChange={e => setSteps(e.target.value)}
          placeholder="Steps"
          min="0"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        <input
          type="number"
          value={sleepHours}
          onChange={e => setSleepHours(e.target.value)}
          placeholder="Sleep (hrs)"
          min="0"
          step="0.5"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        <input
          type="number"
          value={restingHr}
          onChange={e => setRestingHr(e.target.value)}
          placeholder="Resting HR"
          min="0"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        <input
          type="number"
          value={activityMin}
          onChange={e => setActivityMin(e.target.value)}
          placeholder="Activity (min)"
          min="0"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving || (!steps && !sleepHours && !restingHr && !activityMin)}
        className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

function InvoiceForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [direction, setDirection] = useState<'receivable' | 'payable'>('receivable');
  const [contactName, setContactName] = useState('');
  const [itemDesc, setItemDesc] = useState(task.activity);
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!contactName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          contact_name: contactName.trim(),
          items: [{
            description: itemDesc.trim() || task.activity,
            quantity: 1,
            unit_price: unitPrice ? Number(unitPrice) : 0,
          }],
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'invoice', data.id);
      onDone();
    } catch (err) {
      console.error('Invoice creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['receivable', 'payable'] as const).map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${
              direction === d
                ? d === 'receivable' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={contactName}
        onChange={e => setContactName(e.target.value)}
        placeholder="Contact name *"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <input
        type="text"
        value={itemDesc}
        onChange={e => setItemDesc(e.target.value)}
        placeholder="Item description"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        value={unitPrice}
        onChange={e => setUnitPrice(e.target.value)}
        placeholder="Amount"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving || !contactName.trim()}
        className="w-full px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

const FOCUS_TAGS = ['deep-work', 'meeting', 'admin', 'learning', 'creative', 'coding', 'planning', 'review'];

function FocusForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [durationMin, setDurationMin] = useState('');
  const [sessionType, setSessionType] = useState<'focus' | 'work'>('focus');
  const [hourlyRate, setHourlyRate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [equipmentItems, setEquipmentItems] = useState<{ id: string; name: string; category: string }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/equipment').then(r => r.ok ? r.json() : { equipment: [] }).then(d => {
      setEquipmentItems((d.equipment || []).map((e: Record<string, unknown>) => {
        const cat = e.equipment_categories as { name: string } | null;
        return { id: String(e.id), name: String(e.name), category: cat?.name || '' };
      }));
    });
  }, []);

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleEquipment = (id: string) => {
    setSelectedEquipment(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!durationMin || Number(durationMin) <= 0) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dur = Number(durationMin) * 60;
      const now = new Date();
      const start = new Date(now.getTime() - dur * 1000);
      const rate = hourlyRate ? Number(hourlyRate) : 0;
      const revenue = rate > 0 ? rate * (dur / 3600) : 0;

      const { data: session, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: user.id,
          task_id: task.id,
          start_time: start.toISOString(),
          end_time: now.toISOString(),
          duration: dur,
          net_work_duration: dur,
          session_type: sessionType,
          hourly_rate: rate,
          revenue: Math.round(revenue * 100) / 100,
          tags: tags.length > 0 ? tags : null,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      await createActivityLink(task.id, 'focus_session', session.id);

      // Link selected equipment to the focus session
      for (const equipId of selectedEquipment) {
        await fetch('/api/activity-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_type: 'focus_session',
            source_id: session.id,
            target_type: 'equipment',
            target_id: equipId,
          }),
        });
      }

      onDone();
    } catch (err) {
      console.error('Focus session creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['focus', 'work'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSessionType(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${
              sessionType === t
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="number"
        min="1"
        value={durationMin}
        onChange={e => setDurationMin(e.target.value)}
        placeholder="Duration (minutes) *"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        value={hourlyRate}
        onChange={e => setHourlyRate(e.target.value)}
        placeholder="Hourly rate (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 rounded-md text-xs border transition ${
                tags.includes(tag)
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      {equipmentItems.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Equipment used</label>
          <div className="max-h-28 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
            {equipmentItems.map(item => (
              <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1">
                <input
                  type="checkbox"
                  checked={selectedEquipment.has(item.id)}
                  onChange={() => toggleEquipment(item.id)}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span>{item.name}</span>
                {item.category && <span className="text-gray-400">({item.category})</span>}
              </label>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !durationMin || Number(durationMin) <= 0}
        className="w-full px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

function EquipmentForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string; category: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/equipment').then(r => r.ok ? r.json() : { equipment: [] }).then(d => {
      setItems((d.equipment || []).map((e: Record<string, unknown>) => {
        const cat = e.equipment_categories as { name: string } | null;
        return { id: String(e.id), name: String(e.name), category: cat?.name || '' };
      }));
      setLoading(false);
    });
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      for (const equipId of selected) {
        await createActivityLink(task.id, 'equipment', equipId);
      }
      onDone();
    } catch (err) {
      console.error('Equipment linking failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-xs text-gray-400 py-2">Loading equipment...</p>;
  if (items.length === 0) return <p className="text-xs text-gray-500 py-2">No equipment items found. Add some in the Equipment tracker first.</p>;

  return (
    <div className="space-y-3">
      <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
        {items.map(item => (
          <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1.5">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span>{item.name}</span>
            {item.category && <span className="text-xs text-gray-400">({item.category})</span>}
          </label>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || selected.size === 0}
        className="w-full px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
      >
        {saving ? 'Linking...' : `Link ${selected.size} Item${selected.size !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

function FuelForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [vehicles, setVehicles] = useState<{ id: string; nickname: string }[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [gallons, setGallons] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/travel/vehicles').then(r => r.ok ? r.json() : { vehicles: [] }).then(d => {
      const v = (d.vehicles || []).map((v: Record<string, string>) => ({ id: v.id, nickname: v.nickname || v.make || 'Vehicle' }));
      setVehicles(v);
      if (v.length === 1) setVehicleId(v[0].id);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/travel/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: task.date,
          vehicle_id: vehicleId || null,
          gallons: gallons ? Number(gallons) : null,
          total_cost: totalCost ? Number(totalCost) : null,
          station: station.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'fuel_log', data.id);
      onDone();
    } catch (err) {
      console.error('Fuel log creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {vehicles.length > 0 && (
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select vehicle...</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.nickname}</option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          step="0.001"
          min="0"
          value={gallons}
          onChange={e => setGallons(e.target.value)}
          placeholder="Gallons"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={totalCost}
          onChange={e => setTotalCost(e.target.value)}
          placeholder="Total cost"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <input
        type="text"
        value={station}
        onChange={e => setStation(e.target.value)}
        placeholder="Station (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

const SERVICE_TYPES = [
  'oil_change', 'tire_rotation', 'tire_replacement', 'brake_service',
  'battery', 'transmission', 'coolant', 'filter', 'inspection',
  'alignment', 'detailing', 'other',
];

function MaintenanceForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [vehicles, setVehicles] = useState<{ id: string; nickname: string }[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/travel/vehicles').then(r => r.ok ? r.json() : { vehicles: [] }).then(d => {
      const v = (d.vehicles || []).map((v: Record<string, string>) => ({ id: v.id, nickname: v.nickname || v.make || 'Vehicle' }));
      setVehicles(v);
      if (v.length === 1) setVehicleId(v[0].id);
    });
  }, []);

  const handleSave = async () => {
    if (!serviceType) return;
    setSaving(true);
    try {
      const res = await fetch('/api/travel/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: task.date,
          vehicle_id: vehicleId || null,
          service_type: serviceType,
          cost: cost ? Number(cost) : null,
          vendor: vendor.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      await createActivityLink(task.id, 'maintenance', data.id);
      onDone();
    } catch (err) {
      console.error('Maintenance record creation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <select
        value={serviceType}
        onChange={e => setServiceType(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      >
        <option value="">Select service type *</option>
        {SERVICE_TYPES.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
        ))}
      </select>
      {vehicles.length > 0 && (
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="">Select vehicle...</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.nickname}</option>
          ))}
        </select>
      )}
      <input
        type="number"
        step="0.01"
        min="0"
        value={cost}
        onChange={e => setCost(e.target.value)}
        placeholder="Cost (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      />
      <input
        type="text"
        value={vendor}
        onChange={e => setVendor(e.target.value)}
        placeholder="Vendor / shop (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      />
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving || !serviceType}
        className="w-full px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving...' : 'Save & Link'}
      </button>
    </div>
  );
}

// --- Main modal ---

export default function TaskCompletionActionsModal({ isOpen, onClose, task }: TaskCompletionActionsModalProps) {
  const [expandedAction, setExpandedAction] = useState<ActionType | null>(null);
  const [completed, setCompleted] = useState<Set<ActionType>>(new Set());

  if (!task) return null;

  const handleDone = (type: ActionType) => {
    setCompleted(prev => new Set(prev).add(type));
    setExpandedAction(null);
  };

  const renderForm = (type: ActionType) => {
    switch (type) {
      case 'transaction': return <TransactionForm task={task} onDone={() => handleDone('transaction')} />;
      case 'trip': return <TripForm task={task} onDone={() => handleDone('trip')} />;
      case 'workout': return <WorkoutForm task={task} onDone={() => handleDone('workout')} />;
      case 'health': return <HealthForm task={task} onDone={() => handleDone('health')} />;
      case 'invoice': return <InvoiceForm task={task} onDone={() => handleDone('invoice')} />;
      case 'focus': return <FocusForm task={task} onDone={() => handleDone('focus')} />;
      case 'equipment': return <EquipmentForm task={task} onDone={() => handleDone('equipment')} />;
      case 'fuel': return <FuelForm task={task} onDone={() => handleDone('fuel')} />;
      case 'maintenance': return <MaintenanceForm task={task} onDone={() => handleDone('maintenance')} />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Completed!" size="md">
      <div className="p-6">
        <p className="text-gray-600 mb-6">
          <span className="font-medium text-gray-900">{task.activity}</span> — would you like to log related data?
        </p>

        <div className="space-y-3">
          {ACTIONS.map(action => {
            const isCompleted = completed.has(action.type);
            const isExpanded = expandedAction === action.type;

            return (
              <div key={action.type} className={`border rounded-lg overflow-hidden transition ${action.color}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) return;
                    setExpandedAction(isExpanded ? null : action.type);
                  }}
                  className={`w-full flex items-center justify-between p-3 text-left ${isCompleted ? 'opacity-60' : 'hover:opacity-80'}`}
                  disabled={isCompleted}
                >
                  <div className="flex items-center gap-3">
                    {isCompleted ? <Check className="w-5 h-5 text-green-600" /> : action.icon}
                    <div>
                      <div className="font-medium text-sm">{action.label}</div>
                      <div className="text-xs opacity-75">{isCompleted ? 'Saved' : action.description}</div>
                    </div>
                  </div>
                  {!isCompleted && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 bg-white border-t border-gray-100">
                    <div className="pt-3">
                      {renderForm(action.type)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
