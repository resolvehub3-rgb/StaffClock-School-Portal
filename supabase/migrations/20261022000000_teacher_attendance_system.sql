-- ==============================================================================
-- STAFFCLOCK PRODUCTION SQL MIGRATION
-- School Teacher Check-In & Check-Out Management System
-- Schema, RLS, Storage Policies, Triggers & Audited RPC Functions
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SCHOOL SETTINGS
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name TEXT NOT NULL DEFAULT 'Accra Senior High Model School',
    logo_object_path TEXT,
    timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
    opening_time TIME NOT NULL DEFAULT '06:00:00',
    closing_time TIME NOT NULL DEFAULT '16:30:00',
    grace_period_minutes INTEGER NOT NULL DEFAULT 10 CHECK (grace_period_minutes >= 0 AND grace_period_minutes <= 120),
    school_latitude NUMERIC(10, 7) NOT NULL DEFAULT 5.6037000,
    school_longitude NUMERIC(10, 7) NOT NULL DEFAULT -0.1870000,
    geofence_radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (geofence_radius_meters >= 20 AND geofence_radius_meters <= 2000),
    max_accuracy_threshold_meters INTEGER NOT NULL DEFAULT 100 CHECK (max_accuracy_threshold_meters >= 10 AND max_accuracy_threshold_meters <= 500),
    checkout_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
    is_configured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure only one school settings row can exist for this school installation
CREATE UNIQUE INDEX IF NOT EXISTS school_settings_single_row_idx ON school_settings ((true));

-- 3. USER PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('owner', 'headmaster', 'teacher')),
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_activation')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TEACHERS
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    staff_number TEXT NOT NULL UNIQUE,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'on_leave')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. CLASSES
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name TEXT NOT NULL,
    class_level TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(class_name, class_level)
);

-- 6. TEACHER CLASS ASSIGNMENTS
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year TEXT DEFAULT '2026/2027',
    is_primary_class BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(teacher_id, class_id)
);

-- 7. ATTENDANCE SESSIONS
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    school_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    attendance_status TEXT NOT NULL DEFAULT 'absent' CHECK (attendance_status IN ('present', 'late', 'absent', 'excused')),
    check_in_evidence_path TEXT,
    check_out_evidence_path TEXT,
    check_in_latitude NUMERIC(10, 7),
    check_in_longitude NUMERIC(10, 7),
    check_in_accuracy_meters NUMERIC(8, 2),
    check_out_latitude NUMERIC(10, 7),
    check_out_longitude NUMERIC(10, 7),
    check_out_accuracy_meters NUMERIC(8, 2),
    check_in_geofence_distance_meters NUMERIC(10, 2),
    check_out_geofence_distance_meters NUMERIC(10, 2),
    lateness_minutes INTEGER NOT NULL DEFAULT 0 CHECK (lateness_minutes >= 0),
    checkout_status TEXT NOT NULL DEFAULT 'pending' CHECK (checkout_status IN ('pending', 'completed', 'overdue', 'early')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(teacher_id, school_date)
);

-- 8. ATTENDANCE EVENTS (Append-only audit trail)
CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'admin_correction', 'attempt_rejected')),
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TEACHER INVITATIONS (For manual activation link sharing)
CREATE TABLE IF NOT EXISTS teacher_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    staff_number TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'headmaster')),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_attendance_session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES FOR HIGH-THROUGHPUT SEARCH & FILTERING
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(school_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher_date ON attendance_sessions(teacher_id, school_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON attendance_sessions(attendance_status);
CREATE INDEX IF NOT EXISTS idx_attendance_events_session ON attendance_events(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_teachers_profile ON teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_teachers_staff_number ON teachers(staff_number);
CREATE INDEX IF NOT EXISTS idx_teacher_class_teacher ON teacher_class_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_class_class ON teacher_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_profile_id, read_at);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_token ON teacher_invitations(token);

-- ==============================================================================
-- 12. HAVERSINE DISTANCE FUNCTION (POSTGRESQL)
-- ==============================================================================
CREATE OR REPLACE FUNCTION calculate_distance_meters(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371000; -- Earth radius in meters
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
    phi1 NUMERIC;
    phi2 NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 99999999;
    END IF;
    
    phi1 := radians(lat1);
    phi2 := radians(lat2);
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat / 2)^2 + cos(phi1) * cos(phi2) * sin(dlon / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));
    
    RETURN round((r * c)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to inspect current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- school_settings policies:
-- Any authenticated user can read settings (for app name, times, coordinates)
CREATE POLICY "Allow authenticated read on school_settings"
    ON school_settings FOR SELECT
    TO authenticated
    USING (true);

-- Only owner can update school_settings
CREATE POLICY "Allow owner update on school_settings"
    ON school_settings FOR UPDATE
    TO authenticated
    USING (get_current_user_role() = 'owner')
    WITH CHECK (get_current_user_role() = 'owner');

-- profiles policies:
CREATE POLICY "Allow users to read permitted profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() 
        OR get_current_user_role() IN ('owner', 'headmaster')
    );

CREATE POLICY "Allow user to update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Allow owner to manage profiles"
    ON profiles FOR ALL
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- teachers policies:
CREATE POLICY "Allow read on teachers"
    ON teachers FOR SELECT
    TO authenticated
    USING (
        profile_id = auth.uid()
        OR get_current_user_role() IN ('owner', 'headmaster')
    );

CREATE POLICY "Allow owner to manage teachers"
    ON teachers FOR ALL
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- classes policies:
CREATE POLICY "Allow read on classes"
    ON classes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow owner to manage classes"
    ON classes FOR ALL
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- teacher_class_assignments policies:
CREATE POLICY "Allow read on class assignments"
    ON teacher_class_assignments FOR SELECT
    TO authenticated
    USING (
        teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
        OR get_current_user_role() IN ('owner', 'headmaster')
    );

CREATE POLICY "Allow owner to manage class assignments"
    ON teacher_class_assignments FOR ALL
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- attendance_sessions policies:
CREATE POLICY "Allow read attendance sessions"
    ON attendance_sessions FOR SELECT
    TO authenticated
    USING (
        teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
        OR get_current_user_role() IN ('owner', 'headmaster')
    );

CREATE POLICY "Allow owner to update attendance sessions"
    ON attendance_sessions FOR UPDATE
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- attendance_events policies (append-only):
CREATE POLICY "Allow read attendance events"
    ON attendance_events FOR SELECT
    TO authenticated
    USING (
        actor_profile_id = auth.uid()
        OR get_current_user_role() IN ('owner', 'headmaster')
    );

-- teacher_invitations policies:
CREATE POLICY "Allow read invitations for activation or owner"
    ON teacher_invitations FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow owner to manage teacher invitations"
    ON teacher_invitations FOR ALL
    TO authenticated
    USING (get_current_user_role() = 'owner');

-- notifications policies:
CREATE POLICY "Allow user to read own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (recipient_profile_id = auth.uid());

CREATE POLICY "Allow user to update own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (recipient_profile_id = auth.uid());

-- audit_logs policies (read-only for owner/headmaster):
CREATE POLICY "Allow owner and headmaster to view audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (get_current_user_role() IN ('owner', 'headmaster'));

-- ==============================================================================
-- 14. AUTHORITATIVE SERVER-SIDE ATTENDANCE RPCs
-- ==============================================================================

-- Teacher Check-In RPC
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
    v_distance NUMERIC;
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

    -- Verify accuracy
    IF p_accuracy > v_school.max_accuracy_threshold_meters THEN
        RAISE EXCEPTION 'GPS accuracy (%m) is too poor. Maximum allowed is %m.', round(p_accuracy), v_school.max_accuracy_threshold_meters;
    END IF;

    -- Calculate distance to school
    v_distance := calculate_distance_meters(p_latitude, p_longitude, v_school.school_latitude, v_school.school_longitude);
    
    -- Verify geofence (with accuracy margin)
    IF GREATEST(0, v_distance - (p_accuracy * 0.5)) > v_school.geofence_radius_meters THEN
        -- Record rejected attempt
        INSERT INTO attendance_events (actor_profile_id, event_type, metadata, reason)
        VALUES (v_user_id, 'attempt_rejected', jsonb_build_object(
            'distance_meters', v_distance,
            'radius_meters', v_school.geofence_radius_meters,
            'latitude', p_latitude,
            'longitude', p_longitude
        ), 'Outside school geofence');
        
        RAISE EXCEPTION 'Location outside school geofence (%m away, limit is %m)', round(v_distance), v_school.geofence_radius_meters;
    END IF;

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

-- Teacher Check-Out RPC
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
    v_distance NUMERIC;
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

    -- Verify distance
    v_distance := calculate_distance_meters(p_latitude, p_longitude, v_school.school_latitude, v_school.school_longitude);
    IF GREATEST(0, v_distance - (p_accuracy * 0.5)) > v_school.geofence_radius_meters THEN
        RAISE EXCEPTION 'Location outside school geofence (%m away, limit is %m)', round(v_distance), v_school.geofence_radius_meters;
    END IF;

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

-- Audited Admin Correction RPC
CREATE OR REPLACE FUNCTION handle_admin_attendance_correction(
    p_session_id UUID,
    p_new_check_in TIMESTAMPTZ,
    p_new_check_out TIMESTAMPTZ,
    p_new_status TEXT,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_role TEXT;
    v_old_session RECORD;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_actor_id;
    IF v_role != 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only school owner can perform attendance corrections';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A legitimate reason is required for administrative attendance corrections';
    END IF;

    SELECT * INTO v_old_session FROM attendance_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance session not found';
    END IF;

    UPDATE attendance_sessions
    SET 
        check_in_at = p_new_check_in,
        check_out_at = p_new_check_out,
        attendance_status = p_new_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_session_id;

    -- Record in attendance_events
    INSERT INTO attendance_events (
        attendance_session_id,
        actor_profile_id,
        event_type,
        event_timestamp,
        metadata,
        reason
    ) VALUES (
        p_session_id,
        v_actor_id,
        'admin_correction',
        timezone('utc'::text, now()),
        jsonb_build_object(
            'old_check_in', v_old_session.check_in_at,
            'new_check_in', p_new_check_in,
            'old_check_out', v_old_session.check_out_at,
            'new_check_out', p_new_check_out,
            'old_status', v_old_session.attendance_status,
            'new_status', p_new_status
        ),
        p_reason
    );

    -- Record in audit_logs
    INSERT INTO audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        safe_metadata
    ) VALUES (
        v_actor_id,
        'ATTENDANCE_CORRECTION',
        'attendance_sessions',
        p_session_id::text,
        jsonb_build_object('reason', p_reason, 'status', p_new_status)
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Teacher Invitation Activation RPC
CREATE OR REPLACE FUNCTION activate_teacher_invitation(
    p_token TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_teacher_id UUID;
BEGIN
    SELECT * INTO v_invitation 
    FROM teacher_invitations 
    WHERE token = p_token AND used_at IS NULL AND expires_at > timezone('utc'::text, now());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already used invitation link';
    END IF;

    -- Create or update profile
    INSERT INTO profiles (id, full_name, email, role, account_status)
    VALUES (p_user_id, v_invitation.full_name, v_invitation.email, v_invitation.role, 'active')
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        account_status = 'active',
        updated_at = timezone('utc'::text, now());

    -- Create teacher record if role is teacher
    IF v_invitation.role = 'teacher' THEN
        INSERT INTO teachers (profile_id, staff_number, employment_status)
        VALUES (p_user_id, v_invitation.staff_number, 'active')
        ON CONFLICT (profile_id) DO UPDATE
        SET staff_number = EXCLUDED.staff_number, employment_status = 'active'
        RETURNING id INTO v_teacher_id;

        -- Assign class if specified
        IF v_invitation.class_id IS NOT NULL THEN
            INSERT INTO teacher_class_assignments (teacher_id, class_id, is_primary_class, assigned_by)
            VALUES (v_teacher_id, v_invitation.class_id, true, v_invitation.created_by)
            ON CONFLICT (teacher_id, class_id) DO NOTHING;
        END IF;
    END IF;

    -- Mark invitation as used
    UPDATE teacher_invitations
    SET used_at = timezone('utc'::text, now())
    WHERE id = v_invitation.id;

    -- Log activation
    INSERT INTO audit_logs (actor_profile_id, action, entity_type, entity_id, safe_metadata)
    VALUES (p_user_id, 'TEACHER_ACCOUNT_ACTIVATED', 'profiles', p_user_id::text, jsonb_build_object(
        'email', v_invitation.email,
        'staff_number', v_invitation.staff_number
    ));

    RETURN jsonb_build_object(
        'success', true,
        'full_name', v_invitation.full_name,
        'role', v_invitation.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. PRIVATE STORAGE BUCKET CONFIGURATION FOR EVIDENCE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'attendance-evidence',
    'attendance-evidence',
    false,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 5242880;

-- Storage bucket RLS policies:
CREATE POLICY "Allow authenticated teachers to upload attendance evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'attendance-evidence'
    AND auth.uid() IS NOT NULL
);

CREATE POLICY "Allow teacher and admins to view authorized evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'attendance-evidence'
    AND (
        -- Can view if owner or headmaster
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'headmaster'))
        -- Or if own folder/file
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);
