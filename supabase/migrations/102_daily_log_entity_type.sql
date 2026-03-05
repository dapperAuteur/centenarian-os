-- 102_daily_log_entity_type.sql
-- Add 'daily_log' to activity_links and entity_life_categories CHECK constraints.

ALTER TABLE activity_links DROP CONSTRAINT activity_links_source_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise','daily_log'
  ));

ALTER TABLE activity_links DROP CONSTRAINT activity_links_target_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise','daily_log'
  ));

ALTER TABLE entity_life_categories DROP CONSTRAINT entity_life_categories_entity_type_check;
ALTER TABLE entity_life_categories ADD CONSTRAINT entity_life_categories_entity_type_check
  CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise','daily_log'
  ));
