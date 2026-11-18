-- migrations/001_enum_values.sql
-- New enum values must be committed before any later statement uses them,
-- so they live in their own migration file (each file runs as one transaction).

-- AS-10: grading results are "Graded" or "Not graded" (replaces PASS / FAIL).
ALTER TYPE grading_outcome ADD VALUE IF NOT EXISTS 'GRADED';
ALTER TYPE grading_outcome ADD VALUE IF NOT EXISTS 'NOT_GRADED';
