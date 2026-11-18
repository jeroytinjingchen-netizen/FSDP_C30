-- migrations/002_as_spec.sql
-- Moves the schema to the admin backlog v3 (AS-1 .. AS-13).
-- Additive only: nothing is dropped, so old rows (invoices, terms, venues, availability,
-- notification_log) stay in the database but are no longer used by the application.

-- ---------------------------------------------------------------- Centres (AS-3, AS-10)
-- HQ is the only place gradings are held. At most one centre can be HQ.
ALTER TABLE centres ADD COLUMN IF NOT EXISTS is_hq boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_centres_single_hq ON centres (is_hq) WHERE is_hq;

-- Mark "ASK Headquarters Dojo" as HQ. If it is missing, fall back to any centre named like HQ.
-- Nothing happens when an HQ centre is already marked.
UPDATE centres SET is_hq = true
 WHERE id = (SELECT id FROM centres
              WHERE name ILIKE '%HQ%' OR name ILIKE '%headquarter%'
              ORDER BY (name = 'ASK Headquarters Dojo') DESC, created_at LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM centres WHERE is_hq);

-- ---------------------------------------------------------------- Classes (AS-4, AS-6)
-- A class belongs to a centre (not a term or venue) and has one fixed instructor.
ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS centre_id uuid REFERENCES centres(id);
ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES instructors(id);

UPDATE class_templates ct SET centre_id = v.centre_id
  FROM venues v WHERE v.id = ct.venue_id AND ct.centre_id IS NULL;

UPDATE class_templates ct SET instructor_id = (
    SELECT cti.instructor_id FROM class_template_instructors cti
     WHERE cti.template_id = ct.id ORDER BY cti.instructor_id LIMIT 1)
 WHERE ct.instructor_id IS NULL;

ALTER TABLE class_templates ALTER COLUMN term_id  DROP NOT NULL;
ALTER TABLE class_templates ALTER COLUMN venue_id DROP NOT NULL;
ALTER TABLE class_templates ALTER COLUMN centre_id SET NOT NULL;
ALTER TABLE class_sessions  ALTER COLUMN venue_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_class_templates_centre     ON class_templates(centre_id, weekday);
CREATE INDEX IF NOT EXISTS idx_class_templates_instructor ON class_templates(instructor_id);

-- ---------------------------------------------------------------- Grading (AS-10, AS-11)
-- Gradings are held at HQ, so a room (venue) is no longer needed.
ALTER TABLE grading_sessions ALTER COLUMN venue_id DROP NOT NULL;
-- Rank the student was graded for, and the grading instructor, per result.
ALTER TABLE grading_candidates ADD COLUMN IF NOT EXISTS graded_for_rank_id uuid REFERENCES ranks(id);
ALTER TABLE grading_candidates ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES instructors(id);

UPDATE grading_candidates SET outcome = 'GRADED'     WHERE outcome::text = 'PASS';
UPDATE grading_candidates SET outcome = 'NOT_GRADED' WHERE outcome::text = 'FAIL';

-- ---------------------------------------------------------------- Rank history (AS-8)
-- promotion_history becomes the rank history. Manual changes have no grading candidate.
ALTER TABLE promotion_history ALTER COLUMN candidate_id DROP NOT NULL;
ALTER TABLE promotion_history ADD COLUMN IF NOT EXISTS changed_by_id uuid REFERENCES users(id);
ALTER TABLE promotion_history ADD COLUMN IF NOT EXISTS note text;

-- ---------------------------------------------------------------- Packages (AS-9)
-- Packages are defined by HQ in the database (no admin screen).
CREATE TABLE IF NOT EXISTS packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,
  sessions_total  integer     NOT NULL CHECK (sessions_total > 0),
  validity_weeks  integer     NOT NULL CHECK (validity_weeks > 0),
  price_cents     integer     NOT NULL CHECK (price_cents >= 0),
  currency        text        NOT NULL DEFAULT 'SGD',
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- Payments (AS-12)
-- Payments belong to a student and package. invoice_id stays only for old rows.
ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES packages(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_at  timestamptz;

UPDATE payments p SET student_id = i.student_id
  FROM invoices i WHERE i.id = p.invoice_id AND p.student_id IS NULL;
UPDATE payments SET payout_at = paid_at WHERE status::text = 'COMPLETED' AND payout_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_student  ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_payout   ON payments(payout_at);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);

-- Only two statuses are allowed. In the database COMPLETED is shown as "Successful".
-- NOT VALID applies the rule to new and changed rows only, so old rows cannot block the migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_status') THEN
    ALTER TABLE payments ADD CONSTRAINT chk_payments_status
      CHECK (status::text IN ('COMPLETED', 'FAILED')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_payout') THEN
    ALTER TABLE payments ADD CONSTRAINT chk_payments_payout
      CHECK (status::text <> 'FAILED' OR payout_at IS NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_owner') THEN
    ALTER TABLE payments ADD CONSTRAINT chk_payments_owner
      CHECK (invoice_id IS NOT NULL OR student_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- A package a student owns. payment_id is required and unique, so a package exists only
-- after a Successful payment and one payment can never activate two packages.
CREATE TABLE IF NOT EXISTS student_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid        NOT NULL REFERENCES students(id),
  package_id      uuid        NOT NULL REFERENCES packages(id),
  payment_id      uuid        NOT NULL UNIQUE REFERENCES payments(id),
  name            text        NOT NULL,                 -- snapshot of the package name
  sessions_total  integer     NOT NULL CHECK (sessions_total > 0),
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_packages_student ON student_packages(student_id, expires_at);

-- One row per session attended. Sessions used = count of rows, remaining = total - used.
-- One attendance per student per Singapore calendar day stops double clicks using two sessions.
CREATE TABLE IF NOT EXISTS attendance (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid        NOT NULL REFERENCES students(id),
  student_package_id  uuid        NOT NULL REFERENCES student_packages(id) ON DELETE CASCADE,
  attended_at         timestamptz NOT NULL DEFAULT now(),
  attended_on         date        NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Singapore')::date),
  UNIQUE (student_id, attended_on)
);
CREATE INDEX IF NOT EXISTS idx_attendance_package ON attendance(student_package_id);

-- ---------------------------------------------------------------- Security
-- Same rule as the base schema: all access goes through the API, so no public policies.
ALTER TABLE packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance       ENABLE ROW LEVEL SECURITY;
