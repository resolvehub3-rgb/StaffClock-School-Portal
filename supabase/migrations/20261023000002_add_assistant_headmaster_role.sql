-- =============================================================================
-- ADD 'assistant_headmaster' ROLE (same live attendance dashboard as headmaster)
-- =============================================================================
-- The admin can now invite a Headmaster OR Assistant Headmaster from the
-- invite modal; both roles get the real-time leadership attendance monitor.
--
-- Run this BEFORE inviting an Assistant Headmaster - the role CHECK
-- constraint and RLS read policies are updated here.
--
-- Note: the invite-activation RPC already propagates teacher_invitations.role
-- into profiles.role, so activation needs no change. Non-teacher roles do not
-- get a teachers-table record (by design - they monitor, they don't check in).

-- -----------------------------------------------------------------------------
-- 1. Role CHECK constraints
-- -----------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'headmaster', 'assistant_headmaster', 'teacher'));

ALTER TABLE teacher_invitations DROP CONSTRAINT IF EXISTS teacher_invitations_role_check;
ALTER TABLE teacher_invitations
  ADD CONSTRAINT teacher_invitations_role_check
  CHECK (role IN ('teacher', 'headmaster', 'assistant_headmaster'));

-- -----------------------------------------------------------------------------
-- 2. RLS read policies: leadership (headmaster + assistant headmaster)
--    Recreated with the same names plus the new role in the IN list.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow users to read permitted profiles" ON profiles;
CREATE POLICY "Allow users to read permitted profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster')
    );

DROP POLICY IF EXISTS "Allow read on teachers" ON teachers;
CREATE POLICY "Allow read on teachers"
    ON teachers FOR SELECT
    TO authenticated
    USING (
        profile_id = auth.uid()
        OR get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster')
    );

DROP POLICY IF EXISTS "Allow read on class assignments" ON teacher_class_assignments;
CREATE POLICY "Allow read on class assignments"
    ON teacher_class_assignments FOR SELECT
    TO authenticated
    USING (
        teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
        OR get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster')
    );

DROP POLICY IF EXISTS "Allow read attendance sessions" ON attendance_sessions;
CREATE POLICY "Allow read attendance sessions"
    ON attendance_sessions FOR SELECT
    TO authenticated
    USING (
        teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
        OR get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster')
    );

DROP POLICY IF EXISTS "Allow read attendance events" ON attendance_events;
CREATE POLICY "Allow read attendance events"
    ON attendance_events FOR SELECT
    TO authenticated
    USING (
        actor_profile_id = auth.uid()
        OR get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster')
    );

DROP POLICY IF EXISTS "Allow owner and headmaster to view audit logs" ON audit_logs;
CREATE POLICY "Allow owner and headmaster to view audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (get_current_user_role() IN ('owner', 'headmaster', 'assistant_headmaster'));

-- -----------------------------------------------------------------------------
-- 3. Selfie evidence (private storage) readable by leadership for review
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow teacher and admins to view authorized evidence" ON storage.objects;
CREATE POLICY "Allow teacher and admins to view authorized evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'attendance-evidence'
    AND (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'headmaster', 'assistant_headmaster')
        )
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);
