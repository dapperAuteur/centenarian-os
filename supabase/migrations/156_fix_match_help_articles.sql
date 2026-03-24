-- 156_fix_match_help_articles.sql
-- Drops the old 3-parameter match_help_articles function to resolve ambiguity
-- with the 4-parameter version added in migration 130.
-- The 4-param version (with app_filter) remains as the sole signature.

BEGIN;

DROP FUNCTION IF EXISTS public.match_help_articles(vector(768), INT, TEXT);

COMMIT;
