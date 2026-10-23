import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { LogOut, Database, Clock, ShieldCheck, GraduationCap, School } from 'lucide-react';

interface HeaderProps {
  onOpenSupabaseConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabaseConfig }) => {
  const { user, profile, teacherRecord, schoolSettings, role, activeRoleView, setActiveRoleView, signOut, isSupabaseConnected } = useAuth();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const schoolName = schoolSettings?.school_name || 'StaffClock School Portal';

  const roleLabel =
    role === 'owner'
      ? 'School Owner / Admin'
      : role === 'headmaster'
      ? 'Headmaster'
      : role === 'teacher'
      ? 'Teacher'
      : 'Staff';

  const primaryClass = teacherRecord?.assigned_classes?.[0]?.class_name;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-6">
        {/* Left: School Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C62828] text-white shadow-xs">
            {schoolSettings?.logo_object_path ? (
              <img
                src={schoolSettings.logo_object_path}
                alt={schoolName}
                className="h-10 w-10 rounded-xl object-contain"
              />
            ) : (
              <School className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-[#202124] line-clamp-1 sm:text-base">
              {schoolName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#C62828] border border-red-200">
                {roleLabel}
              </span>
              {primaryClass && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#667085]">
                  <GraduationCap className="w-3 h-3 text-[#C62828]" />
                  {primaryClass}
                </span>
              )}
              {role === 'owner' && (
                <div className="hidden lg:flex items-center gap-1 ml-2 bg-gray-100 p-0.5 rounded-lg text-[10px] font-semibold">
                  <button
                    onClick={() => setActiveRoleView('owner')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      activeRoleView === 'owner'
                        ? 'bg-[#C62828] text-white shadow-xs'
                        : 'text-[#667085] hover:text-[#202124]'
                    }`}
                  >
                    Admin View
                  </button>
                  <button
                    onClick={() => setActiveRoleView('teacher')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      activeRoleView === 'teacher'
                        ? 'bg-[#C62828] text-white shadow-xs'
                        : 'text-[#667085] hover:text-[#202124]'
                    }`}
                  >
                    Teacher Portal
                  </button>
                  <button
                    onClick={() => setActiveRoleView('headmaster')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      activeRoleView === 'headmaster'
                        ? 'bg-[#C62828] text-white shadow-xs'
                        : 'text-[#667085] hover:text-[#202124]'
                    }`}
                  >
                    Headmaster View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Clock, PWA Install, User & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live digital clock */}
          <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-[#F8F8F8] px-2.5 py-1 text-xs font-mono font-semibold text-[#202124] border border-[#E5E7EB]">
            <Clock className="w-3.5 h-3.5 text-[#C62828]" />
            <span>{timeStr}</span>
          </div>

          {/* Supabase status indicator — icon only, animated, not clickable */}
          {onOpenSupabaseConfig && (
            <div
              role="status"
              aria-label={isSupabaseConnected ? 'Supabase Connected' : 'Supabase Not Connected'}
              title={isSupabaseConnected ? 'Supabase Connected' : 'Supabase Not Connected'}
              className={`relative flex select-none items-center rounded-lg border px-2 py-1.5 cursor-default ${
                isSupabaseConnected
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <Database
                className={`w-3.5 h-3.5 ${
                  isSupabaseConnected ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              {/* Live pulse animation */}
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    isSupabaseConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    isSupabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
            </div>
          )}

          {/* In-app PWA install button */}
          <PWAInstallButton />

          {/* User Profile & Sign Out */}
          {user && (
            <div className="flex items-center gap-2 pl-1 border-l border-[#E5E7EB]">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-[#202124] leading-none">
                  {profile?.full_name || user.email?.split('@')[0]}
                </p>
                {teacherRecord?.staff_number && (
                  <p className="text-[10px] text-[#667085] leading-none mt-1">
                    ID: {teacherRecord.staff_number}
                  </p>
                )}
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1 rounded-lg p-1.5 text-[#667085] hover:bg-red-50 hover:text-[#C62828] transition"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
