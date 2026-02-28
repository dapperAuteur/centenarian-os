-- Migration 068: Persistent document storage for gem knowledge bases
-- Allows users to upload files that persist across chat sessions for a given gem.

CREATE TABLE IF NOT EXISTS public.gem_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gem_persona_id UUID NOT NULL REFERENCES public.gem_personas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gem_documents_gem ON public.gem_documents(gem_persona_id);
CREATE INDEX IF NOT EXISTS idx_gem_documents_user ON public.gem_documents(user_id);

ALTER TABLE public.gem_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY gem_documents_user_policy ON public.gem_documents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
