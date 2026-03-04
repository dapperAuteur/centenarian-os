-- supabase/migrations/090_invited_users.sql
-- Admin-controlled invite system. Invited users get temporary or lifetime access
-- without a Stripe subscription. Module-level access restrictions are supported.
-- No user-facing RLS — only readable/writable via service role (admin API routes).

CREATE TABLE invited_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  invited_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Access configuration
  access_type     TEXT        NOT NULL DEFAULT 'trial'
                              CHECK (access_type IN ('trial', 'lifetime')),
  expires_at      TIMESTAMPTZ,             -- NULL = no expiry
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Module restrictions: NULL = all paid modules; TEXT[] = specific hrefs only
  allowed_modules TEXT[],

  -- Demo data tracking
  demo_profile    TEXT        CHECK (demo_profile IN ('visitor', 'tutorial')),
  demo_seeded     BOOLEAN     NOT NULL DEFAULT FALSE,
  demo_seeded_at  TIMESTAMPTZ,

  -- Invite lifecycle
  invite_token    TEXT        UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role bypasses RLS, so no policies needed.
-- Leaving RLS disabled (default deny for anon/authenticated) is intentional.

CREATE INDEX invited_users_email_idx   ON invited_users (email);
CREATE INDEX invited_users_user_id_idx ON invited_users (user_id);
CREATE INDEX invited_users_active_idx  ON invited_users (is_active, expires_at);
