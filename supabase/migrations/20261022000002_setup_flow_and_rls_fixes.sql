-- =============================================================================
-- FIXES: FIRST-TIME SETUP FLOW & OWNER INSERTS
-- =============================================================================
-- The First-Time Setup page failed under RLS: a freshly signed-up user could
-- not INSERT into school_settings (no INSERT policy existed) or into profiles
-- (owner-only policy, and no profile row yet). This left half-created
-- accounts: a login with no profile role ("Staff" badge) and no settings row.
--
-- Fixes:
-- 1. Allows the owner to INSERT the school_settings row (single-row index
--    still enforces at most one row).
-- 2. Adds a SECURITY DEFINER RPC that performs the entire first-time setup
--    atomically, guarded so it only works while no owner account exists.

-- 1. Owner may insert the (single) school_settings row
DROP POLICY IF EXISTS "Allow owner insert on school_settings" ON school_settings;
CREATE POLICY "Allow owner insert on school_settings"
    ON school_settings FOR INSERT
    TO authenticated
    WITH CHECK (get_current_user_role() = 'owner');

-- 2. Atomic first-time setup RPC
DROP FUNCTION IF EXISTS public.complete_school_setup(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, INTEGER
);

CREATE FUNCTION public.complete_school_setup(
    p_admin_name TEXT,
    p_admin_email TEXT,
    p_school_name TEXT,
    p_timezone TEXT,
    p_opening_time TEXT,
    p_closing_time TEXT,
    p_grace_period_minutes INTEGER,
    p_school_latitude NUMERIC,
    p_school_longitude NUMERIC,
    p_geofence_radius_meters INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Complete account sign-up before running setup.';
    END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE role = 'owner') THEN
        RAISE EXCEPTION 'School setup has already been completed.';
    END IF;

    -- Create (or claim) the owner profile - normally blocked by RLS
    INSERT INTO profiles (id, full_name, email, role, account_status)
    VALUES (
        v_uid,
        COALESCE(NULLIF(trim(p_admin_name), ''), split_part(lower(trim(p_admin_email)), '@', 1)),
        lower(trim(p_admin_email)),
        'owner',
        'active'
    )
    ON CONFLICT (id) DO UPDATE
        SET role = 'owner',
            account_status = 'active',
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            updated_at = timezone('utc'::text, now());

    -- Create the single school settings row
    INSERT INTO school_settings (
        school_name,
        timezone,
        opening_time,
        closing_time,
        grace_period_minutes,
        school_latitude,
        school_longitude,
        geofence_radius_meters,
        is_configured
    )
    VALUES (
        COALESCE(NULLIF(trim(p_school_name), ''), 'My School'),
        COALESCE(NULLIF(trim(p_timezone), ''), 'Africa/Accra'),
        COALESCE(p_opening_time::time, '06:00:00'),
        COALESCE(p_closing_time::time, '16:30:00'),
        COALESCE(p_grace_period_minutes, 10),
        COALESCE(p_school_latitude, 5.6037),
        COALESCE(p_school_longitude, -0.187),
        COALESCE(p_geofence_radius_meters, 100),
        true
    )
    ON CONFLICT ((true)) DO UPDATE
        SET school_name = EXCLUDED.school_name,
            timezone = EXCLUDED.timezone,
            opening_time = EXCLUDED.opening_time,
            closing_time = EXCLUDED.closing_time,
            grace_period_minutes = EXCLUDED.grace_period_minutes,
            school_latitude = EXCLUDED.school_latitude,
            school_longitude = EXCLUDED.school_longitude,
            geofence_radius_meters = EXCLUDED.geofence_radius_meters,
            is_configured = true,
            updated_at = timezone('utc'::text, now());

    -- Audit record
    INSERT INTO audit_logs (actor_profile_id, action, entity_type, safe_metadata)
    VALUES (
        v_uid,
        'INITIAL_SCHOOL_SETUP_COMPLETED',
        'school_settings',
        jsonb_build_object(
            'school_name', p_school_name,
            'opening_time', p_opening_time,
            'closing_time', p_closing_time
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_school_setup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_school_setup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, INTEGER) TO authenticated;
