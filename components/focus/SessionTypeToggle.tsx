// components/focus/SessionTypeToggle.tsx
'use client';

import { Zap, Briefcase } from 'lucide-react';

type SessionType = 'focus' | 'work';

interface SessionTypeToggleProps {
  value: SessionType;
  onChange: (type: SessionType) => void;
}

export default function SessionTypeToggle({ value, onChange }: SessionTypeToggleProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Session Type
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange('focus')}
          className={`p-4 rounded-lg border-2 transition ${
            value === 'focus'
              ? 'bg-indigo-50 border-indigo-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-2">
            <Zap className={`w-5 h-5 ${value === 'focus' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <span className={`font-bold ${value === 'focus' ? 'text-indigo-900' : 'text-gray-700'}`}>
              Focus Session
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Deep work • Quality ratings • Goal tracking
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange('work')}
          className={`p-4 rounded-lg border-2 transition ${
            value === 'work'
              ? 'bg-green-50 border-green-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2 mb-2">
            <Briefcase className={`w-5 h-5 ${value === 'work' ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={`font-bold ${value === 'work' ? 'text-green-900' : 'text-gray-700'}`}>
              Work Session
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Time tracking • Revenue only • No quality ratings
          </p>
        </button>
      </div>
    </div>
  );
}