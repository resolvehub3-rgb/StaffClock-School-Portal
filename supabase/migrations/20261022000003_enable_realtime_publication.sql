-- =============================================================================
-- ENABLE REALTIME FOR TABLES THE APP SUBSCRIBES TO
-- =============================================================================
-- Supabase only delivers postgres_changes events for tables that are members
-- of the 'supabase_realtime' publication. Tables created by plain SQL
-- migrations are NOT added automatically, so live dashboards (attendance,
-- staff activation, school settings) would silently never update.
--
-- Subscriptions in the app:
--   attendance_sessions  -> Admin / Headmaster / Teacher dashboards
--   teachers             -> Admin staff list (teacher activates account)
--   teacher_invitations  -> Admin staff list (invite created / used)
--   school_settings      -> AuthContext (settings changed)
--
-- Realtime delivery remains RLS-filtered: clients only receive rows their
-- role is allowed to read.

DO $$
DECLARE
    t TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY ARRAY[
        'attendance_sessions',
        'teachers',
        'teacher_invitations',
        'school_settings'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
