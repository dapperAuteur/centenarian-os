// File: lib/hooks/useServingsThreshold.ts
// Manages low servings threshold with profile + localStorage cache

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'centos_low_servings_threshold';
const DEFAULT_THRESHOLD = 3;

export function useServingsThreshold() {
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadThreshold = async () => {
      // Try localStorage first
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setThreshold(parseInt(cached, 10));
      }

      // Fetch from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('low_servings_threshold')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const dbThreshold = profile.low_servings_threshold || DEFAULT_THRESHOLD;
        setThreshold(dbThreshold);
        localStorage.setItem(STORAGE_KEY, dbThreshold.toString());
      } else {
        // Create default profile
        await supabase
          .from('user_profiles')
          .insert({ 
            user_id: user.id, 
            low_servings_threshold: DEFAULT_THRESHOLD 
          });
        localStorage.setItem(STORAGE_KEY, DEFAULT_THRESHOLD.toString());
      }

      setLoading(false);
    };

    loadThreshold();
  }, [supabase]);

  const updateThreshold = async (newThreshold: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update profile
    await supabase
      .from('user_profiles')
      .update({ low_servings_threshold: newThreshold })
      .eq('user_id', user.id);

    // Update cache
    localStorage.setItem(STORAGE_KEY, newThreshold.toString());
    setThreshold(newThreshold);
  };

  return { threshold, updateThreshold, loading };
}