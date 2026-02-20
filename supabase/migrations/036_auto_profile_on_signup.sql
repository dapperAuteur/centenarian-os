-- 036_auto_profile_on_signup.sql
-- Auto-create a profiles row whenever a new auth user is created.
-- Also backfills profile rows for any existing auth users who don't have one.
-- Users get a generated username (user_XXXXXXXX) they can update later.

BEGIN;

-- Function called by trigger on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  generated_username text;
  attempts           int := 0;
BEGIN
  -- Try up to 10 times to generate a unique username
  LOOP
    -- user_ + first 8 hex chars of a fresh UUID (matches ^[a-z0-9_-]{3,30}$)
    generated_username := 'user_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = generated_username
    ) OR attempts >= 10;
    attempts := attempts + 1;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, generated_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fire after every new row in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profile rows for existing auth users who don't have one yet
DO $$
DECLARE
  user_row record;
  gen_username text;
  attempts int;
BEGIN
  FOR user_row IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    attempts := 0;
    LOOP
      gen_username := 'user_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE username = gen_username
      ) OR attempts >= 10;
      attempts := attempts + 1;
    END LOOP;

    INSERT INTO public.profiles (id, username)
    VALUES (user_row.id, gen_username)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

COMMIT;
