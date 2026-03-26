-- 166_theme_preference.sql
-- Store user's preferred theme (light, dark, system).
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'
    CHECK (theme IN ('light', 'dark', 'system'));
