'use client';

import { Trash2 } from 'lucide-react';

interface AudioAttachment {
  id: string;
  audio_url: string;
  label: string | null;
  duration_sec: number | null;
  created_at: string;
}

interface AudioAttachmentListProps {
  attachments: AudioAttachment[];
  onRemove?: (id: string) => void;
  variant?: 'light' | 'dark';
}

export default function AudioAttachmentList({
  attachments,
  onRemove,
  variant = 'light',
}: AudioAttachmentListProps) {
  if (attachments.length === 0) return null;

  const dark = variant === 'dark';

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div
          key={a.id}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            dark ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          <audio src={a.audio_url} controls className="h-9 flex-1 min-w-[180px]" />
          {a.label && (
            <span className={`text-xs shrink-0 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {a.label}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(a.id)}
              className={`flex items-center justify-center min-h-11 min-w-11 shrink-0 transition ${
                dark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'
              }`}
              aria-label="Remove audio attachment"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
