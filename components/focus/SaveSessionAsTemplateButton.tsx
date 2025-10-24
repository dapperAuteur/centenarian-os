/* eslint-disable @typescript-eslint/no-unused-vars */
// components/focus/SaveSessionAsTemplateButton.tsx
'use client';

import { Save } from 'lucide-react';

interface SaveSessionAsTemplateButtonProps {
  sessionData: {
    duration: number; // seconds
    hourlyRate: number;
    notes: string;
    tags?: string[];
    usePomodoro: boolean;
  };
  onSave: () => void;
}

/**
 * Quick button to save current session configuration as a template
 */
export default function SaveSessionAsTemplateButton({
  sessionData,
  onSave,
}: SaveSessionAsTemplateButtonProps) {
  return (
    <button
      onClick={onSave}
      className="flex items-center space-x-2 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
      title="Save as template"
    >
      <Save className="w-4 h-4" />
      <span>Save as Template</span>
    </button>
  );
}