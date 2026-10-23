import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { Profile, SchoolSettings, Teacher, UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  teacherRecord: Teacher | null;
  schoolSettings: SchoolSettings | null;
  isSchoolConfigured: boolean | null;
  role: UserRole | null;
  activeRoleView: UserRole | null;
  setActiveRoleView: (role: UserRole) => void;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSchoolSettings: (updated: Partial<SchoolSettings>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local flag written when first-time setup completes on this device.
// Used as a fallback when the public setup-status RPC is unavailable.
export const SCHOOL_SETUP_FLAG_KEY = 'staffclock_school_setup_complete';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teacherRecord, setTeacherRecord] = useState<Teacher | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLive, setSettingsLive] = useState<boolean>(false);
  const [isSchoolConfigured, setIsSchoolConfigured] = useState<boolean | null>(null);
  const [activeRoleView, setActiveRoleView] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { isConfigured } = getSupabaseConfig();
  const supabase = getSupabase();

  const fetchSchoolSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching school settings:', error);
      } else if (data) {
        setSchoolSettings(data as SchoolSettings);
      }
    } catch (err) {
      console.error('Error fetching school settings:', err);
    }
  }, [supabase]);

  // Pre-login check: has the school been set up (settings configured or an
  // owner account created)? Uses the security-definer RPC
  // get_public_school_info (migration 20261022000001) because school_settings
  // and profiles are not readable before authentication. Falls back to a
  // local flag set when setup completes on this device. Stays null when the
  // status cannot be determined.
  const fetchSchoolSetupStatus = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_public_school_info');
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        setIsSchoolConfigured(!!row && (!!row.is_configured || row.has_accounts === true));
        return;
      }
      console.warn('School setup status RPC unavailable:', error.message);
    } catch (err) {
      console.warn('School setup status check failed:', err);
    }
    // Fallback: local flag written when setup completes on this device
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SCHOOL_SETUP_FLAG_KEY) === '1') {
      setIsSchoolConfigured(true);
    }
  }, [supabase]);

  const fetchProfileAndTeacher = useCallback(async (currentUserId: string) => {
    if (!supabase) return;
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError(profileError.message);
        return;
      }

      if (profileData) {
        setProfile(profileData as Profile);
        setActiveRoleView((prev) => prev || (profileData.role as UserRole));

        // 2. If Teacher, fetch teacher record & class assignments
        if (profileData.role === 'teacher') {
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select(`
              id,
              profile_id,
              staff_number,
              employment_status,
              created_at,
              updated_at,
              teacher_class_assignments(
                id,
                class_id,
                is_primary_class,
                classes(id, class_name, class_level)
              )
            `)
            .eq('profile_id', currentUserId)
            .maybeSingle();

          if (teacherError) {
            console.error('Error fetching teacher record:', teacherError);
          } else if (teacherData) {
            const assigned = (teacherData as any).teacher_class_assignments?.map(
              (tca: any) => tca.classes
            ) || [];

            setTeacherRecord({
              id: teacherData.id,
              profile_id: teacherData.profile_id,
              staff_number: teacherData.staff_number,
              employment_status: teacherData.employment_status,
              created_at: teacherData.created_at,
              updated_at: teacherData.updated_at,
              assigned_classes: assigned,
            });
          }
        } else {
          setTeacherRecord(null);
        }
      } else {
        setProfile(null);
        setTeacherRecord(null);
      }
    } catch (err: any) {
      console.error('Failed to load profile data:', err);
      setError(err.message);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function initializeAuth() {
      try {
        const { data: sessionData } = await supabase!.auth.getSession();
        if (!isMounted) return;

        setSession(sessionData?.session || null);
        setUser(sessionData?.session?.user || null);

        await fetchSchoolSettings();
        await fetchSchoolSetupStatus();

        if (sessionData?.session?.user) {
          await fetchProfileAndTeacher(sessionData.session.user.id);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initializeAuth();

    // Listen to Auth State Changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
          await fetchProfileAndTeacher(currentSession.user.id);
        } else {
          setProfile(null);
          setTeacherRecord(null);
        }
        setIsLoading(false);
      }
    );

    // Realtime: when the admin saves School Operating Settings, every open
    // portal (admin / teacher / headmaster) applies the new row instantly -
    // no page refresh needed on the staff portal
    const settingsChannel = supabase
      .channel('public:school_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'school_settings' },
        (payload) => {
          const row = payload.new as SchoolSettings | undefined;
          // Ignore DELETE events (payload.new is an empty object there)
          if (row && Object.keys(row).length > 0) {
            console.info('[StaffClock] Live school settings update received');
            setSchoolSettings(row);
          }
        }
      )
      .subscribe((status) => {
        console.info('[StaffClock] Settings live channel:', String(status));
        setSettingsLive(String(status) === 'SUBSCRIBED');
      });

    return () => {
      isMounted = false;
      setSettingsLive(false);
      authListener?.subscription?.unsubscribe();
      supabase.removeChannel(settingsChannel);
    };
  }, [supabase, fetchSchoolSettings, fetchSchoolSetupStatus, fetchProfileAndTeacher]);

  // Fallback: while the realtime channel is not connected, quietly re-sync
  // school settings every 20s so the staff portal still updates without a
  // manual page refresh
  useEffect(() => {
    if (settingsLive) return;
    const timer = setInterval(() => {
      console.info('[StaffClock] Settings fallback sync (realtime not connected)');
      void fetchSchoolSettings();
    }, 20000);
    return () => clearInterval(timer);
  }, [settingsLive, fetchSchoolSettings]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase client not initialized') };
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return { error };
      }
      if (data.user) {
        await fetchProfileAndTeacher(data.user.id);
      }
      return { error: null };
    } catch (err: any) {
      setError(err.message);
      return { error: err };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setTeacherRecord(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndTeacher(user.id);
    }
  };

  const refreshSettings = async () => {
    await Promise.all([fetchSchoolSettings(), fetchSchoolSetupStatus()]);
  };

  const updateSchoolSettings = async (updated: Partial<SchoolSettings>) => {
    if (!supabase) return { error: new Error('Supabase client not initialized') };
    try {
      if (!schoolSettings?.id) {
        // Insert first row if doesn't exist
        const { data, error } = await supabase
          .from('school_settings')
          .insert({ ...updated, is_configured: true })
          .select()
          .single();
        if (error) return { error };
        setSchoolSettings(data as SchoolSettings);
      } else {
        const { data, error } = await supabase
          .from('school_settings')
          .update({ ...updated, updated_at: new Date().toISOString() })
          .eq('id', schoolSettings.id)
          .select()
          .single();
        if (error) return { error };
        setSchoolSettings(data as SchoolSettings);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        teacherRecord,
        schoolSettings,
        isSchoolConfigured,
        role: profile?.role || null,
        activeRoleView: activeRoleView || profile?.role || null,
        setActiveRoleView,
        isLoading,
        isSupabaseConnected: isConfigured && !!supabase,
        error,
        signIn,
        signOut,
        refreshProfile,
        refreshSettings,
        updateSchoolSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
