import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase, uploadAttendanceSelfie } from '../lib/supabase';
import { AttendanceSession } from '../types/database';
import { LiveCountdownTrack } from '../components/LiveCountdownTrack';
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { LocationVerificationModal } from '../components/LocationVerificationModal';
import {
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  Calendar,
  AlertCircle,
  ShieldCheck,
  History,
  GraduationCap,
  Sparkles,
  Camera,
  Loader2,
} from 'lucide-react';

// TEMPORARY SWITCH: the school geofence (GPS) check is disabled "for now".
// Check-in/out skip straight to the live camera selfie (camera only - no
// gallery). Set back to true to re-enable GPS geofence verification.
const GEOFENCE_CHECK_ENABLED = false;

export const TeacherDashboard: React.FC = () => {
  const { user, profile, teacherRecord, schoolSettings } = useAuth();
  const supabase = getSupabase();

  // Attendance state
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(null);
  const [historyList, setHistoryList] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Workflow modals
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    distance: number;
  } | null>(null);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  // Checkout workflow
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [isCheckoutLocationOpen, setIsCheckoutLocationOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Live time for the large clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const schoolCoords = {
    latitude: Number(schoolSettings?.school_latitude || 5.6037),
    longitude: Number(schoolSettings?.school_longitude || -0.187),
  };
  const geofenceRadius = Number(schoolSettings?.geofence_radius_meters || 100);

  // Fetch today's session and historical sessions
  const loadAttendance = useCallback(async () => {
    if (!supabase || !teacherRecord) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Fetch Today's Session
      const { data: todayData, error: todayErr } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('teacher_id', teacherRecord.id)
        .eq('school_date', todayDate)
        .maybeSingle();

      if (todayErr && todayErr.code !== 'PGRST116') {
        console.error('Error fetching today attendance:', todayErr);
      } else {
        setTodaySession(todayData as AttendanceSession | null);
      }

      // 2. Fetch Past History
      const { data: historyData, error: histErr } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('teacher_id', teacherRecord.id)
        .order('school_date', { ascending: false })
        .limit(15);

      if (histErr) {
        console.error('Error fetching history:', histErr);
      } else if (historyData) {
        setHistoryList(historyData as AttendanceSession[]);
      }
    } catch (err: any) {
      console.error('Attendance fetch error:', err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, teacherRecord]);

  useEffect(() => {
    loadAttendance();

    // Setup Realtime subscription for this teacher's sessions
    if (supabase && teacherRecord) {
      const channel = supabase
        .channel(`teacher-attendance-${teacherRecord.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_sessions',
            filter: `teacher_id=eq.${teacherRecord.id}`,
          },
          () => {
            loadAttendance();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadAttendance, supabase, teacherRecord]);

  // Step 1: Start Check-In -> Camera directly while geofence is disabled
  const handleStartCheckIn = () => {
    setErrorMsg(null);
    setSuccessToast(null);
    if (GEOFENCE_CHECK_ENABLED) {
      setIsLocationModalOpen(true);
    } else {
      setIsCameraModalOpen(true);
    }
  };

  // Step 2: Location verified -> Open camera modal
  const handleLocationVerified = (coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    distance: number;
  }) => {
    setVerifiedLocation(coords);
    setIsLocationModalOpen(false);
    setIsCameraModalOpen(true);
  };

  // Step 3: Camera captured -> upload to private storage and call handle_check_in RPC
  const handleSelfieCaptured = async (imageBlob: Blob) => {
    if (!user || !supabase) return;
    setIsSubmittingCheckIn(true);
    setErrorMsg(null);

    try {
      // 1. Upload selfie to private storage bucket 'attendance-evidence'
      const { path: evidencePath, error: uploadErr } = await uploadAttendanceSelfie(user.id, imageBlob);
      if (uploadErr || !evidencePath) {
        throw new Error(`Selfie upload failed: ${uploadErr?.message || 'Storage error'}`);
      }

      // 2. Call server-side check-in RPC (location is NULL while geofence is off)
      const { data, error: rpcErr } = await supabase.rpc('handle_check_in', {
        p_latitude: verifiedLocation?.latitude ?? null,
        p_longitude: verifiedLocation?.longitude ?? null,
        p_accuracy: verifiedLocation?.accuracy ?? null,
        p_evidence_path: evidencePath,
      });

      if (rpcErr) {
        throw rpcErr;
      }

      setIsCameraModalOpen(false);
      const isLate = data?.status === 'late';
      setSuccessToast(
        isLate
          ? `Check-in recorded! (Recorded as Late by ${data.lateness_minutes} minutes)`
          : 'Check-in recorded successfully! On time.'
      );
      await loadAttendance();
    } catch (err: any) {
      console.error('Check-in submission failed:', err);
      setErrorMsg(err.message || 'Failed to submit check-in');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  // Checkout workflow
  const handleStartCheckout = () => {
    setErrorMsg(null);
    setIsCheckoutConfirmOpen(true);
  };

  // Runs the checkout RPC with optional GPS coords (null while geofence is off)
  const runCheckoutRPC = async (coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    distance: number;
  } | null) => {
    if (!supabase) return;
    setIsCheckoutLocationOpen(false);
    setIsSubmittingCheckout(true);
    setErrorMsg(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc('handle_check_out', {
        p_latitude: coords?.latitude ?? null,
        p_longitude: coords?.longitude ?? null,
        p_accuracy: coords?.accuracy ?? null,
      });

      if (rpcErr) {
        throw rpcErr;
      }

      setSuccessToast('Checked out successfully! Have a restful evening.');
      await loadAttendance();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Failed to complete checkout');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleConfirmCheckoutStep = () => {
    setIsCheckoutConfirmOpen(false);
    if (GEOFENCE_CHECK_ENABLED) {
      setIsCheckoutLocationOpen(true);
    } else {
      // Geofence disabled for now - checkout without GPS verification
      void runCheckoutRPC(null);
    }
  };

  const handleCheckoutLocationVerified = async (coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    distance: number;
  }) => {
    await runCheckoutRPC(coords);
  };

  const isCheckedIn = Boolean(todaySession?.check_in_at);
  const isCheckedOut = Boolean(todaySession?.check_out_at);

  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8F8F8] pb-12">
      <div className="mx-auto max-w-xl px-4 py-5 space-y-4">
        {/* Success Toast */}
        {successToast && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 text-xs font-semibold text-emerald-900 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Toast */}
        {errorMsg && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-300 p-3.5 text-xs font-semibold text-[#B91C1C] shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-700 hover:text-red-900 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Teacher Welcome & Class Header Card */}
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#667085]">Welcome back,</p>
              <h2 className="text-base font-bold text-[#202124] sm:text-lg">
                {profile?.full_name || 'Staff Member'}
              </h2>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#C62828] border border-red-200">
                Staff ID: {teacherRecord?.staff_number || 'N/A'}
              </span>
            </div>
          </div>

          {teacherRecord?.assigned_classes && teacherRecord.assigned_classes.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#667085] pt-2.5 border-t border-[#E5E7EB]">
              <GraduationCap className="w-4 h-4 text-[#C62828]" />
              <span>
                Assigned Classes:{' '}
                <strong className="text-[#202124]">
                  {teacherRecord.assigned_classes.map((c) => c.class_name).join(', ')}
                </strong>
              </span>
            </div>
          )}

          {!teacherRecord && profile?.role === 'owner' && (
            <div className="mt-3 rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Administrator Review Mode: You are previewing the mobile Teacher Duty Portal.
              </span>
            </div>
          )}
        </div>

        {/* Large Digital Clock & Date */}
        <div className="rounded-2xl bg-gradient-to-br from-[#C62828] to-[#8E1B1B] p-5 text-white shadow-md text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-red-100 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
          <div className="text-3xl font-extrabold tracking-tight sm:text-4xl font-mono">
            {formattedTime}
          </div>
          <p className="text-[11px] text-red-100 mt-1">
            School Hours: {schoolSettings?.opening_time || '06:00'} – {schoolSettings?.closing_time || '16:30'} ({schoolSettings?.timezone || 'Africa/Accra'})
          </p>
        </div>

        {/* Live School-Day Countdown Track (06:00 - 16:30) with Animated Walking Human Figure */}
        <LiveCountdownTrack
          openingTime={schoolSettings?.opening_time?.slice(0, 5) || '06:00'}
          closingTime={schoolSettings?.closing_time?.slice(0, 5) || '16:30'}
        />

        {/* Main Attendance Action Card */}
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 shadow-xs text-center space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 text-left">
            <div>
              <p className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider">Today's Status</p>
              <h3 className="text-sm font-bold text-[#202124]">
                {!isCheckedIn
                  ? 'Not Yet Reported on Duty'
                  : !isCheckedOut
                  ? 'Currently on Duty'
                  : 'Checked Out for the Day'}
              </h3>
            </div>
            <div>
              {!isCheckedIn ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Pending Arrival
                </span>
              ) : todaySession?.attendance_status === 'present' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  On Time
                </span>
              ) : todaySession?.attendance_status === 'late' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#C62828] border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 text-[#C62828]" />
                  Late (+{todaySession.lateness_minutes}m)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                  Checked In
                </span>
              )}
            </div>
          </div>

          {/* Action Button Section */}
          {!isCheckedIn ? (
            <div className="py-2">
              <button
                type="button"
                onClick={handleStartCheckIn}
                disabled={isLoading || isSubmittingCheckIn}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#C62828] py-4 text-base font-bold text-white shadow-lg hover:bg-[#8E1B1B] transition active:scale-98 focus:outline-none focus:ring-4 focus:ring-red-200"
              >
                <Camera className="w-5 h-5" />
                <span>Report on Duty</span>
              </button>
              <p className="mt-2 text-[11px] text-[#667085]">
                {GEOFENCE_CHECK_ENABLED
                  ? `Requires live camera selfie & school geofence verification within ${geofenceRadius}m.`
                  : 'Requires a live camera selfie — captured with your camera only (gallery uploads not allowed).'}
              </p>
            </div>
          ) : !isCheckedOut ? (
            <div className="space-y-3 py-1">
              <div className="rounded-xl bg-gray-50 p-3.5 border border-[#E5E7EB] text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Recorded Arrival:</span>
                  <span className="font-bold text-[#202124]">
                    {new Date(todaySession?.check_in_at!).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Punctuality:</span>
                  <span
                    className={`font-bold ${
                      todaySession?.attendance_status === 'present'
                        ? 'text-emerald-700'
                        : 'text-[#C62828]'
                    }`}
                  >
                    {todaySession?.attendance_status === 'present'
                      ? 'On Time (Within Grace Period)'
                      : `Late by ${todaySession?.lateness_minutes} min`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={isSubmittingCheckout}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#C62828] bg-white py-3 text-sm font-bold text-[#C62828] hover:bg-red-50 transition active:scale-98"
              >
                {isSubmittingCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Checkout...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Check Out</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Duty Completed for Today</span>
              </div>
              <div className="flex justify-between text-[#667085]">
                <span>Check-in:</span>
                <span className="font-semibold text-[#202124]">
                  {new Date(todaySession?.check_in_at!).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-[#667085]">
                <span>Check-out:</span>
                <span className="font-semibold text-[#202124]">
                  {new Date(todaySession?.check_out_at!).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Attendance History Section */}
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#C62828]" />
              <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wide">
                Recent Attendance History
              </h3>
            </div>
            <span className="text-[11px] text-[#667085]">{historyList.length} records</span>
          </div>

          <div className="divide-y divide-[#E5E7EB] mt-1">
            {historyList.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#667085]">
                <Clock className="mx-auto w-6 h-6 text-gray-300 mb-1" />
                <span>No past attendance records found yet.</span>
              </div>
            ) : (
              historyList.map((session) => (
                <div key={session.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#202124]">{session.school_date}</p>
                    <p className="text-[11px] text-[#667085]">
                      In:{' '}
                      {session.check_in_at
                        ? new Date(session.check_in_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—'}{' '}
                      | Out:{' '}
                      {session.check_out_at
                        ? new Date(session.check_out_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        session.attendance_status === 'present'
                          ? 'bg-emerald-100 text-emerald-800'
                          : session.attendance_status === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {session.attendance_status === 'present'
                        ? 'ON TIME'
                        : session.attendance_status === 'late'
                        ? `LATE (${session.lateness_minutes}m)`
                        : session.attendance_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Check-In Location Verification Modal */}
      <LocationVerificationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationVerified={handleLocationVerified}
        schoolCoords={schoolCoords}
        geofenceRadiusMeters={geofenceRadius}
        actionTitle="Camera Selfie Capture"
      />

      {/* Check-In Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleSelfieCaptured}
        isSubmitting={isSubmittingCheckIn}
      />

      {/* Checkout Confirmation Dialog */}
      {isCheckoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5E7EB]">
            <h3 className="text-sm font-bold text-[#202124]">Confirm Check-Out</h3>
            <p className="mt-2 text-xs text-[#667085]">
              {GEOFENCE_CHECK_ENABLED
                ? 'Checking out will conclude your attendance session for today. Fresh GPS verification will verify you are still on school premises.'
                : 'Checking out will conclude your attendance session for today.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsCheckoutConfirmOpen(false)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#667085] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckoutStep}
                className="rounded-lg bg-[#C62828] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#8E1B1B]"
              >
                {GEOFENCE_CHECK_ENABLED ? 'Verify & Check Out' : 'Check Out Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Location Verification Modal */}
      <LocationVerificationModal
        isOpen={isCheckoutLocationOpen}
        onClose={() => setIsCheckoutLocationOpen(false)}
        onLocationVerified={handleCheckoutLocationVerified}
        schoolCoords={schoolCoords}
        geofenceRadiusMeters={geofenceRadius}
        actionTitle="Submit Check-Out"
      />
    </div>
  );
};
