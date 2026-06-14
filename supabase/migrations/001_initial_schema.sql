-- Strength Progress Tracker - Initial Schema

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercises
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other' CHECK (category IN ('Push', 'Pull', 'Legs', 'Core', 'Other')),
  movement_type TEXT NOT NULL DEFAULT 'barbell' CHECK (movement_type IN ('barbell', 'dumbbell', 'machine', 'bodyweight', 'cable')),
  is_compound BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX exercises_user_id_lower_name_idx ON exercises (user_id, lower(name));

-- Templates
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Template exercises
CREATE TABLE template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0,
  target_sets INT NOT NULL DEFAULT 3,
  target_reps INT NOT NULL DEFAULT 8,
  notes TEXT,
  UNIQUE (template_id, exercise_id)
);

-- Workouts
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled'))
);

-- Workout sets
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  set_number INT NOT NULL,
  weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  rir INT NOT NULL DEFAULT 2 CHECK (rir >= 0 AND rir <= 10),
  is_warmup BOOLEAN NOT NULL DEFAULT false,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workout_id, exercise_id, set_number)
);

-- Indexes
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_workouts_user_completed ON workouts(user_id, completed_at DESC);
CREATE INDEX idx_workouts_status ON workouts(user_id, status);
CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id, logged_at DESC);

-- Updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Profile + default exercises on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO exercises (user_id, name, category, movement_type, is_compound) VALUES
    (NEW.id, 'Bench Press', 'Push', 'barbell', true),
    (NEW.id, 'Back Squat', 'Legs', 'barbell', true),
    (NEW.id, 'Deadlift', 'Pull', 'barbell', true),
    (NEW.id, 'Overhead Press', 'Push', 'barbell', true),
    (NEW.id, 'Barbell Row', 'Pull', 'barbell', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Last performance view (per user, per exercise)
CREATE OR REPLACE VIEW last_exercise_performance AS
SELECT DISTINCT ON (w.user_id, ws.exercise_id)
  w.user_id,
  ws.exercise_id,
  ws.weight_kg,
  ws.reps,
  ws.rir,
  w.completed_at,
  w.id AS workout_id
FROM workout_sets ws
JOIN workouts w ON w.id = ws.workout_id
WHERE w.status = 'completed'
  AND ws.is_warmup = false
ORDER BY w.user_id, ws.exercise_id, w.completed_at DESC, ws.set_number DESC;

-- RPC: get last performance for a specific exercise
-- RPC: get last performance for a specific exercise
CREATE OR REPLACE FUNCTION get_last_performance(p_exercise_id UUID)
RETURNS TABLE (
  exercise_id UUID,
  weight_kg NUMERIC,
  reps INT,
  rir INT,
  completed_at TIMESTAMPTZ,
  workout_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lep.exercise_id,
    lep.weight_kg,
    lep.reps,
    lep.rir,
    lep.completed_at,
    lep.workout_id
  FROM last_exercise_performance lep
  WHERE lep.user_id = auth.uid()
    AND lep.exercise_id = p_exercise_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Exercises policies
CREATE POLICY "Users can view own exercises" ON exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exercises" ON exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercises" ON exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercises" ON exercises FOR DELETE USING (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Users can view own templates" ON templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id);

-- Template exercises policies (via template ownership)
CREATE POLICY "Users can view own template exercises" ON template_exercises FOR SELECT
  USING (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can insert own template exercises" ON template_exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can update own template exercises" ON template_exercises FOR UPDATE
  USING (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can delete own template exercises" ON template_exercises FOR DELETE
  USING (EXISTS (SELECT 1 FROM templates t WHERE t.id = template_id AND t.user_id = auth.uid()));

-- Workouts policies
CREATE POLICY "Users can view own workouts" ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Workout sets policies (via workout ownership)
CREATE POLICY "Users can view own workout sets" ON workout_sets FOR SELECT
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can insert own workout sets" ON workout_sets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can update own workout sets" ON workout_sets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can delete own workout sets" ON workout_sets FOR DELETE
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));

-- Grants for view and RPC
GRANT SELECT ON last_exercise_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_performance(UUID) TO authenticated;
