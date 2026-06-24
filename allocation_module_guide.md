# Allocation Module Guide (Scoring + Matching + Room Assignment)
## For: AI Coding Agent | Stack: Flask + React + PostgreSQL (local)

---

## 0. Scope of This Module

Authentication and Preference modules already exist and work. Do not modify them except where explicitly instructed below. This guide covers exactly one thing: turning submitted student preferences into confirmed room assignments.

The module has three internal stages:
1. **Scoring** — pairwise compatibility score between any two students
2. **Matching** — finding the combination of pairs that maximizes total compatibility across the whole eligible pool (not greedy)
3. **Allocation** — assigning each matched pair (or unmatched single) to a physical room

---

## 1. Hard Assumptions — Read Before Coding

These were explicit product decisions. Do not deviate without flagging it back.

| Decision | Value |
|---|---|
| Matching scope | Across **all** hostel blocks. Room is chosen after matching, not before. |
| Odd student out | Placed **alone** in a room with status `awaiting_roommate`. They are prioritized for matching against new registrants in the next run, before any other matching happens. |
| Gender | **Assumption added by agent, not explicitly specified — flag if wrong.** Matching only ever occurs between students of the same gender. Cross-gender edges are never created in the compatibility graph. |
| Matching algorithm | Maximum Weight Matching via `networkx`, not greedy. |
| Library | `networkx` is an approved new dependency. |

---

## 2. Schema Changes Required First

The existing schema assumes every assignment has exactly two students and a score. Solo placement breaks both assumptions. Apply this migration before writing any service code.

```sql
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
```

### Updated room status trigger

The existing `trigger_sync_room_status()` only knew about `empty` and `allocated`. Replace it entirely:

```sql
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
```

Re-run this `CREATE OR REPLACE FUNCTION` against the local database. No need to drop the trigger itself, only the function body.

### Verify after migration

```bash
psql roommate_system -c "\d room_assignments"
psql roommate_system -c "\d rooms"
```

Confirm `student_id_2` and `compatibility_score` show as nullable, and both updated CHECK constraints are present.

---

## 3. Eligibility Rules — Who Enters the Matching Pool

A student is eligible for a given semester's allocation run if **all** of the following are true:

1. `students.status = 'active'`
2. A `student_preferences` row exists for them
3. They do **not** already appear as `student_id_1` or `student_id_2` in any `room_assignments` row for this semester with `status IN ('awaiting_roommate', 'active')`

Rule 3 must be checked across **both** columns. There is no single database constraint that enforces this — it is the service layer's responsibility. Do not skip it.

---

## 4. Stage 1: Scoring

Build (or rebuild from scratch — discard any prior partial implementation) `app/services/compatibility_engine.py`.

```python
"""
Pairwise compatibility scoring between two students' preference records.
Pure function — no Flask, no database access, fully unit-testable in isolation.
"""

WEIGHTS = {
    "wake_time":         20,
    "sleep_time":        20,
    "noise_tolerance":   20,
    "cleanliness_level": 15,
    "guest_policy":      15,
    "bathroom_schedule": 10,
}

def _scaled_diff_score(val_a, val_b, max_points, scale_max):
    """
    Generic 'closer is better' scorer.
    scale_max is the maximum possible value on that dimension's scale (5 for most, 3 for bathroom).
    """
    diff = abs(val_a - val_b)
    max_diff = scale_max - 1
    if max_diff == 0:
        return max_points
    return round(max_points * (1 - diff / max_diff), 2)


def calculate_compatibility(pref_a, pref_b):
    """
    pref_a, pref_b: dicts or ORM objects exposing the six preference attributes.
    Returns (total_score: int 0-100, breakdown: dict)
    """
    def get(p, field):
        return p[field] if isinstance(p, dict) else getattr(p, field)

    breakdown = {}

    breakdown["wake_time"] = _scaled_diff_score(
        get(pref_a, "wake_time"), get(pref_b, "wake_time"), WEIGHTS["wake_time"], 5
    )
    breakdown["sleep_time"] = _scaled_diff_score(
        get(pref_a, "sleep_time"), get(pref_b, "sleep_time"), WEIGHTS["sleep_time"], 5
    )
    breakdown["noise_tolerance"] = _scaled_diff_score(
        get(pref_a, "noise_tolerance"), get(pref_b, "noise_tolerance"), WEIGHTS["noise_tolerance"], 5
    )
    breakdown["cleanliness_level"] = _scaled_diff_score(
        get(pref_a, "cleanliness_level"), get(pref_b, "cleanliness_level"), WEIGHTS["cleanliness_level"], 5
    )
    breakdown["guest_policy"] = _scaled_diff_score(
        get(pref_a, "guest_policy"), get(pref_b, "guest_policy"), WEIGHTS["guest_policy"], 5
    )

    # Bathroom schedule is categorical (1=morning, 2=evening, 3=flexible), not linear distance.
    bath_a, bath_b = get(pref_a, "bathroom_schedule"), get(pref_b, "bathroom_schedule")
    if bath_a == bath_b or bath_a == 3 or bath_b == 3:
        breakdown["bathroom_schedule"] = WEIGHTS["bathroom_schedule"]
    else:
        breakdown["bathroom_schedule"] = WEIGHTS["bathroom_schedule"] * 0.5

    total = round(sum(breakdown.values()))
    total = max(0, min(100, total))

    return total, breakdown


LOW_COMPATIBILITY_THRESHOLD = 40

def is_flagged(score):
    return score < LOW_COMPATIBILITY_THRESHOLD
```

**Unit tests to write** (`tests/test_compatibility_engine.py`, no Flask app context needed):
- Identical preferences on both sides → score should be 100
- Maximally opposite numeric preferences (1 vs 5 on every dimension) → score should be low, calculate the expected value by hand and assert exact match
- Bathroom schedule: one student flexible (3), other fixed (1) → full 10 points awarded despite mismatch
- Bathroom schedule: both fixed but different (1 vs 2) → exactly half points (5)

Do not proceed to Stage 2 until these pass.

---

## 5. Stage 2: Matching (Maximum Weight Matching)

Add to `requirements.txt`:
```
networkx==3.3
```

Install:
```bash
pip install networkx==3.3
```

Add a new function to `compatibility_engine.py`, below the scoring functions:

```python
import networkx as nx
import itertools


def build_compatibility_graph(eligible_students):
    """
    eligible_students: list of dicts/objects each with:
        student_id, gender, preferences (object with the 6 fields)

    Returns: networkx.Graph with one node per student and one weighted
    edge per SAME-GENDER pair, weight = compatibility score.
    """
    G = nx.Graph()

    for s in eligible_students:
        G.add_node(s["student_id"], gender=s["gender"])

    for s1, s2 in itertools.combinations(eligible_students, 2):
        if s1["gender"] != s2["gender"]:
            continue  # hard constraint — never create cross-gender edges

        score, breakdown = calculate_compatibility(s1["preferences"], s2["preferences"])
        G.add_edge(
            s1["student_id"], s2["student_id"],
            weight=score, breakdown=breakdown
        )

    return G


def run_maximum_weight_matching(G):
    """
    Returns a list of dicts, one per matched pair:
        { student_id_1, student_id_2, score, breakdown }
    Also returns the list of student_ids left unmatched.
    """
    matching = nx.max_weight_matching(G, maxcardinality=True, weight="weight")

    matched_pairs = []
    matched_ids = set()

    for a, b in matching:
        edge_data = G.get_edge_data(a, b)
        matched_pairs.append({
            "student_id_1": a,
            "student_id_2": b,
            "score": edge_data["weight"],
            "breakdown": edge_data["breakdown"],
        })
        matched_ids.add(a)
        matched_ids.add(b)

    all_ids = set(G.nodes)
    unmatched_ids = list(all_ids - matched_ids)

    return matched_pairs, unmatched_ids
```

**Why `maxcardinality=True` matters:** without it, `networkx` may return a smaller matching if it happens to produce a higher total weight — e.g. leaving four people unmatched if pairing none of them scores better on paper than some other configuration. `maxcardinality=True` forces it to first maximize the *number* of pairs, and only then maximize weight within that constraint. This is the correct behaviour for this domain — leaving students unmatched is worse than a few mediocre pairings.

**Unit tests to write** (`tests/test_matching.py`):
- The exact 4-student example from the brief: A-B=100, A-C=95, A-D=95, B-C=94, B-D=94, C-D=5. Assert the matching returns {A-C, B-D} (or {A-D, B-C}, both score 189) and never {A-B, C-D} (105).
- Odd number of same-gender students (e.g. 3) → assert exactly one is in `unmatched_ids` after running.
- Two students of different genders, no same-gender candidates at all → graph has no edges → matching is empty, both appear in `unmatched_ids`. This confirms the gender constraint actually holds and the algorithm degrades safely rather than crashing.

Do not proceed to Stage 3 until these pass.

---

## 6. Stage 3: Allocation (Rooms)

New file: `app/services/allocation_service.py`. This is where matched pairs and unmatched students become actual `room_assignments` rows.

### 6.1 Priority pool — waiting students first

Before generating any new pairing, check for existing solo placements from a previous run:

```python
def get_waiting_students(semester):
    """
    Students with status = 'awaiting_roommate' in this semester.
    They already have a room — they do NOT need a new empty room found,
    they need student_id_2 filled in on their EXISTING assignment row.
    """
    return RoomAssignment.query.filter_by(
        semester=semester, status="awaiting_roommate"
    ).all()
```

When building the eligibility pool for matching, **waiting students are included as eligible students** (their `student_id_1` plus their stored preferences), but they are tagged so the allocator knows: if matched, update their existing row rather than creating a new one and finding a new room.

### 6.2 Full pipeline

```python
def generate_allocation_preview(semester):
    """
    Read-only. Computes everything but writes nothing to the database.
    Returns a structure the frontend can review before confirmation.
    """
    waiting_assignments = get_waiting_students(semester)
    waiting_student_ids = {wa.student_id_1 for wa in waiting_assignments}

    eligible = get_eligible_students(semester)  # implements Section 3 rules,
                                                  # MUST include waiting students too

    G = build_compatibility_graph(eligible)
    matched_pairs, unmatched_ids = run_maximum_weight_matching(G)

    for pair in matched_pairs:
        pair["is_flagged"] = is_flagged(pair["score"])
        # Tag whether either side of this pair is a waiting student with an existing room
        pair["joins_existing_room"] = (
            pair["student_id_1"] in waiting_student_ids or
            pair["student_id_2"] in waiting_student_ids
        )

    empty_rooms_needed = sum(1 for p in matched_pairs if not p["joins_existing_room"])
    empty_rooms_needed += len(unmatched_ids)  # every fresh unmatched student needs their own room too

    available_empty_rooms = Room.query.filter_by(status="empty").count()

    return {
        "matched_pairs": matched_pairs,
        "unmatched_student_ids": unmatched_ids,
        "rooms_required": empty_rooms_needed,
        "rooms_available": available_empty_rooms,
        "sufficient_rooms": available_empty_rooms >= empty_rooms_needed,
    }
```

```python
def confirm_allocation(semester, admin_id, confirmed_pairs, confirmed_singles):
    """
    Writes everything. Called only after admin reviews the preview and confirms,
    optionally after manual overrides on the frontend.

    confirmed_pairs: list of { student_id_1, student_id_2, score, breakdown, joins_existing_room }
    confirmed_singles: list of student_ids with no match this round
    """
    results = {"created": [], "updated": [], "failed": []}

    for pair in confirmed_pairs:
        if pair["joins_existing_room"]:
            # One side already has a room from a previous solo placement.
            # Find which student_id is the existing waiting one.
            existing = RoomAssignment.query.filter(
                RoomAssignment.semester == semester,
                RoomAssignment.status == "awaiting_roommate",
                db.or_(
                    RoomAssignment.student_id_1 == pair["student_id_1"],
                    RoomAssignment.student_id_1 == pair["student_id_2"],
                )
            ).first()

            if not existing:
                results["failed"].append({**pair, "reason": "Waiting record not found"})
                continue

            new_student_id = (
                pair["student_id_2"] if existing.student_id_1 == pair["student_id_1"]
                else pair["student_id_1"]
            )

            existing.student_id_2 = new_student_id
            existing.compatibility_score = pair["score"]
            existing.score_breakdown = pair["breakdown"]
            existing.is_flagged = is_flagged(pair["score"])
            existing.status = "active"   # trigger fires here, room -> 'allocated'
            db.session.commit()
            results["updated"].append(existing.assignment_id)

        else:
            # Fresh pair, needs a brand new empty room
            room = Room.query.filter_by(status="empty").first()
            if not room:
                results["failed"].append({**pair, "reason": "No empty room available"})
                continue

            assignment = RoomAssignment(
                student_id_1=pair["student_id_1"],
                student_id_2=pair["student_id_2"],
                room_id=room.room_id,
                semester=semester,
                compatibility_score=pair["score"],
                score_breakdown=pair["breakdown"],
                assignment_type="algorithm",
                status="active",            # trigger fires here, room -> 'allocated'
                is_flagged=is_flagged(pair["score"]),
                assigned_by=admin_id,
            )
            db.session.add(assignment)
            db.session.flush()

            # Lock both students' preferences
            for sid in (pair["student_id_1"], pair["student_id_2"]):
                pref = StudentPreference.query.filter_by(student_id=sid).first()
                if pref:
                    pref.is_locked = True

            db.session.commit()
            results["created"].append(assignment.assignment_id)

    # Solo placements — students who could not be matched this round
    for student_id in confirmed_singles:
        room = Room.query.filter_by(status="empty").first()
        if not room:
            results["failed"].append({"student_id_1": student_id, "reason": "No empty room available"})
            continue

        assignment = RoomAssignment(
            student_id_1=student_id,
            student_id_2=None,
            room_id=room.room_id,
            semester=semester,
            compatibility_score=None,
            score_breakdown=None,
            assignment_type="algorithm",
            status="awaiting_roommate",   # trigger fires here, room -> 'partially_allocated'
            is_flagged=False,
            assigned_by=admin_id,
        )
        db.session.add(assignment)
        db.session.flush()

        pref = StudentPreference.query.filter_by(student_id=student_id).first()
        if pref:
            pref.is_locked = True

        db.session.commit()
        results["created"].append(assignment.assignment_id)

    return results
```

**Critical rule, repeated from the dev guide and still true here:** never write `UPDATE rooms SET status = ...` anywhere in this file. Every status change above happens only by changing `room_assignments.status` and letting the trigger react. If you find yourself tempted to set room status directly, it means a status value transition is missing from the trigger function in Section 2 — fix it there, not here.

---

## 7. API Endpoints

```
GET  /api/admin/allocation/preview?semester=2026-1
     -> role_required("admin")
     -> calls generate_allocation_preview(semester)
     -> returns matched_pairs, unmatched_student_ids, rooms_required,
        rooms_available, sufficient_rooms
     -> writes NOTHING to the database

POST /api/admin/allocation/confirm
     -> role_required("admin")
     -> body: { semester, confirmed_pairs: [...], confirmed_singles: [...] }
     -> calls confirm_allocation(semester, admin_id, confirmed_pairs, confirmed_singles)
     -> returns { created: [...], updated: [...], failed: [...] }
```

The frontend calls `preview` first, lets the admin review (and manually override pairs if they want — overrides are just edits to the `confirmed_pairs` array before it's sent to `confirm`), and only `confirm` ever touches the database.

If `sufficient_rooms` is `false` in the preview response, the frontend must show a blocking warning before allowing confirmation, directing the admin to the room management screen to add more rooms.

---

## 8. Edge Cases to Explicitly Handle

| Case | Required behaviour |
|---|---|
| Zero eligible students | Preview returns empty `matched_pairs`, empty `unmatched_student_ids`. No error. |
| Only one gender present | All students of that gender attempt matching among themselves; the other gender's students (if any) all land in `unmatched_student_ids` with no edges at all — this is correct, not a bug. |
| Single eligible student total | They go straight to `unmatched_student_ids`, no graph edges possible. |
| A waiting student's preferences were updated since they were placed solo | Allowed — `is_locked` was already set to `TRUE` when they were placed, so `PUT /api/preferences/` already rejects this at the preference-module level. No new check needed here. |
| Admin tries to confirm a pair where one student got assigned by a different admin in the meantime (race condition) | `confirm_allocation` re-checks each student isn't already in an active/awaiting assignment for that semester before writing; if they are, add them to `results["failed"]` rather than crashing or double-assigning. |
| compatibility score of exactly 40 | Not flagged — flagging rule is strictly `< 40`, not `<= 40`. |

---

## 9. Testing Checklist Before Considering This Module Done

- [ ] Migration applied locally, `\d room_assignments` confirms nullable `student_id_2` and `compatibility_score`
- [ ] Trigger function replaced, manually tested for all four transitions: insert-awaiting, insert-active, update-to-active-from-awaiting, update-to-cancelled
- [ ] `test_compatibility_engine.py` passes, including the bathroom-flexible edge case
- [ ] `test_matching.py` passes, including the exact A/B/C/D counterexample from the brief
- [ ] Preview endpoint returns correct `rooms_required` math when some pairs join existing waiting students (those should NOT count toward rooms required)
- [ ] Confirming an allocation with a waiting-student pairing updates the existing `room_assignments` row (visible via unchanged `assignment_id`) rather than creating a new one
- [ ] Confirming a fresh pair creates exactly one new `room_assignments` row and locks exactly two `student_preferences` rows
- [ ] Confirming a solo placement creates a row with `student_id_2 = NULL`, `status = 'awaiting_roommate'`, and the room flips to `partially_allocated` (verify directly with `psql`, not just through the API)
- [ ] Running preview twice in a row without confirming produces identical results both times (confirms preview truly writes nothing)
- [ ] Attempting to confirm a pair involving a student who was already assigned by a concurrent request lands in `results["failed"]`, not a 500 error
