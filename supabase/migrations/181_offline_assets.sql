-- 181_offline_assets.sql
-- Server-side ledger of offline-cached media. Stores "what each user
-- claims to have cached locally" — the bytes live in the browser's
-- IndexedDB, this table tracks only the metadata.
--
-- Powers:
--   - Storage usage summaries ("you have 340 MB cached across 3 courses")
--   - Enrollment-revocation purge (when access is revoked, the client
--     reads its ledger rows for that course and deletes the corresponding
--     IndexedDB blobs)
--   - Cleanup of orphaned ledger rows when a teacher updates a lesson's
--     content_url (a periodic job can find rows pointing at URLs no
--     longer referenced by any lesson and purge them)
--
-- Plan 25a (this migration) + client-side blob store + single-asset
-- save-for-offline. Plan 25b adds Service Worker shell caching,
-- full-course save, and the storage-management UI.

BEGIN;

CREATE TABLE IF NOT EXISTS public.offline_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('panorama_video', 'panorama_image', 'poster', 'audio', 'video', 'image', 'other')),
  size_bytes BIGINT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (user_id, asset_url)
);

CREATE INDEX IF NOT EXISTS offline_assets_user_idx ON public.offline_assets(user_id);
CREATE INDEX IF NOT EXISTS offline_assets_course_idx ON public.offline_assets(course_id);
CREATE INDEX IF NOT EXISTS offline_assets_lesson_idx ON public.offline_assets(lesson_id);

ALTER TABLE public.offline_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own offline_assets" ON public.offline_assets;
CREATE POLICY "Users manage own offline_assets" ON public.offline_assets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
