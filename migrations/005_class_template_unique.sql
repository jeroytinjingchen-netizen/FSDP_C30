-- migrations/005_class_template_unique.sql
-- A class template is unique per centre, name and weekday, so the seed can upsert it safely.
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_templates_centre_name_weekday
  ON class_templates (centre_id, name, weekday);
