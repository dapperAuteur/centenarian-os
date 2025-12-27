// components/SessionTypeToggle.tsx
"use client"

import { useState } from 'react';

export default function SessionTypeToggle() {
  const [sessionType, setSessionType] = useState<'focus' | 'work'>('focus');
  
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setSessionType('focus')}
        className={sessionType === 'focus' ? 'bg-blue-600' : 'bg-gray-300'}
      >
        🎯 Focus Session
        <span className="text-xs">Quality + Goals</span>
      </button>
      <button
        onClick={() => setSessionType('work')}
        className={sessionType === 'work' ? 'bg-green-600' : 'bg-gray-300'}
      >
        💼 Work Session
        <span className="text-xs">Time + Revenue</span>
      </button>
    </div>
  );
}