// lib/hooks/useSubscription.ts
// Fetches the current user's subscription status from profiles

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionStatus = 'free' | 'monthly' | 'lifetime';

interface SubscriptionState {
  status: SubscriptionStatus;
  shirtPromoCode: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  subscriptionExpiresAt: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useSubscription(): SubscriptionState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<Omit<SubscriptionState, 'refresh'>>({
    status: 'free',
    shirtPromoCode: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    subscriptionExpiresAt: null,
    loading: true,
  });
  const [refreshCount, setRefreshCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({ status: 'free', shirtPromoCode: null, cancelAtPeriodEnd: false, cancelAt: null, subscriptionExpiresAt: null, loading: false });
      return;
    }

    supabase
      .from('profiles')
      .select('subscription_status, shirt_promo_code, cancel_at_period_end, cancel_at, subscription_expires_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setState({ status: 'free', shirtPromoCode: null, cancelAtPeriodEnd: false, cancelAt: null, subscriptionExpiresAt: null, loading: false });
          return;
        }
        setState({
          status: (data.subscription_status as SubscriptionStatus) ?? 'free',
          shirtPromoCode: data.shirt_promo_code ?? null,
          cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
          cancelAt: data.cancel_at ?? null,
          subscriptionExpiresAt: data.subscription_expires_at ?? null,
          loading: false,
        });
      });
  }, [user, authLoading, supabase, refreshCount]);

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);

  return { ...state, refresh };
}
