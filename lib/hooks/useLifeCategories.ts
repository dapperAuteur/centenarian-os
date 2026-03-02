'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

export interface LifeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export function useLifeCategories() {
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await offlineFetch('/api/life-categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { categories, loading, refetch: load };
}
