import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Edit3, X, Loader2 } from 'lucide-react';
import { AttendanceSession } from '../types/database';

interface AdminCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession | null;
  onSuccess: () => void;
}

export const AdminCorrectionModal: React.FC<AdminCorrectionModalProps> = ({
  isOpen,
  onClose,
  session,
  onSuccess,
}) => {
  const [newCheckInTime, setNewCheckInTime] = useState<string>('');
  const [newCheckOutTime, setNewCheckOutTime] = useState<string>('');
  const [newStatus, setNewStatus] = useState<'present' | 'late' | 'absent' | 'excused'>('present');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (session) {
      setNewStatus(session.attendance_status || 'present');
      setReason('');
      setErrorMsg(null);
      if (session.check_in_at) {
        const d = new Date(session.check_in_at);
        setNewCheckInTime(d.toTimeString().slice(0, 5));
      } else {
        setNewCheckInTime('06:00');
      }
      if (session.check_out_at) {
        const d = new Date(session.check_out_at);
        setNewCheckOutTime(d.toTimeString().slice(0, 5));
      } else {
        setNewCheckOutTime('');
      }
    }
  }, [session]);

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A valid justification/reason is mandatory for audit compliance.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Build ISO timestamps for the school date
      let checkInIso: string | null = null;
      if (newCheckInTime) {
        const [h, m] = newCheckInTime.split(':');
        const d = new Date(`${session.school_date}T00:00:00`);
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
        checkInIso = d.toISOString();
      }

      let checkOutIso: string | null = null;
      if (newCheckOutTime) {
        const [h, m] = newCheckOutTime.split(':');
        const d = new Date(`${session.school_date}T00:00:00`);
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
        checkOutIso = d.toISOString();
      }

      const { data, error } = await supabase.rpc('handle_admin_attendance_correction', {
        p_session_id: session.id,
        p_new_check_in: checkInIso,
        p_new_check_out: checkOutIso,
        p_new_status: newStatus,
        p_reason: reason.trim(),
      });

      if (error) {
        throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Correction error:', err);
      setErrorMsg(err.message || 'Failed to apply administrative correction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F8F8] px-4 py-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#C62828]" />
            <h3 className="text-sm font-bold text-[#202124]">Administrative Attendance Correction</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Immutable Audit Trail Notice</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Every modification is permanently logged with your user ID, reason, and original timestamps in the audit trail.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#202124] mb-1">Teacher</label>
            <input
              type="text"
              disabled
              value={session.teacher?.profile?.full_name || 'Staff Member'}
              className="w-full rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 py-2 text-[#667085]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#202124] mb-1">Check-In Time</label>
              <input
                type="time"
                value={newCheckInTime}
                onChange={(e) => setNewCheckInTime(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#202124] mb-1">Check-Out Time</label>
              <input
                type="time"
                value={newCheckOutTime}
                onChange={(e) => setNewCheckOutTime(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#202124] mb-1">Attendance Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
            >
              <option value="present">Present (On Time)</option>
              <option value="late">Late Arrival</option>
              <option value="excused">Excused Duty / Official Leave</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#202124] mb-1">
              Correction Justification / Reason <span className="text-[#C62828]">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Device failure during check-in, verified in person by Headmaster"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#C62828]"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-1.5 font-medium text-[#667085] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-1.5 font-bold text-white hover:bg-[#8E1B1B] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Logging Correction...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Audited Correction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
