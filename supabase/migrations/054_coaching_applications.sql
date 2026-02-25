-- Coaching application submissions from /coaching landing page
CREATE TABLE coaching_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  priorities TEXT[] NOT NULL DEFAULT '{}',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'contacted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin access only — no RLS self-service
ALTER TABLE coaching_applications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no client-side access needed
