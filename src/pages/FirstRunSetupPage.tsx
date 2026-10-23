import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { SCHOOL_SETUP_FLAG_KEY } from '../context/AuthContext';
import { friendlyGeolocationError } from '../utils/geofence';
import { School, MapPin, Clock, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { GeofenceMapPicker } from '../components/GeofenceMapPicker';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface FirstRunSetupPageProps {
  onSetupComplete: () => void;
  onGoToLogin: () => void;
}

export const FirstRunSetupPage: React.FC<FirstRunSetupPageProps> = ({
  onSetupComplete,
  onGoToLogin,
}) => {
  const supabase = getSupabase();

  const [schoolName, setSchoolName] = useState('Accra Senior High Model School');
  const [timezone, setTimezone] = useState('Africa/Accra');
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('16:30');
  const [gracePeriod, setGracePeriod] = useState<number>(10);
  const [latitude, setLatitude] = useState<number>(5.6037);
  const [longitude, setLongitude] = useState<number>(-0.187);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);

  // Administrator Account
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
        },
        (err) => alert(`Could not capture location: ${friendlyGeolocationError(err.code, err.message)}`),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured yet. Please configure Supabase keys first.');
      return;
    }

    if (adminPassword.length < 6) {
      setErrorMsg('Account password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Sign up / Create Owner Auth User
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Could not create the school account.');
      if (!authData.session) {
        throw new Error(
          'Email confirmation is required before setup can finish. Confirm the email address, then sign in.'
        );
      }

      // 2. Provision the school and owner account atomically via a
      // SECURITY DEFINER RPC - direct table inserts are blocked by RLS
      // for freshly created accounts.
      const { error: setupErr } = await supabase.rpc('complete_school_setup', {
        p_admin_name: adminName.trim(),
        p_admin_email: adminEmail.trim(),
        p_school_name: schoolName.trim(),
        p_timezone: timezone,
        p_opening_time: `${openingTime}:00`,
        p_closing_time: `${closingTime}:00`,
        p_grace_period_minutes: gracePeriod,
        p_school_latitude: latitude,
        p_school_longitude: longitude,
        p_geofence_radius_meters: geofenceRadius,
      });

      if (setupErr) throw setupErr;

      // 3. Remember on this device that setup is complete (hides the setup
      // link on the login page even if the public RPC is unavailable)
      try {
        localStorage.setItem(SCHOOL_SETUP_FLAG_KEY, '1');
      } catch {
        /* storage unavailable - ignore */
      }

      onSetupComplete();
    } catch (err: any) {
      console.error('Initial setup error:', err);
      setErrorMsg(err.message || 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C62828] text-white shadow-md">
            <School className="w-8 h-8" />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-[#202124]">School Initial Setup</h1>
          <p className="mt-1 text-xs text-[#667085]">
            Configure your school's official timetable, geofence, and account details.
          </p>
        </div>

        <form onSubmit={handleCompleteSetup} className="rounded-2xl bg-white border border-[#E5E7EB] p-6 shadow-sm space-y-5 text-xs">
          {/* Section 1: School Identity */}
          <div>
            <h3 className="text-sm font-bold text-[#202124] border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5">
              <School className="w-4 h-4 text-[#C62828]" />
              <span>1. School Identity & Timetable</span>
            </h3>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">Official School Name</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:ring-2 focus:ring-[#C62828]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Timezone</label>
                  <input
                    type="text"
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Opening Time (06:00)</label>
                  <input
                    type="time"
                    required
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Closing Time (16:30)</label>
                  <input
                    type="time"
                    required
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">Lateness Grace Period (Minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  required
                  value={gracePeriod}
                  onChange={(e) => setGracePeriod(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                />
                <p className="text-[11px] text-[#667085] mt-1">
                  Check-ins before {openingTime} + {gracePeriod}m are considered On Time.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: School Geofence */}
          <div>
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#C62828]" />
                <span>2. School Location & Geofence</span>
              </h3>
              <button
                type="button"
                onClick={handleUseLocation}
                className="rounded-lg border border-[#E5E7EB] bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-[#C62828] hover:bg-gray-100"
              >
                Use Device GPS Coordinates
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202124] mb-1">Radius (Meters)</label>
                <input
                  type="number"
                  min={20}
                  max={2000}
                  required
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(parseInt(e.target.value, 10) || 100)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                />
              </div>
            </div>

            <div className="mt-3">
              <GeofenceMapPicker
                latitude={latitude}
                longitude={longitude}
                radiusMeters={geofenceRadius}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                onRadiusChange={setGeofenceRadius}
              />
            </div>
          </div>

          {/* Section 3: School Account */}
          <div>
            <h3 className="text-sm font-bold text-[#202124] border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C62828]" />
              <span>3. School Account Details</span>
            </h3>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kwame Adjei (Proprietor)"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Account Email</label>
                  <input
                    type="email"
                    required
                    placeholder="school@school.edu.gh"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 text-[#B91C1C] border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#C62828] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onGoToLogin}
              className="text-xs text-[#667085] hover:text-[#202124]"
            >
              Cancel and Return to Sign In
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-[#C62828] px-6 py-2.5 font-bold text-white shadow-xs hover:bg-[#8E1B1B] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Provisioning School...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Setup & Launch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PWA install prompt for first-time users who haven't installed the app yet */}
      <div className="mt-4 flex justify-center">
        <PWAInstallButton />
      </div>
    </div>
  );
};
