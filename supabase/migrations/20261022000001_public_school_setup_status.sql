-- =============================================================================
-- PUBLIC SCHOOL SETUP STATUS (LOGIN PAGE)
-- =============================================================================
-- The login page is shown BEFORE authentication, but school_settings and
-- profiles are protected by RLS (authenticated read only). This
-- security-definer function lets anonymous visitors check whether the school
-- has already been set up (settings configured OR any user account created),
-- so the "School Administrator First-Time Setup" link can be hidden once the
-- school exists.
--
-- Always returns exactly one row. Exposes ONLY the school name and the two
-- setup flags - timetable, geofence coordinates, profile data and other
-- settings remain readable by authenticated users only.

-- Earlier versions of this function had a different return type; Postgres
-- requires dropping it before recreating with new OUT columns.
DROP FUNCTION IF EXISTS public.get_public_school_info();

CREATE OR REPLACE FUNCTION public.get_public_school_info()
RETURNS TABLE (school_name TEXT, is_configured BOOLEAN, has_accounts BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        (SELECT s.school_name FROM school_settings s LIMIT 1),
        COALESCE((SELECT s.is_configured FROM school_settings s LIMIT 1), false),
        EXISTS (SELECT 1 FROM profiles p);
$$;

REVOKE ALL ON FUNCTION public.get_public_school_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_school_info() TO anon, authenticated;
