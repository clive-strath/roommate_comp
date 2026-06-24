-- ============================================================
-- Migration: support solo ("awaiting_roommate") placements
-- ============================================================

-- 1. student_id_2 must be nullable (solo placement has no second student)
ALTER TABLE room_assignments ALTER COLUMN student_id_2 DROP NOT NULL;

-- 2. compatibility_score must be nullable (no score exists for a solo placement)
ALTER TABLE room_assignments ALTER COLUMN compatibility_score DROP NOT NULL;
ALTER TABLE room_assignments DROP CONSTRAINT IF EXISTS room_assignments_compatibility_score_check;
ALTER TABLE room_assignments ADD CONSTRAINT room_assignments_compatibility_score_check
    CHECK (compatibility_score IS NULL OR compatibility_score BETWEEN 0 AND 100);

-- 3. self-assignment check must tolerate NULL student_id_2
ALTER TABLE room_assignments DROP CONSTRAINT IF EXISTS no_self_assignment;
ALTER TABLE room_assignments ADD CONSTRAINT no_self_assignment
    CHECK (student_id_2 IS NULL OR student_id_1 <> student_id_2);

-- 4. status enum gains 'awaiting_roommate'
ALTER TABLE room_assignments DROP CONSTRAINT IF EXISTS room_assignments_status_check;
ALTER TABLE room_assignments ADD CONSTRAINT room_assignments_status_check
    CHECK (status IN ('awaiting_roommate', 'active', 'completed', 'cancelled', 'archived'));

-- 5. low-compatibility flag, separate from status
ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN room_assignments.is_flagged IS
    'TRUE when compatibility_score < 40. Does not block assignment, just surfaces it to admin.';

-- 6. rooms gain a third occupancy state: one person, room for one more
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
    CHECK (status IN ('empty', 'partially_allocated', 'allocated', 'maintenance'));

-- 7. Replace the trigger function body
CREATE OR REPLACE FUNCTION trigger_sync_room_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'awaiting_roommate' THEN
            UPDATE rooms SET status = 'partially_allocated' WHERE room_id = NEW.room_id;
        ELSIF NEW.status = 'active' THEN
            UPDATE rooms SET status = 'allocated' WHERE room_id = NEW.room_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
        IF NEW.status = 'active' THEN
            -- Covers both a fresh pair AND a waiting student finally getting a roommate
            UPDATE rooms SET status = 'allocated' WHERE room_id = NEW.room_id;
        ELSIF NEW.status IN ('cancelled', 'completed', 'archived') THEN
            UPDATE rooms
            SET status = 'empty'
            WHERE room_id = NEW.room_id AND status <> 'maintenance';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
