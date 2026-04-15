-- 178_virtual_tours.sql
-- Virtual tour foundation: multi-scene immersive lessons with hotspots and
-- scene-to-scene links. Adds a new lesson_type 'virtual_tour' and three new
-- tables that together describe a tour:
--   - tour_scenes: one row per panorama in the tour. Each scene has a name,
--     a panorama URL, optional poster, and start orientation.
--   - tour_hotspots: clickable points placed inside a scene's spherical view.
--     Four types: info (text card), audio (play clip), link (external URL),
--     and scene_jump (transition to another scene).
--   - tour_scene_links: floor-arrow style links from one scene to another,
--     placed at a specific yaw/pitch in the source scene.
--
-- Plan 24 (transcripts for 360 video) will extend this. Plan 23b (scene
-- editor UI) ships in a follow-up branch. Plan 23c (hotspot visit tracking
-- for completion) ships with the editor.
--
-- Additive only. One existing constraint swap (lesson_type CHECK) — all
-- prior values remain valid.

BEGIN;

-- 1. Extend lesson_type CHECK
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_lesson_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text', 'audio', 'slides', 'quiz', '360video', 'photo_360', 'virtual_tour'));

-- 2. Scenes — one row per panorama in a tour
CREATE TABLE IF NOT EXISTS public.tour_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  caption TEXT,
  panorama_url TEXT NOT NULL,
  panorama_type TEXT NOT NULL DEFAULT 'photo' CHECK (panorama_type IN ('photo', 'video')),
  poster_url TEXT,
  start_yaw NUMERIC DEFAULT 0,
  start_pitch NUMERIC DEFAULT 0,
  is_entry_scene BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, slug)
);

CREATE INDEX IF NOT EXISTS tour_scenes_lesson_idx ON public.tour_scenes(lesson_id);

-- 3. Hotspots — clickable points inside a scene
CREATE TABLE IF NOT EXISTS public.tour_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES public.tour_scenes(id) ON DELETE CASCADE,
  hotspot_type TEXT NOT NULL CHECK (hotspot_type IN ('info', 'audio', 'link', 'scene_jump')),
  yaw NUMERIC NOT NULL,
  pitch NUMERIC NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  audio_url TEXT,
  external_url TEXT,
  target_scene_id UUID REFERENCES public.tour_scenes(id) ON DELETE SET NULL,
  icon TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tour_hotspots_scene_idx ON public.tour_hotspots(scene_id);

-- 4. Scene-to-scene links — floor arrows placed in a scene pointing at another scene
CREATE TABLE IF NOT EXISTS public.tour_scene_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_scene_id UUID NOT NULL REFERENCES public.tour_scenes(id) ON DELETE CASCADE,
  to_scene_id UUID NOT NULL REFERENCES public.tour_scenes(id) ON DELETE CASCADE,
  yaw NUMERIC NOT NULL,
  pitch NUMERIC NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (from_scene_id, to_scene_id)
);

CREATE INDEX IF NOT EXISTS tour_scene_links_from_idx ON public.tour_scene_links(from_scene_id);

-- 5. RLS — teachers can CRUD scenes/hotspots/links for lessons in courses they own.
--    Learners can read scenes/hotspots/links for courses they're enrolled in.
--    These policies join through lessons → courses → teacher_id / enrollments.
--    Service-role client bypasses RLS, so API routes that use service role (like
--    the tour GET/PUT endpoints) are the primary write path. RLS here exists as
--    a belt-and-suspenders layer for any direct DB access.
ALTER TABLE public.tour_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_scene_links ENABLE ROW LEVEL SECURITY;

-- Teachers see + write their own tour data
DROP POLICY IF EXISTS "Teachers manage own tour_scenes" ON public.tour_scenes;
CREATE POLICY "Teachers manage own tour_scenes" ON public.tour_scenes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = tour_scenes.lesson_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers manage own tour_hotspots" ON public.tour_hotspots;
CREATE POLICY "Teachers manage own tour_hotspots" ON public.tour_hotspots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tour_scenes s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.courses c ON c.id = l.course_id
      WHERE s.id = tour_hotspots.scene_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers manage own tour_scene_links" ON public.tour_scene_links;
CREATE POLICY "Teachers manage own tour_scene_links" ON public.tour_scene_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tour_scenes s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.courses c ON c.id = l.course_id
      WHERE s.id = tour_scene_links.from_scene_id AND c.teacher_id = auth.uid()
    )
  );

-- Learners read tour data for courses they're enrolled in
DROP POLICY IF EXISTS "Learners read enrolled tour_scenes" ON public.tour_scenes;
CREATE POLICY "Learners read enrolled tour_scenes" ON public.tour_scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.enrollments e ON e.course_id = l.course_id
      WHERE l.id = tour_scenes.lesson_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Learners read enrolled tour_hotspots" ON public.tour_hotspots;
CREATE POLICY "Learners read enrolled tour_hotspots" ON public.tour_hotspots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tour_scenes s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.enrollments e ON e.course_id = l.course_id
      WHERE s.id = tour_hotspots.scene_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Learners read enrolled tour_scene_links" ON public.tour_scene_links;
CREATE POLICY "Learners read enrolled tour_scene_links" ON public.tour_scene_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tour_scenes s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.enrollments e ON e.course_id = l.course_id
      WHERE s.id = tour_scene_links.from_scene_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

COMMIT;
