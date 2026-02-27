'use client';

import { useState } from 'react';
import { DollarSign, MapPin, Dumbbell, Heart, FileText, Check, ChevronDown } from 'lucide-react';
import { Task } from '@/lib/types';
import Modal from '@/components/ui/Modal';

interface TaskCompletionActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
}

type ActionType = 'transaction' | 'trip' | 'workout' | 'health' | 'invoice';

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
