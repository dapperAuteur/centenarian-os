-- 023_profiles.sql
-- User profiles with unique username for /blog/[username] routing

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT  NOT NULL UNIQUE
                  CHECK (username ~ '^[a-z0-9_-]{3,30}$'),
  display_name  TEXT  CHECK (char_length(display_name) <= 60),
  bio           TEXT  CHECK (char_length(bio) <= 300),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile"
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
