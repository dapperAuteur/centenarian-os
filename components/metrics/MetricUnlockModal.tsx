'use client';

import { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface MetricUnlockModalProps {
  metricKey: string;
  metricLabel: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function MetricUnlockModal({
  metricKey,
  metricLabel,
  onSuccess,
  onClose,
}: MetricUnlockModalProps) {
  const [checkedDoctor, setCheckedDoctor] = useState(false);
  const [checkedRisk, setCheckedRisk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUnlock = checkedDoctor && checkedRisk;

  const handleUnlock = async () => {
    if (!canUnlock) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health-metrics/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricKey, acknowledged: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to unlock');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Unlock {metricLabel} Tracking
              </h2>
              <p className="text-sm text-gray-500">Read and acknowledge before continuing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
            <p className="font-semibold mb-2">Health Disclaimer</p>
            <p>
              {metricLabel} is one data point among many. CentenarianOS, B4C LLC,
              AwesomeWebStore.com, and Anthony McDonald are <strong>not medical providers</strong>.
              This tracking tool is for personal education only.
            </p>
            <p className="mt-2">
              Always consult a qualified healthcare provider before using this data to make
              decisions about your diet, exercise, medications, or any other aspect of your health.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
              checked={checkedDoctor}
              onChange={(e) => setCheckedDoctor(e.target.checked)}
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition">
              I have consulted, or will consult, my doctor before using this metric
              to make any health decisions.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
              checked={checkedRisk}
              onChange={(e) => setCheckedRisk(e.target.checked)}
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition">
              I understand CentenarianOS is a self-tracking education tool and I use it
              entirely at my own risk.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!canUnlock || loading}
            className="px-5 py-2 text-sm font-semibold bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Unlocking…' : `Unlock ${metricLabel} Tracking`}
          </button>
        </div>
      </div>
    </div>
  );
}
