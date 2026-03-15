'use client';

import { useState, useEffect, useCallback } from 'react';

interface AudioAttachment {
  id: string;
  entity_type: string;
  entity_id: string;
  audio_url: string;
  audio_public_id: string | null;
  label: string | null;
  duration_sec: number | null;
  sort_order: number;
  created_at: string;
}

export function useAudioAttachments(entityType: string, entityId: string | null) {
  const [attachments, setAttachments] = useState<AudioAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!entityId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/audio-attachments?entity_type=${entityType}&entity_id=${entityId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const addAttachment = useCallback(
    async (audioUrl: string, audioPublicId: string, label?: string, durationSec?: number) => {
      if (!entityId) return;
      const res = await fetch('/api/audio-attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          audio_url: audioUrl,
          audio_public_id: audioPublicId,
          label,
          duration_sec: durationSec,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments((prev) => [...prev, data.attachment]);
      }
    },
    [entityType, entityId],
  );

  const removeAttachment = useCallback(async (id: string) => {
    const res = await fetch(`/api/audio-attachments?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  return { attachments, loading, addAttachment, removeAttachment, reload: load };
}
