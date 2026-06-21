-- Allow deleting templates by changing workouts.template_id constraint.
-- Instead of RESTRICT (which blocks deletion), use SET NULL to preserve
-- workout history while allowing template removal.

-- 1. Make template_id nullable
ALTER TABLE workouts ALTER COLUMN template_id DROP NOT NULL;

-- 2. Replace the foreign key constraint: RESTRICT -> SET NULL
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_template_id_fkey;
ALTER TABLE workouts
  ADD CONSTRAINT workouts_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL;
