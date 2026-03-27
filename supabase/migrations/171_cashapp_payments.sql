-- 171_cashapp_payments.sql
-- Track CashApp lifetime payment submissions and admin verification.

CREATE TABLE IF NOT EXISTS public.cashapp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  cashapp_name TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  admin_notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cashapp_payments ENABLE ROW LEVEL SECURITY;

-- Users can see their own payments
CREATE POLICY "Users can view own cashapp payments"
  ON public.cashapp_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can submit payments
CREATE POLICY "Users can submit cashapp payments"
  ON public.cashapp_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role handles admin updates (verify/reject)
