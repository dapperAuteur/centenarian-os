'use client';

// components/finance/debt/ReminderSettings.tsx
// Email reminders for card/loan due dates: off / 3 days before / 1 day before / both.
// Stored in debt_reminder_settings (migration 211); sent by the daily cron.

import { useId, useState } from 'react';
import type { ReminderSetting } from '@/lib/finance/debt/due';

const OPTIONS: { value: ReminderSetting; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '3_days', label: '3 days before' },
  { value: '1_day', label: '1 day before' },
  { value: 'both', label: 'Both' },
];

export default function ReminderSettings({ initial, ready }: { initial: ReminderSetting; ready: boolean }) {
  const id = useId();
  const [setting, setSetting] = useState<ReminderSetting>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (value: ReminderSetting) => {
    const previous = setting;
    setSetting(value);
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/finance/debt/reminders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting: value }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setSetting(previous);
      setMessage({ ok: false, text: body.error ?? 'Could not save the setting.' });
      return;
    }
    setMessage({ ok: true, text: value === 'off' ? 'Email reminders are off.' : 'Saved. Reminders go out with the daily check.' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-sm text-gray-700">
        The Due soon banner shows here and on the Finance page from 3 days before a payment is due until the day itself. You
        can also get an email.
      </p>
      {!ready ? (
        <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Email reminders need a database update. Run migration 211 first.
        </p>
      ) : (
        <fieldset disabled={saving}>
          <legend className="text-sm font-medium text-gray-700">Email me before a payment is due</legend>
          <div className="mt-1 flex flex-col sm:flex-row gap-2">
            {OPTIONS.map((o) => (
              <label key={o.value} className="min-h-11 flex items-center gap-2 px-3 rounded-lg border border-gray-200 text-sm cursor-pointer">
                <input type="radio" name={`${id}-reminder`} value={o.value} checked={setting === o.value} onChange={() => save(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
