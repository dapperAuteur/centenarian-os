-- 067_session_file_data.sql
-- Add file_data column to language_coach_sessions for storing parsed CSV rows
-- used by import actions (e.g. IMPORT_TRANSACTIONS).

BEGIN;

ALTER TABLE language_coach_sessions
  ADD COLUMN file_data JSONB DEFAULT '[]';

COMMIT;
