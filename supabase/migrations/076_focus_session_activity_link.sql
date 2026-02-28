-- 076_focus_session_activity_link.sql
-- Add 'focus_session' to activity_links CHECK constraints

ALTER TABLE activity_links DROP CONSTRAINT activity_links_source_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session'
  ));

ALTER TABLE activity_links DROP CONSTRAINT activity_links_target_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session'
  ));
