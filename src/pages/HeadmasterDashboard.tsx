import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { AttendanceSession, Teacher, SchoolClass } from '../types/database';
import { calculateAttendanceMetrics, generateCsvContent, AttendanceRecordExport } from '../utils/reports';
import { EvidenceReviewModal } from '../components/EvidenceReviewModal';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LogOut,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export const HeadmasterDashboard: React.FC = () => {
  const { schoolSettings, profile } = useAuth();
  const supabase = getSupabase();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Evidence review modal
  const [reviewSession, setReviewSession] = useState<AttendanceSession | null>(null);

  // opts.silent = background refresh (realtime event / manual refresh button):
  // data reloads in place with only the refresh button spinning - no page flash
  const loadHeadmasterData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!supabase) return;
    const silent = opts?.silent === true;
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      // 1. Fetch Teachers
      const { data: teacherData, error: teachErr } = await supabase
        .from('teachers')
        .select(`
          id,
          profile_id,
          staff_number,
          employment_status,
          profile:profiles(full_name, email),
          teacher_class_assignments(
            classes(id, class_name)
          )
        `);

      if (teachErr) throw teachErr;
      setTeachers((teacherData as any) || []);

      // 2. Fetch Classes
      const { data: classData } = await supabase.from('classes').select('*');
      setClasses((classData as SchoolClass[]) || []);

      // 3. Fetch Attendance Sessions for Selected Date
      const { data: sessionData, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select(`
          *,
          teacher:teachers(
            id,
            staff_number,
            profile:profiles(full_name, email),
            teacher_class_assignments(classes(id, class_name))
          )
        `)
        .eq('school_date', selectedDate);

      if (sessErr) throw sessErr;
      setSessions((sessionData as AttendanceSession[]) || []);
    } catch (err: any) {
      console.error('Headmaster load error:', err);
      setErrorMsg(err.message || 'Failed to load attendance records');
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    loadHeadmasterData();

    // Realtime: teacher check-ins/check-outs reload the monitor in place
    if (supabase) {
      const refresh = () => {
        void loadHeadmasterData({ silent: true });
      };
      const channel = supabase
        .channel('headmaster-live-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_sessions' },
          refresh
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teachers' },
          refresh
        )
        .subscribe((status) => {
          setIsLive(String(status) === 'SUBSCRIBED');
        });

      return () => {
        setIsLive(false);
        supabase.removeChannel(channel);
      };
    }
  }, [loadHeadmasterData, supabase]);

  // Fallback: while the realtime channel is not connected, quietly re-sync
  // every 20s so the monitor still updates without a manual page refresh
  useEffect(() => {
    if (isLive) return;
    const timer = setInterval(() => {
      void loadHeadmasterData({ silent: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [isLive, loadHeadmasterData]);

  const activeTeachersCount = teachers.filter((t) => t.employment_status === 'active').length;
  const metrics = calculateAttendanceMetrics(
    activeTeachersCount,
    sessions.map((s) => ({
      attendance_status: s.attendance_status,
      check_in_at: s.check_in_at,
      check_out_at: s.check_out_at,
    }))
  );

  const filteredSessions = sessions.filter((s) => {
    const teacherName = s.teacher?.profile?.full_name?.toLowerCase() || '';
    const staffNum = s.teacher?.staff_number?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || teacherName.includes(q) || staffNum.includes(q);
    const matchesStatus = !statusFilter || s.attendance_status === statusFilter;
    const teacherClasses = (s.teacher as any)?.teacher_class_assignments?.map((a: any) => a.classes?.id) || [];
    const matchesClass = !classFilter || teacherClasses.includes(classFilter);
    return matchesSearch && matchesStatus && matchesClass;
  });

  const handleExportCsv = () => {
    const exportData: AttendanceRecordExport[] = sessions.map((s) => {
      const assignedClass =
        (s.teacher as any)?.teacher_class_assignments?.[0]?.classes?.class_name || 'Unassigned';
      return {
        teacherName: s.teacher?.profile?.full_name || 'Staff Member',
        staffNumber: s.teacher?.staff_number || 'N/A',
        className: assignedClass,
        schoolDate: s.school_date,
        checkInTime: s.check_in_at
          ? new Date(s.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'Not checked in',
        attendanceStatus: s.attendance_status === 'present' ? 'On Time' : s.attendance_status.toUpperCase(),
        latenessMinutes: s.lateness_minutes || 0,
        checkOutTime: s.check_out_at
          ? new Date(s.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'Pending',
        checkoutStatus: s.checkout_status || 'pending',
      };
    });

    const csvContent = generateCsvContent(exportData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Headmaster_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8F8F8] pb-12">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C62828]" />
              <h2 className="text-lg font-bold text-[#202124]">
                {profile?.role === 'assistant_headmaster' ? 'Assistant Headmaster' : 'Headmaster'} Attendance Monitor
              </h2>
            </div>
            <p className="text-xs text-[#667085]">
              Realtime school punctuality, photo evidence verification, and daily staff monitoring.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#202124] shadow-xs"
            />
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#8E1B1B]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Live auto-update status + manual refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {isLive && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isLive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className={isLive ? 'text-emerald-700' : 'text-amber-700'}>
                {isLive ? 'Live — updating automatically' : 'Offline — syncing every 20s'}
              </span>
            </span>
            <span className="font-normal text-[#667085]">
              {lastUpdated ? `Updated ${lastUpdated}` : isLoading ? 'Loading…' : ''}
            </span>
          </div>
          <button
            onClick={() => loadHeadmasterData({ silent: true })}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-[#667085] shadow-xs hover:bg-gray-100 hover:text-[#202124] disabled:opacity-60"
            title={isRefreshing ? 'Refreshing data…' : 'Refresh data'}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        {/* Overview KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
            <span className="text-xs font-semibold text-[#667085]">Total Teachers</span>
            <div className="mt-1 text-2xl font-bold text-[#202124]">{metrics.totalActiveTeachers}</div>
          </div>
          <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
            <span className="text-xs font-semibold text-emerald-800">Checked In (On Time)</span>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{metrics.onTimeCount}</div>
          </div>
          <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
            <span className="text-xs font-semibold text-amber-800">Late Arrivals</span>
            <div className="mt-1 text-2xl font-bold text-amber-700">{metrics.lateCount}</div>
          </div>
          <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
            <span className="text-xs font-semibold text-red-800">Not Checked In</span>
            <div className="mt-1 text-2xl font-bold text-[#B91C1C]">{metrics.notCheckedInCount}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 gap-2.5 rounded-xl bg-white p-3.5 border border-[#E5E7EB] shadow-xs sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#667085]" />
            <input
              type="text"
              placeholder="Search teacher by name or staff ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-2.5 py-1.5 text-xs text-[#202124]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs text-[#202124]"
            >
              <option value="">All Attendance Statuses</option>
              <option value="present">Present (On Time)</option>
              <option value="late">Late Arrival</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>

          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs text-[#202124]"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Attendance Table */}
        <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#667085]">
              <FileText className="mx-auto w-8 h-8 text-gray-300 mb-2" />
              <p className="font-bold text-[#202124]">No matching records found for {selectedDate}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F8F8] border-b border-[#E5E7EB] text-[#667085]">
                    <th className="py-3 px-4 font-semibold">Teacher Name</th>
                    <th className="py-3 px-3 font-semibold">Staff ID</th>
                    <th className="py-3 px-3 font-semibold">Class</th>
                    <th className="py-3 px-3 font-semibold">Check-In</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">Check-Out</th>
                    <th className="py-3 px-4 font-semibold text-right">Selfie Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-[#202124]">
                        {session.teacher?.profile?.full_name || 'Staff Member'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#667085]">
                        {session.teacher?.staff_number || 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-[#202124]">
                        {(session.teacher as any)?.teacher_class_assignments?.[0]?.classes?.class_name || '—'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#202124]">
                        {session.check_in_at
                          ? new Date(session.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                            ? `LATE (+${session.lateness_minutes}m)`
                            : session.attendance_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#667085]">
                        {session.check_out_at
                          ? new Date(session.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                          : 'Pending'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {session.check_in_evidence_path ? (
                          <button
                            onClick={() => setReviewSession(session)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#202124] hover:bg-gray-100"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C62828]" />
                            <span>View Photo</span>
                          </button>
                        ) : (
                          <span className="text-[#667085]">No photo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Evidence Review Modal */}
      <EvidenceReviewModal
        isOpen={!!reviewSession}
        onClose={() => setReviewSession(null)}
        evidencePath={reviewSession?.check_in_evidence_path || null}
        teacherName={reviewSession?.teacher?.profile?.full_name || 'Staff Member'}
        schoolDate={reviewSession?.school_date || ''}
        checkInTime={
          reviewSession?.check_in_at
            ? new Date(reviewSession.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
            : null
        }
        status={reviewSession?.attendance_status || ''}
        distanceMeters={reviewSession?.check_in_geofence_distance_meters}
      />
    </div>
  );
};
