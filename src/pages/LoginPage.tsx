import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { School, Lock, Mail, ArrowRight, AlertCircle, Loader2, Key } from 'lucide-react';

interface LoginPageProps {
  onGoToActivation: () => void;
  onGoToSetup?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onGoToActivation,
  onGoToSetup,
}) => {
  const { signIn, schoolSettings, isSchoolConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const schoolName = schoolSettings?.school_name || 'StaffClock School Portal';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMsg('Invalid email or password. Please verify your credentials or activate your account via your invitation link.');
      } else {
        setErrorMsg(error.message || 'Failed to sign in');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C62828] text-white shadow-md">
            <School className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#202124]">
          {schoolName}
        </h2>
        <p className="mt-1 text-xs text-[#667085]">
          Teacher Check-In & Check-Out Management System
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-sm border border-[#E5E7EB] rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#202124] mb-1">
                Staff / Admin Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#667085]" />
                <input
                  type="email"
                  required
                  placeholder="teacher@school.edu.gh"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#202124] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#667085]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 p-2.5 text-[#B91C1C] font-semibold text-[11px] border border-red-200 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C62828] py-2.5 font-bold text-white shadow-xs hover:bg-[#8E1B1B] transition active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to School Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="pt-3 border-t border-[#E5E7EB] space-y-2 text-center text-xs">
              <button
                type="button"
                onClick={onGoToActivation}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-gray-50 py-2 font-semibold text-[#202124] hover:bg-gray-100 transition"
              >
                <Key className="w-3.5 h-3.5 text-[#C62828]" />
                <span>Have an Invite Link? Activate Account</span>
              </button>

              {onGoToSetup && isSchoolConfigured === false && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onGoToSetup}
                    className="text-[11px] font-medium text-[#667085] hover:text-[#C62828]"
                  >
                    School Administrator First-Time Setup →
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
