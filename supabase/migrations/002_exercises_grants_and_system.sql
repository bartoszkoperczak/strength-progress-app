-- Fix table permissions + system exercises (big lifts) + seed for existing users

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_id_slug_idx
  ON exercises (user_id, slug)
  WHERE slug IS NOT NULL;

-- Table grants (required for Supabase API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON template_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_sets TO authenticated;

-- Idempotent seed of default compound lifts per user
CREATE OR REPLACE FUNCTION ensure_default_exercises()
RETURNS void AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO profiles (id, display_name)
  VALUES (uid, split_part((SELECT email FROM auth.users WHERE id = uid), '@', 1))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO exercises (user_id, name, category, movement_type, is_compound, is_system, slug)
  SELECT uid, v.name, v.category, v.movement_type, true, true, v.slug
  FROM (VALUES
    ('Bench Press',   'Push', 'barbell', 'bench_press'),
    ('Back Squat',    'Legs', 'barbell', 'back_squat'),
    ('Deadlift',      'Pull', 'barbell', 'deadlift'),
    ('Overhead Press','Push', 'barbell', 'overhead_press'),
    ('Barbell Row',   'Pull', 'barbell', 'barbell_row')
  ) AS v(name, category, movement_type, slug)
  WHERE NOT EXISTS (
    SELECT 1 FROM exercises e
    WHERE e.user_id = uid
      AND (e.slug = v.slug OR lower(e.name) = lower(v.name))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION ensure_default_exercises() TO authenticated;

-- Update signup trigger to mark system exercises
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO exercises (user_id, name, category, movement_type, is_compound, is_system, slug) VALUES
    (NEW.id, 'Bench Press',    'Push', 'barbell', true, true, 'bench_press'),
    (NEW.id, 'Back Squat',     'Legs', 'barbell', true, true, 'back_squat'),
    (NEW.id, 'Deadlift',       'Pull', 'barbell', true, true, 'deadlift'),
    (NEW.id, 'Overhead Press', 'Push', 'barbell', true, true, 'overhead_press'),
    (NEW.id, 'Barbell Row',    'Pull', 'barbell', true, true, 'barbell_row');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill slug + is_system for exercises created before this migration
UPDATE exercises SET slug = 'bench_press',    is_system = true WHERE lower(name) = 'bench press'    AND slug IS NULL;
UPDATE exercises SET slug = 'back_squat',     is_system = true WHERE lower(name) = 'back squat'     AND slug IS NULL;
UPDATE exercises SET slug = 'deadlift',       is_system = true WHERE lower(name) = 'deadlift'       AND slug IS NULL;
UPDATE exercises SET slug = 'overhead_press', is_system = true WHERE lower(name) = 'overhead press' AND slug IS NULL;
UPDATE exercises SET slug = 'barbell_row',    is_system = true WHERE lower(name) = 'barbell row'    AND slug IS NULL;

-- Prevent deleting system exercises
DROP POLICY IF EXISTS "Users can delete own exercises" ON exercises;
CREATE POLICY "Users can delete own exercises" ON exercises
  FOR DELETE USING (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "Users can update own exercises" ON exercises;
CREATE POLICY "Users can update own exercises" ON exercises
  FOR UPDATE USING (auth.uid() = user_id);
