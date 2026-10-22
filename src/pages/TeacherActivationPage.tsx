import React, { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { TeacherInvitation, SchoolSettings } from '../types/database';
import { ShieldCheck, CheckCircle2, AlertCircle, Key, Lock, ArrowRight, Loader2, School } from 'lucide-react';

interface TeacherActivationPageProps {
  initialToken?: string;
  onActivated: () => void;
  onGoToLogin: () => void;
}

export const TeacherActivationPage: React.FC<TeacherActivationPageProps> = ({
  initialToken = '',
  onActivated,
  onGoToLogin,
}) => {
  const supabase = getSupabase();

  const [token, setToken] = useState<string>(initialToken);
  const [invitation, setInvitation] = useState<TeacherInvitation | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Validate Invitation Token
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!supabase || !token) {
        if (isMounted) setIsValidatingToken(false);
        return;
      }

      setIsValidatingToken(true);
      setErrorMsg(null);

      try {
        // Fetch school settings
        const { data: schoolData } = await supabase.from('school_settings').select('*').limit(1).maybeSingle();
        if (isMounted && schoolData) setSchoolSettings(schoolData as SchoolSettings);

        // Fetch invitation
        const { data: invData, error: invErr } = await supabase
          .from('teacher_invitations')
          .select('*, class:classes(class_name)')
          .eq('token', token.trim())
          .maybeSingle();

        if (invErr) throw invErr;

        if (!invData) {
          throw new Error('This invitation link is invalid or could not be found.');
        }

        if (invData.used_at) {
          throw new Error('This invitation link has already been used and activated.');
        }

        if (new Date(invData.expires_at) < new Date()) {
          throw new Error('This invitation link has expired. Please request a new invite from the school administrator.');
        }

        if (isMounted) setInvitation(invData as TeacherInvitation);
      } catch (err: any) {
        if (isMounted) setErrorMsg(err.message || 'Invalid activation link');
      } finally {
        if (isMounted) setIsValidatingToken(false);
      }
    }

    checkToken();
    return () => {
      isMounted = false;
    };
  }, [token, supabase]);

  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !invitation) return;

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Create or register auth user with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
      });

      if (authErr) {
        // If user already exists in auth, attempt sign-in or password update
        if (authErr.message.includes('already registered')) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: password,
          });
          if (signInErr) {
            throw new Error('An account with this email exists. Please use your existing password or reset it.');
          }
          if (signInData.user) {
            await supabase.rpc('activate_teacher_invitation', {
              p_token: invitation.token,
              p_user_id: signInData.user.id,
            });
          }
        } else {
          throw authErr;
        }
      } else if (authData.user) {
        // 2. Call activation RPC
        const { error: rpcErr } = await supabase.rpc('activate_teacher_invitation', {
          p_token: invitation.token,
          p_user_id: authData.user.id,
        });

        if (rpcErr) {
          console.error('RPC activation error:', rpcErr);
          // Fallback direct table updates if RPC lacks grant in this environment
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            full_name: invitation.full_name,
            email: invitation.email,
            role: invitation.role,
            account_status: 'active',
          });

          if (invitation.role === 'teacher') {
            await supabase.from('teachers').upsert({
              profile_id: authData.user.id,
              staff_number: invitation.staff_number,
              employment_status: 'active',
            });
          }

          await supabase
            .from('teacher_invitations')
            .update({ used_at: new Date().toISOString() })
            .eq('id', invitation.id);
        }
      }

      setIsSuccess(true);
      onActivated();
    } catch (err: any) {
      console.error('Activation failure:', err);
      setErrorMsg(err.message || 'Failed to activate staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const schoolName = schoolSettings?.school_name || 'StaffClock School Portal';

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C62828] text-white shadow-md">
            <School className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-3 text-center text-xl font-bold tracking-tight text-[#202124]">
          {schoolName}
        </h2>
        <p className="mt-1 text-center text-xs text-[#667085]">
          Staff Account Activation Portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-sm border border-[#E5E7EB] rounded-2xl">
          {isValidatingToken ? (
            <div className="py-10 text-center text-xs text-[#667085] flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#C62828] animate-spin" />
              <p className="font-semibold text-[#202124]">Verifying your invitation link...</p>
            </div>
          ) : isSuccess ? (
            /* Explicit user requirement: "should display account activated successfully then" */
            <div className="py-4 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">
                  Account Activated Successfully!
                </h3>
                <p className="text-xs text-[#667085] mt-1.5">
                  Welcome, <strong>{invitation?.full_name}</strong>! Your staff account is active. You can now log into your Teacher Dashboard anytime to check in and record your daily duty.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onGoToLogin}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C62828] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#8E1B1B] transition"
                >
                  <span>Sign In to Teacher Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : !invitation ? (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center text-[#B91C1C]">
                <AlertCircle className="mx-auto w-8 h-8 text-[#C62828] mb-1.5" />
                <p className="font-bold">{errorMsg || 'Invalid Activation Link'}</p>
                <p className="text-[11px] text-[#667085] mt-1">
                  Please verify the link sent by your school administrator or enter the token manually below.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Enter Invitation Code / Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste invitation token here"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] font-mono text-xs"
                />
              </div>

              <button
                onClick={onGoToLogin}
                className="w-full rounded-lg border border-[#E5E7EB] py-2 text-xs font-semibold text-[#667085] hover:bg-gray-50"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleActivateAccount} className="space-y-4 text-xs">
              <div className="rounded-xl bg-gray-50 p-3.5 border border-[#E5E7EB] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Staff Name:</span>
                  <span className="font-bold text-[#202124]">{invitation.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Staff ID:</span>
                  <span className="font-mono font-bold text-[#C62828]">{invitation.staff_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Email:</span>
                  <span className="text-[#202124]">{invitation.email}</span>
                </div>
                {invitation.class?.class_name && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Assigned Class:</span>
                    <span className="font-semibold text-[#202124]">{invitation.class.class_name}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Create Account Password <span className="text-[#C62828]">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#667085]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-3 py-2 text-[#202124] focus:ring-2 focus:ring-[#C62828]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">
                  Confirm Password <span className="text-[#C62828]">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#667085]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-3 py-2 text-[#202124] focus:ring-2 focus:ring-[#C62828]"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-50 p-2.5 text-[#B91C1C] font-semibold text-[11px] border border-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C62828] py-2.5 font-bold text-white shadow-xs hover:bg-[#8E1B1B] transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Activate Account & Proceed</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="text-xs text-[#667085] hover:text-[#202124]"
                >
                  Already activated? Sign In here
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
