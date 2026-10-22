export type UserRole = 'owner' | 'headmaster' | 'teacher';

export interface SchoolSettings {
  id: string;
  school_name: string;
  logo_object_path: string | null;
  timezone: string;
  opening_time: string;
  closing_time: string;
  grace_period_minutes: number;
  school_latitude: number;
  school_longitude: number;
  geofence_radius_meters: number;
  max_accuracy_threshold_meters: number;
  checkout_reminder_enabled: boolean;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  account_status: 'active' | 'suspended' | 'pending_activation';
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  profile_id: string;
  staff_number: string;
  employment_status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: Profile;
  assigned_classes?: SchoolClass[];
}

export interface SchoolClass {
  id: string;
  class_name: string;
  class_level: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherClassAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  academic_year: string;
  is_primary_class: boolean;
  assigned_at: string;
  assigned_by: string | null;
  class?: SchoolClass;
}

export interface AttendanceSession {
  id: string;
  teacher_id: string;
  school_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  attendance_status: 'present' | 'late' | 'absent' | 'excused';
  check_in_evidence_path: string | null;
  check_out_evidence_path: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy_meters: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy_meters: number | null;
  check_in_geofence_distance_meters: number | null;
  check_out_geofence_distance_meters: number | null;
  lateness_minutes: number;
  checkout_status: 'pending' | 'completed' | 'overdue' | 'early';
  created_at: string;
  updated_at: string;
  // Joined fields
  teacher?: Teacher;
}

export interface AttendanceEvent {
  id: string;
  attendance_session_id: string | null;
  actor_profile_id: string | null;
  event_type: 'check_in' | 'check_out' | 'admin_correction' | 'attempt_rejected';
  event_timestamp: string;
  metadata: Record<string, any>;
  reason: string | null;
  created_at: string;
  actor?: Profile;
}

export interface TeacherInvitation {
  id: string;
  email: string;
  full_name: string;
  staff_number: string;
  role: 'teacher' | 'headmaster';
  class_id: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_by: string | null;
  created_at: string;
  class?: SchoolClass;
}

export interface NotificationItem {
  id: string;
  recipient_profile_id: string;
  notification_type: string;
  title: string;
  message: string;
  related_attendance_session_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  safe_metadata: Record<string, any>;
  created_at: string;
  actor?: Profile;
}
