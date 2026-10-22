import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { AttendanceSession, Teacher, SchoolClass, AuditLogItem, TeacherInvitation } from '../types/database';
import { calculateAttendanceMetrics, generateCsvContent, AttendanceRecordExport } from '../utils/reports';
import { InviteTeacherModal } from '../components/InviteTeacherModal';
import { EvidenceReviewModal } from '../components/EvidenceReviewModal';
import { AdminCorrectionModal } from '../components/AdminCorrectionModal';
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
  Plus,
  Settings,
  Shield,
  Eye,
  Edit,
  GraduationCap,
  MapPin,
  RefreshCw,
  FileText,
  UserX,
  UserCheck,
  Check,
  Copy,
  Share2,
  LayoutDashboard,
  Radio,
  FileDown,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

type AdminTabId = 'overview' | 'attendance' | 'teachers' | 'classes' | 'reports' | 'settings' | 'audit';

interface NavItem {
  id: AdminTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview & Stats', icon: LayoutDashboard },
  { id: 'attendance', label: 'Live Attendance Monitor', icon: Radio },
  { id: 'teachers', label: 'Teacher Staff List', icon: Users },
  { id: 'classes', label: 'Class Management', icon: GraduationCap },
  { id: 'reports', label: 'Reports & Export', icon: FileDown },
  { id: 'settings', label: 'School Settings', icon: Settings },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
];

export const AdminDashboard: React.FC = () => {
  const { schoolSettings, updateSchoolSettings } = useAuth();
  const supabase = getSupabase();

  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Operational Data
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeacherInvitation[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [reviewSession, setReviewSession] = useState<AttendanceSession | null>(null);
  const [correctionSession, setCorrectionSession] = useState<AttendanceSession | null>(null);

  // Class Management State
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('');

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    school_name: schoolSettings?.school_name || '',
    timezone: schoolSettings?.timezone || 'Africa/Accra',
    opening_time: schoolSettings?.opening_time || '06:00:00',
    closing_time: schoolSettings?.closing_time || '16:30:00',
    grace_period_minutes: schoolSettings?.grace_period_minutes ?? 10,
    school_latitude: schoolSettings?.school_latitude ?? 5.6037,
    school_longitude: schoolSettings?.school_longitude ?? -0.187,
    geofence_radius_meters: schoolSettings?.geofence_radius_meters ?? 100,
    max_accuracy_threshold_meters: schoolSettings?.max_accuracy_threshold_meters ?? 100,
    checkout_reminder_enabled: schoolSettings?.checkout_reminder_enabled ?? true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  useEffect(() => {
    if (schoolSettings) {
      setSettingsForm({
        school_name: schoolSettings.school_name || '',
        timezone: schoolSettings.timezone || 'Africa/Accra',
        opening_time: schoolSettings.opening_time || '06:00:00',
        closing_time: schoolSettings.closing_time || '16:30:00',
        grace_period_minutes: schoolSettings.grace_period_minutes ?? 10,
        school_latitude: schoolSettings.school_latitude ?? 5.6037,
        school_longitude: schoolSettings.school_longitude ?? -0.187,
        geofence_radius_meters: schoolSettings.geofence_radius_meters ?? 100,
        max_accuracy_threshold_meters: schoolSettings.max_accuracy_threshold_meters ?? 100,
        checkout_reminder_enabled: schoolSettings.checkout_reminder_enabled ?? true,
      });
    }
  }, [schoolSettings]);

  // Load Real Data from Supabase
  const loadData = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
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
          created_at,
          updated_at,
          profile:profiles(id, full_name, email, phone_number, role, account_status),
          teacher_class_assignments(
            id,
            class_id,
            classes(id, class_name, class_level)
          )
        `)
        .order('created_at', { ascending: false });

      if (teachErr) throw teachErr;

      const formattedTeachers: Teacher[] = (teacherData || []).map((t: any) => ({
        id: t.id,
        profile_id: t.profile_id,
        staff_number: t.staff_number,
        employment_status: t.employment_status,
        created_at: t.created_at,
        updated_at: t.updated_at,
        profile: t.profile,
        assigned_classes: t.teacher_class_assignments?.map((a: any) => a.classes).filter(Boolean) || [],
      }));
      setTeachers(formattedTeachers);

      // 2. Fetch Classes
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('*')
        .order('class_name', { ascending: true });

      if (classErr) throw classErr;
      setClasses((classData as SchoolClass[]) || []);

      // 3. Fetch Attendance Sessions for Selected Date
      const { data: sessionData, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select(`
          *,
          teacher:teachers(
            id,
            staff_number,
            profile:profiles(id, full_name, email),
            teacher_class_assignments(
              classes(id, class_name)
            )
          )
        `)
        .eq('school_date', selectedDate);

      if (sessErr) throw sessErr;
      setSessions((sessionData as AttendanceSession[]) || []);

      // 4. Fetch Audit Logs
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(30);

      setAuditLogs((auditData as AuditLogItem[]) || []);

      // 5. Fetch pending invitations (sent, not yet activated)
      const { data: inviteData, error: inviteErr } = await supabase
        .from('teacher_invitations')
        .select('*, class:classes(class_name)')
        .is('used_at', null)
        .order('created_at', { ascending: false });

      if (inviteErr) {
        console.warn('Could not load pending invitations:', inviteErr);
      } else {
        setPendingInvites((inviteData as TeacherInvitation[]) || []);
      }
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setErrorMsg(err.message || 'Failed to load records from Supabase');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    loadData();

    // Supabase Realtime Subscription for Live Updates:
    // attendance changes, teachers activating their invites, and
    // invitations being created all refresh the dashboard immediately
    if (supabase) {
      const channel = supabase
        .channel('admin-live-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_sessions' },
          () => {
            loadData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teachers' },
          () => {
            loadData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teacher_invitations' },
          () => {
            loadData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadData, supabase]);

  // Compute Live Metrics from actual records
  const activeTeachersCount = teachers.filter((t) => t.employment_status === 'active').length;
  const metrics = calculateAttendanceMetrics(
    activeTeachersCount,
    sessions.map((s) => ({
      attendance_status: s.attendance_status,
      check_in_at: s.check_in_at,
      check_out_at: s.check_out_at,
    }))
  );

  // Filtered Sessions
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

  // Toggle Teacher Status (Active/Suspended)
  const handleToggleTeacherStatus = async (teacher: Teacher) => {
    if (!supabase) return;
    const newStatus = teacher.employment_status === 'active' ? 'inactive' : 'active';
    try {
      await supabase
        .from('teachers')
        .update({ employment_status: newStatus })
        .eq('id', teacher.id);
      await loadData();
    } catch (err: any) {
      console.error('Toggle status error:', err);
    }
  };

  // Copy a pending invitation's activation link for manual sharing
  const handleCopyInviteLink = (token: string) => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/?activate=${token}`)
      .then(() => {
        setCopiedToken(token);
        setTimeout(() => setCopiedToken((prev) => (prev === token ? null : prev)), 2500);
      })
      .catch(() => {
        alert(`Copy this link:\n${window.location.origin}/?activate=${token}`);
      });
  };

  // Share a pending invitation's activation link - native share sheet on
  // mobile, WhatsApp fallback elsewhere, so it always arrives as a
  // tappable link (plain pasted URLs are often not linkified)
  const handleShareInvite = async (token: string) => {
    const url = `${window.location.origin}/?activate=${token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Staff Account Activation', url });
      } catch {
        /* user closed the share sheet */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
    }
  };

  // Add Class Handler
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newClassName.trim() || !newClassLevel.trim()) return;
    try {
      const { error } = await supabase.from('classes').insert({
        class_name: newClassName.trim(),
        class_level: newClassLevel.trim(),
      });
      if (error) throw error;
      setNewClassName('');
      setNewClassLevel('');
      setIsAddClassOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Create class error:', err);
      alert(err.message);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const { error } = await updateSchoolSettings(settingsForm);
    setIsSavingSettings(false);
    if (!error) {
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    } else {
      alert(`Error saving settings: ${error.message}`);
    }
  };

  // Helper to use device location as school center
  const handleUseCurrentLocationForSchool = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSettingsForm((prev) => ({
            ...prev,
            school_latitude: Number(pos.coords.latitude.toFixed(6)),
            school_longitude: Number(pos.coords.longitude.toFixed(6)),
          }));
        },
        (err) => alert(`Could not acquire location: ${err.message}`),
        { enableHighAccuracy: true }
      );
    }
  };

  // Export CSV
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
    link.setAttribute('download', `StaffClock_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const ActiveNavIcon = activeNav.icon;

  const renderNavItems = (onNavigate?: () => void) =>
    NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return (
        <button
          key={item.id}
          onClick={() => {
            setActiveTab(item.id);
            onNavigate?.();
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
            isActive
              ? 'bg-[#C62828] text-white shadow-xs'
              : 'text-[#667085] hover:bg-gray-100 hover:text-[#202124]'
          }`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[#C62828]'}`} />
          <span className="leading-tight">{item.label}</span>
        </button>
      );
    });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8F8F8] pb-12">
      {/* Mobile Section Bar with Menu Toggle */}
      <div className="sticky top-16 z-30 border-b border-[#E5E7EB] bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ActiveNavIcon className="h-4 w-4 shrink-0 text-[#C62828]" />
            <span className="truncate text-sm font-bold text-[#202124]">{activeNav.label}</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#202124] shadow-xs hover:bg-gray-50"
            aria-label="Toggle navigation menu"
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>Menu</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl sm:px-4 lg:gap-6 lg:px-6">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[80px] py-6">
            <nav className="space-y-0.5 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-xs">
              {renderNavItems()}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-0">
        {/* Error Notice */}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-300 p-3.5 text-xs text-[#B91C1C] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#C62828]" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="font-bold">×</button>
          </div>
        )}

        {/* 1. OVERVIEW & METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Header with Date Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#202124]">School Attendance Overview</h2>
                <p className="text-xs text-[#667085]">
                  Real-time operational statistics calculated dynamically from Supabase database records.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C62828]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#202124] shadow-xs focus:ring-2 focus:ring-[#C62828]"
                />
                <button
                  onClick={loadData}
                  className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#667085] hover:text-[#202124]"
                  title="Refresh data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Active Teachers</span>
                  <Users className="w-4 h-4 text-[#C62828]" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#202124]">{metrics.totalActiveTeachers}</div>
                <div className="mt-1 text-[11px] text-[#667085]">Enrolled in School</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Checked In</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#202124]">{metrics.checkedInCount}</div>
                <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
                  {metrics.attendancePercentage}% Attendance Rate
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">On Time Arrivals</span>
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">{metrics.onTimeCount}</div>
                <div className="mt-1 text-[11px] text-[#667085]">Within grace period</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Late Arrivals</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-700">{metrics.lateCount}</div>
                <div className="mt-1 text-[11px] text-[#667085]">Past grace cutoff</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Not Checked In</span>
                  <Clock className="w-4 h-4 text-red-500" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#B91C1C]">{metrics.notCheckedInCount}</div>
                <div className="mt-1 text-[11px] text-[#667085]">Awaiting arrival</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Checked Out</span>
                  <LogOut className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#202124]">{metrics.checkedOutCount}</div>
                <div className="mt-1 text-[11px] text-[#667085]">Duty concluded</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Outstanding Checkout</span>
                  <Clock className="w-4 h-4 text-[#C62828]" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#C62828]">{metrics.outstandingCheckoutCount}</div>
                <div className="mt-1 text-[11px] text-[#667085]">On duty / not checked out</div>
              </div>

              <div className="rounded-xl bg-white p-4 border border-[#E5E7EB] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667085]">Punctuality Rate</span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">{metrics.punctualityRate}%</div>
                <div className="mt-1 text-[11px] text-[#667085]">Of reported teachers</div>
              </div>
            </div>

            {/* Quick Actions & Live Attendance Preview */}
            <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#202124]">Today's Realtime Log ({selectedDate})</h3>
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="text-xs font-semibold text-[#C62828] hover:underline"
                >
                  View Full Attendance Table →
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#667085]">
                  <Clock className="mx-auto w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-semibold text-[#202124]">No attendance records recorded for {selectedDate}.</p>
                  <p className="mt-1">Records will appear live here as teachers check in on school premises.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[#667085]">
                        <th className="pb-2 font-semibold">Teacher Name</th>
                        <th className="pb-2 font-semibold">Staff ID</th>
                        <th className="pb-2 font-semibold">Check-In</th>
                        <th className="pb-2 font-semibold">Status</th>
                        <th className="pb-2 font-semibold">Check-Out</th>
                        <th className="pb-2 font-semibold text-right">Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {sessions.slice(0, 5).map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="py-2.5 font-bold text-[#202124]">
                            {session.teacher?.profile?.full_name || 'Staff Member'}
                          </td>
                          <td className="py-2.5 font-mono text-[#667085]">
                            {session.teacher?.staff_number || 'N/A'}
                          </td>
                          <td className="py-2.5 font-semibold text-[#202124]">
                            {session.check_in_at
                              ? new Date(session.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                              : '—'}
                          </td>
                          <td className="py-2.5">
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
                          <td className="py-2.5 text-[#667085]">
                            {session.check_out_at
                              ? new Date(session.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                              : 'Pending'}
                          </td>
                          <td className="py-2.5 text-right">
                            {session.check_in_evidence_path && (
                              <button
                                onClick={() => setReviewSession(session)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-medium text-[#202124] hover:bg-gray-50"
                              >
                                <Eye className="w-3 h-3 text-[#C62828]" />
                                <span>Selfie</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ATTENDANCE MONITOR TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202124]">Attendance Records Monitor</h2>
                <p className="text-xs text-[#667085]">
                  Search, review selfie evidence, and perform audited administrative corrections.
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#202124] shadow-xs hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5 text-[#C62828]" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl bg-white p-3.5 border border-[#E5E7EB] shadow-xs sm:grid-cols-4">
              <div>
                <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs text-[#202124]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">Search Staff</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#667085]" />
                  <input
                    type="text"
                    placeholder="Name or Staff ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] pl-8 pr-2.5 py-1.5 text-xs text-[#202124]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs text-[#202124]"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present (On Time)</option>
                  <option value="late">Late Arrival</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">Class</label>
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

            {/* Attendance Table */}
            <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  <FileText className="mx-auto w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-bold text-[#202124]">No attendance sessions match criteria.</p>
                  <p className="mt-1">Try selecting a different date or clearing filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8F8F8] border-b border-[#E5E7EB] text-[#667085]">
                        <th className="py-3 px-4 font-semibold">Teacher</th>
                        <th className="py-3 px-3 font-semibold">Staff ID</th>
                        <th className="py-3 px-3 font-semibold">Assigned Class</th>
                        <th className="py-3 px-3 font-semibold">Check-In</th>
                        <th className="py-3 px-3 font-semibold">Status</th>
                        <th className="py-3 px-3 font-semibold">Check-Out</th>
                        <th className="py-3 px-3 font-semibold">Distance</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredSessions.map((session) => {
                        const assigned =
                          (session.teacher as any)?.teacher_class_assignments?.[0]?.classes?.class_name || '—';
                        return (
                          <tr key={session.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-bold text-[#202124]">
                              {session.teacher?.profile?.full_name || 'Staff Member'}
                            </td>
                            <td className="py-3 px-3 font-mono text-[#667085]">
                              {session.teacher?.staff_number || 'N/A'}
                            </td>
                            <td className="py-3 px-3 text-[#202124]">{assigned}</td>
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
                            <td className="py-3 px-3 text-[#667085]">
                              {session.check_in_geofence_distance_meters != null
                                ? `${Math.round(session.check_in_geofence_distance_meters)}m`
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {session.check_in_evidence_path && (
                                  <button
                                    onClick={() => setReviewSession(session)}
                                    className="p-1 rounded text-[#C62828] hover:bg-red-50"
                                    title="View Photo Evidence"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setCorrectionSession(session)}
                                  className="p-1 rounded text-[#667085] hover:text-[#202124] hover:bg-gray-100"
                                  title="Audited Admin Correction"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. TEACHER STAFF MANAGEMENT TAB */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202124]">Teacher Staff Registry</h2>
                <p className="text-xs text-[#667085]">
                  Invite teachers using their email and generate manual activation links.
                </p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#8E1B1B]"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Teacher / Staff</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
              {teachers.length === 0 && pendingInvites.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  <Users className="mx-auto w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-bold text-[#202124]">No teachers enrolled yet.</p>
                  <p className="mt-1">Click "Invite Teacher / Staff" above to invite your first teacher.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8F8F8] border-b border-[#E5E7EB] text-[#667085]">
                        <th className="py-3 px-4 font-semibold">Full Name</th>
                        <th className="py-3 px-3 font-semibold">Staff Number</th>
                        <th className="py-3 px-3 font-semibold">Email</th>
                        <th className="py-3 px-3 font-semibold">Assigned Class</th>
                        <th className="py-3 px-3 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-bold text-[#202124]">
                            {teacher.profile?.full_name || 'Staff Member'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#667085]">
                            {teacher.staff_number}
                          </td>
                          <td className="py-3 px-3 text-[#667085]">
                            {teacher.profile?.email || 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-[#202124]">
                            {teacher.assigned_classes && teacher.assigned_classes.length > 0
                              ? teacher.assigned_classes.map((c) => c.class_name).join(', ')
                              : 'Unassigned'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                teacher.employment_status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {teacher.employment_status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleTeacherStatus(teacher)}
                              className={`p-1 rounded text-xs font-semibold ${
                                teacher.employment_status === 'active'
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={teacher.employment_status === 'active' ? 'Deactivate staff' : 'Activate staff'}
                            >
                              {teacher.employment_status === 'active' ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Pending invitations: sent but not yet activated */}
                      {pendingInvites.map((invite) => (
                        <tr key={`invite-${invite.id}`} className="bg-amber-50/50 hover:bg-amber-50">
                          <td className="py-3 px-4 font-bold text-[#202124]">
                            {invite.full_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#667085]">
                            {invite.staff_number}
                          </td>
                          <td className="py-3 px-3 text-[#667085]">
                            {invite.email}
                          </td>
                          <td className="py-3 px-3 text-[#202124]">
                            {invite.class?.class_name || 'Unassigned'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
                              title={`Invite expires ${new Date(invite.expires_at).toLocaleString()}`}
                            >
                              INVITED — PENDING
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopyInviteLink(invite.token)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-medium text-[#202124] hover:bg-gray-50"
                                title="Copy activation link to send to this staff member"
                              >
                                <Copy className="w-3 h-3 text-[#C62828]" />
                                <span>{copiedToken === invite.token ? 'Copied!' : 'Copy Link'}</span>
                              </button>
                              <button
                                onClick={() => handleShareInvite(invite.token)}
                                className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                                title="Send as a tappable link (share sheet / WhatsApp)"
                              >
                                <Share2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. CLASS MANAGEMENT TAB */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202124]">School Classes</h2>
                <p className="text-xs text-[#667085]">
                  Manage school classes and assign primary classroom responsibilities.
                </p>
              </div>
              <button
                onClick={() => setIsAddClassOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#8E1B1B]"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Class</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classes.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-[#667085] bg-white rounded-2xl border border-[#E5E7EB]">
                  <GraduationCap className="mx-auto w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-bold text-[#202124]">No classes registered yet.</p>
                  <p className="mt-1">Add classes like "Primary 1", "Form 2B", "Basic 6".</p>
                </div>
              ) : (
                classes.map((cls) => {
                  const assignedTeachers = teachers.filter((t) =>
                    t.assigned_classes?.some((c) => c.id === cls.id)
                  );
                  return (
                    <div
                      key={cls.id}
                      className="rounded-xl bg-white border border-[#E5E7EB] p-4 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#667085]">{cls.class_level}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <h4 className="text-base font-bold text-[#202124]">{cls.class_name}</h4>
                      <div className="pt-2 border-t border-[#E5E7EB] text-xs text-[#667085]">
                        <p className="font-medium text-[#202124]">
                          {assignedTeachers.length} Assigned Teacher{assignedTeachers.length === 1 ? '' : 's'}:
                        </p>
                        <p className="text-[11px] line-clamp-1 mt-0.5">
                          {assignedTeachers.map((t) => t.profile?.full_name).join(', ') || 'None assigned yet'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Class Modal */}
            {isAddClassOpen && (
              <div
                role="dialog"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              >
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#202124]">Create New Class</h3>
                  <form onSubmit={handleCreateClass} className="mt-3 space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Class Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Primary 4 'A' or Grade 7"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Class Level</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Primary, JHS, SHS, Kindergarten"
                        value={newClassLevel}
                        onChange={(e) => setNewClassLevel(e.target.value)}
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                      <button
                        type="button"
                        onClick={() => setIsAddClassOpen(false)}
                        className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium text-[#667085]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-[#C62828] px-4 py-1.5 font-bold text-white hover:bg-[#8E1B1B]"
                      >
                        Create Class
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. REPORTS & EXPORT TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202124]">Punctuality & Attendance Reports</h2>
                <p className="text-xs text-[#667085]">
                  Generate clean CSV compliance reports for administrative audits.
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#8E1B1B]"
              >
                <Download className="w-4 h-4" />
                <span>Download Report CSV</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-gray-50 p-4 border border-[#E5E7EB]">
                  <span className="text-xs font-semibold text-[#667085]">Total Records (Selected Date)</span>
                  <div className="text-2xl font-bold text-[#202124] mt-1">{sessions.length}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-800">Punctuality Rate</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.punctualityRate}%</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                  <span className="text-xs font-semibold text-blue-800">Checkout Compliance</span>
                  <div className="text-2xl font-bold text-blue-700 mt-1">
                    {metrics.checkedInCount > 0
                      ? `${Math.round((metrics.checkedOutCount / metrics.checkedInCount) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#667085]">
                <p>Note: Exported CSV reports strictly exclude private selfie image URLs or sensitive passwords.</p>
              </div>
            </div>
          </div>
        )}

        {/* 6. SCHOOL SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#202124]">School Operating Settings</h2>
              <p className="text-xs text-[#667085]">
                Configure timetable, lateness grace period, and geofence coordinates.
              </p>
            </div>

            {settingsSavedToast && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Settings saved successfully to Supabase!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="rounded-2xl bg-white border border-[#E5E7EB] p-5 shadow-xs space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">Official School Name</label>
                <input
                  type="text"
                  required
                  value={settingsForm.school_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, school_name: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124] focus:ring-2 focus:ring-[#C62828]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Timezone</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.timezone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Opening Time (06:00)</label>
                  <input
                    type="time"
                    required
                    value={settingsForm.opening_time.slice(0, 5)}
                    onChange={(e) => setSettingsForm({ ...settingsForm, opening_time: `${e.target.value}:00` })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Closing Time (16:30)</label>
                  <input
                    type="time"
                    required
                    value={settingsForm.closing_time.slice(0, 5)}
                    onChange={(e) => setSettingsForm({ ...settingsForm, closing_time: `${e.target.value}:00` })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">
                    Lateness Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    required
                    value={settingsForm.grace_period_minutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, grace_period_minutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                  <p className="text-[11px] text-[#667085] mt-1">
                    Check-in up to {settingsForm.opening_time.slice(0, 5)} + {settingsForm.grace_period_minutes}m is marked On Time.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">
                    Geofence Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={2000}
                    required
                    value={settingsForm.geofence_radius_meters}
                    onChange={(e) => setSettingsForm({ ...settingsForm, geofence_radius_meters: parseInt(e.target.value, 10) || 100 })}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#202124]"
                  />
                  <p className="text-[11px] text-[#667085] mt-1">
                    Maximum radius around school coordinates where attendance is accepted.
                  </p>
                </div>
              </div>

              {/* Geofence GPS Coordinates */}
              <div className="rounded-xl bg-gray-50 p-4 border border-[#E5E7EB] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#202124]">
                    <MapPin className="w-4 h-4 text-[#C62828]" />
                    <span>School Geofence Center Coordinates</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocationForSchool}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#C62828] hover:bg-gray-100"
                  >
                    Use Device GPS Here
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#667085] mb-1">School Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.school_latitude}
                      onChange={(e) => setSettingsForm({ ...settingsForm, school_latitude: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[#202124]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#667085] mb-1">School Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.school_longitude}
                      onChange={(e) => setSettingsForm({ ...settingsForm, school_longitude: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[#202124]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#E5E7EB]">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="rounded-lg bg-[#C62828] px-5 py-2 font-bold text-white hover:bg-[#8E1B1B] shadow-xs disabled:opacity-50"
                >
                  {isSavingSettings ? 'Saving...' : 'Save School Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 7. AUDIT TRAIL TAB */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#202124]">System Audit Trail</h2>
              <p className="text-xs text-[#667085]">
                Immutable, append-only security logs for administrative actions and corrections.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  <Shield className="mx-auto w-8 h-8 text-gray-300 mb-2" />
                  <p className="font-bold text-[#202124]">No audit logs recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8F8F8] border-b border-[#E5E7EB] text-[#667085]">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-3 font-semibold">Actor</th>
                        <th className="py-3 px-3 font-semibold">Action</th>
                        <th className="py-3 px-3 font-semibold">Entity</th>
                        <th className="py-3 px-4 font-semibold">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-[#667085] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#202124]">
                            {log.actor?.full_name || 'System / Admin'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[11px] font-bold text-[#C62828]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#667085]">{log.entity_type}</td>
                          <td className="py-3 px-4 font-mono text-[10px] text-[#667085] max-w-xs truncate">
                            {JSON.stringify(log.safe_metadata)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <span className="text-sm font-bold text-[#202124]">Admin Menu</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-lg p-1.5 text-[#667085] hover:bg-gray-100 hover:text-[#202124]"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="space-y-0.5">{renderNavItems(() => setIsSidebarOpen(false))}</nav>
          </div>
        </div>
      )}

      {/* Modals */}
      <InviteTeacherModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        classes={classes}
        onTeacherInvited={loadData}
      />

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

      <AdminCorrectionModal
        isOpen={!!correctionSession}
        onClose={() => setCorrectionSession(null)}
        session={correctionSession}
        onSuccess={loadData}
      />
    </div>
  );
};
