-- =============================================================================
-- TEMPORARILY DISABLE SCHOOL GEOFENCE VERIFICATION (CHECK-IN & CHECK-OUT)
-- =============================================================================
-- Reason: the school asked to switch off GPS geofence checks "for now" while
-- keeping the live camera selfie requirement (gallery uploads remain blocked
-- client-side; this migration does not touch evidence handling).
--
-- Changes vs the original functions:
--   * Accuracy threshold check ....... REMOVED
--   * Distance / geofence check ...... REMOVED (v_distance is now NULL)
--   * Signatures unchanged ........... client may pass NULL coords
--   * Lateness calculation, session insert/update, audit events,
--     selfie evidence, checkout status ......... ALL UNCHANGED
--
-- TO RE-ENABLE LATER: restore the two blocks from
-- supabase/migrations/20261022000000_teacher_attendance_system.sql
-- (the "-- Verify accuracy" and "-- Verify geofence" sections in each
-- function) and set GEOFENCE_CHECK_ENABLED = true in src/pages/TeacherDashboard.tsx.

-- ---------------------------------------------------------------------------
-- 1. Check-In RPC without geofence enforcement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_check_in(
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_accuracy NUMERIC,
    p_evidence_path TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_teacher RECORD;
    v_school RECORD;
    v_distance NUMERIC := NULL;  -- GEOFENCE DISABLED (temporary)
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_local_time TIME;
    v_opening TIME;
    v_grace_mins INT;
    v_cutoff TIME;
    v_status TEXT := 'present';
    v_lateness_mins INT := 0;
    v_session_id UUID;
    v_school_date DATE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated';
    END IF;

    -- Lookup teacher record
    SELECT * INTO v_teacher FROM teachers WHERE profile_id = v_user_id AND employment_status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher profile not found for current user';
    END IF;

    -- Lookup active school settings
    SELECT * INTO v_school FROM school_settings LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'School settings not configured';
    END IF;

    -- NOTE: GPS accuracy and geofence checks intentionally removed here
    -- (temporarily disabled). v_distance stays NULL.

    -- Calculate local date and time in school timezone
    v_school_date := (v_now AT TIME ZONE v_school.timezone)::date;
    v_local_time := (v_now AT TIME ZONE v_school.timezone)::time;
    v_opening := v_school.opening_time;
    v_grace_mins := v_school.grace_period_minutes;
    v_cutoff := v_opening + (v_grace_mins || ' minutes')::interval;

    -- Determine punctuality
    IF v_local_time > v_cutoff THEN
        v_status := 'late';
        v_lateness_mins := GREATEST(1, round(EXTRACT(EPOCH FROM (v_local_time - v_opening)) / 60));
    ELSE
        v_status := 'present';
        v_lateness_mins := 0;
    END IF;

    -- Insert or update attendance session
    INSERT INTO attendance_sessions (
        teacher_id,
        school_date,
        check_in_at,
        attendance_status,
        check_in_evidence_path,
        check_in_latitude,
        check_in_longitude,
        check_in_accuracy_meters,
        check_in_geofence_distance_meters,
        lateness_minutes,
        checkout_status
    ) VALUES (
        v_teacher.id,
        v_school_date,
        v_now,
        v_status,
        p_evidence_path,
        p_latitude,
        p_longitude,
        p_accuracy,
        v_distance,
        v_lateness_mins,
        'pending'
    )
    ON CONFLICT (teacher_id, school_date) DO UPDATE
    SET 
        check_in_at = COALESCE(attendance_sessions.check_in_at, EXCLUDED.check_in_at),
        attendance_status = CASE 
            WHEN attendance_sessions.check_in_at IS NOT NULL THEN attendance_sessions.attendance_status 
            ELSE EXCLUDED.attendance_status 
        END,
        check_in_evidence_path = COALESCE(attendance_sessions.check_in_evidence_path, EXCLUDED.check_in_evidence_path),
        updated_at = v_now
    RETURNING id INTO v_session_id;

    -- Record audit event
    INSERT INTO attendance_events (
        attendance_session_id,
        actor_profile_id,
        event_type,
        event_timestamp,
        metadata
    ) VALUES (
        v_session_id,
        v_user_id,
        'check_in',
        v_now,
        jsonb_build_object(
            'distance_meters', v_distance,
            'status', v_status,
            'lateness_minutes', v_lateness_mins,
            'accuracy_meters', p_accuracy
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'status', v_status,
        'lateness_minutes', v_lateness_mins,
        'check_in_at', v_now,
        'distance_meters', v_distance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Check-Out RPC without geofence enforcement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_check_out(
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_accuracy NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_teacher RECORD;
    v_school RECORD;
    v_session RECORD;
    v_distance NUMERIC := NULL;  -- GEOFENCE DISABLED (temporary)
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_local_time TIME;
    v_closing TIME;
    v_checkout_status TEXT := 'completed';
    v_school_date DATE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated';
    END IF;

    SELECT * INTO v_teacher FROM teachers WHERE profile_id = v_user_id AND employment_status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher record not found';
    END IF;

    SELECT * INTO v_school FROM school_settings LIMIT 1;
    v_school_date := (v_now AT TIME ZONE v_school.timezone)::date;

    SELECT * INTO v_session FROM attendance_sessions 
    WHERE teacher_id = v_teacher.id AND school_date = v_school_date;

    IF NOT FOUND OR v_session.check_in_at IS NULL THEN
        RAISE EXCEPTION 'Cannot check out without prior check-in for today';
    END IF;

    IF v_session.check_out_at IS NOT NULL THEN
        -- Return already recorded checkout
        RETURN jsonb_build_object(
            'success', true,
            'already_checked_out', true,
            'check_out_at', v_session.check_out_at,
            'checkout_status', v_session.checkout_status
        );
    END IF;

    -- NOTE: GPS distance / geofence check intentionally removed here
    -- (temporarily disabled). v_distance stays NULL.

    v_local_time := (v_now AT TIME ZONE v_school.timezone)::time;
    v_closing := v_school.closing_time;

    IF v_local_time < (v_closing - INTERVAL '15 minutes') THEN
        v_checkout_status := 'early';
    ELSIF v_local_time > (v_closing + INTERVAL '60 minutes') THEN
        v_checkout_status := 'overdue';
    ELSE
        v_checkout_status := 'completed';
    END IF;

    UPDATE attendance_sessions
    SET 
        check_out_at = v_now,
        check_out_latitude = p_latitude,
        check_out_longitude = p_longitude,
        check_out_accuracy_meters = p_accuracy,
        check_out_geofence_distance_meters = v_distance,
        checkout_status = v_checkout_status,
        updated_at = v_now
    WHERE id = v_session.id;

    -- Log checkout event
    INSERT INTO attendance_events (
        attendance_session_id,
        actor_profile_id,
        event_type,
        event_timestamp,
        metadata
    ) VALUES (
        v_session.id,
        v_user_id,
        'check_out',
        v_now,
        jsonb_build_object(
            'distance_meters', v_distance,
            'checkout_status', v_checkout_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'check_out_at', v_now,
        'checkout_status', v_checkout_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
