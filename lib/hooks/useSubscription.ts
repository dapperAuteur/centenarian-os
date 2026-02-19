// lib/hooks/useSubscription.ts
// Fetches the current user's subscription status from profiles

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export type SubscriptionStatus = 'free' | 'monthly' | 'lifetime';

interface SubscriptionState {
  status: SubscriptionStatus;
  shirtPromoCode: string | null;
  loading: boolean;
}

export function useSubscription(): SubscriptionState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    status: 'free',
    shirtPromoCode: null,
    loading: true,
  });
  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({ status: 'free', shirtPromoCode: null, loading: false });
      return;
    }

    supabase
      .from('profiles')
      .select('subscription_status, shirt_promo_code')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setState({ status: 'free', shirtPromoCode: null, loading: false });
          return;
        }
        setState({
          status: (data.subscription_status as SubscriptionStatus) ?? 'free',
          shirtPromoCode: data.shirt_promo_code ?? null,
          loading: false,
        });
      });
  }, [user, authLoading, supabase]);

  return state;
}
