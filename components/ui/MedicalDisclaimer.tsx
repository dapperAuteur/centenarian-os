'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'centos_medical_disclaimer_ack';

export default function MedicalDisclaimer() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // SSR-safe: only access localStorage in browser
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      role="note"
      className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3"
    >
      <AlertTriangle
        className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Medical Disclaimer</p>
        <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
          Before beginning any exercise program, consult with a qualified physician or
          healthcare provider. Content on this site is for informational purposes only
          and does not constitute medical advice.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss medical disclaimer"
        className="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-amber-500 hover:text-amber-700 transition rounded-lg"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
