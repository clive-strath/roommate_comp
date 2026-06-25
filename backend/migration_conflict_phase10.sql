-- ============================================================
-- Migration: conflict management phase 10
-- Student-reported conflicts, RA mediation, admin escalation/disable
-- ============================================================

-- 1) Conflict reporter should be student (not admin user)
ALTER TABLE conflict_logs DROP CONSTRAINT IF EXISTS conflict_logs_reported_by_fkey;
ALTER TABLE conflict_logs DROP COLUMN IF EXISTS reported_by;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS reported_by_student_id INTEGER;

UPDATE conflict_logs
SET reported_by_student_id = student_involved
WHERE reported_by_student_id IS NULL;

ALTER TABLE conflict_logs
    ALTER COLUMN reported_by_student_id SET NOT NULL;

ALTER TABLE conflict_logs
    ADD CONSTRAINT conflict_logs_reported_by_student_fkey
    FOREIGN KEY (reported_by_student_id) REFERENCES students(student_id) ON DELETE RESTRICT;

-- 2) Status lifecycle adds escalated
ALTER TABLE conflict_logs DROP CONSTRAINT IF EXISTS conflict_logs_status_check;
ALTER TABLE conflict_logs
    ADD CONSTRAINT conflict_logs_status_check
    CHECK (status IN ('open', 'in_mediation', 'resolved', 'escalated', 'disabled'));

-- 3) RA mediation + escalation fields
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS mediation_notes TEXT;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS actions_taken TEXT;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS handled_by_ra_id INTEGER REFERENCES admin_users(admin_id) ON DELETE SET NULL;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS escalated_by INTEGER REFERENCES admin_users(admin_id) ON DELETE SET NULL;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE conflict_logs ADD COLUMN IF NOT EXISTS escalation_notes TEXT;

-- 4) Helpful lookup indexes
CREATE INDEX IF NOT EXISTS idx_conflicts_reported_by_student ON conflict_logs(reported_by_student_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_handled_by_ra ON conflict_logs(handled_by_ra_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_escalated_by ON conflict_logs(escalated_by);
