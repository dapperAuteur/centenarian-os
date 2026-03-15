'use client';

import { useState, useEffect, useCallback } from 'react';

interface ImageAttachment {
  id: string;
  entity_type: string;
  entity_id: string;
  image_url: string;
  image_public_id: string | null;
  label: string | null;
  sort_order: number;
  created_at: string;
}

export function useImageAttachments(entityType: string, entityId: string | null) {
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!entityId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/image-attachments?entity_type=${entityType}&entity_id=${entityId}`,
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
    async (imageUrl: string, imagePublicId: string, label?: string) => {
      if (!entityId) return;
      const res = await fetch('/api/image-attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          image_url: imageUrl,
          image_public_id: imagePublicId,
          label,
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
    const res = await fetch(`/api/image-attachments?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  return { attachments, loading, addAttachment, removeAttachment, reload: load };
}
