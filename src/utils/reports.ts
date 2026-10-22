/**
 * Report generation and CSV export utilities for school attendance
 */

export interface AttendanceRecordExport {
  teacherName: string;
  staffNumber: string;
  className: string;
  schoolDate: string;
  checkInTime: string;
  attendanceStatus: string;
  latenessMinutes: number;
  checkOutTime: string;
  checkoutStatus: string;
}

export function generateCsvContent(records: AttendanceRecordExport[]): string {
  const headers = [
    'Teacher Name',
    'Staff Number',
    'Assigned Class',
    'Date',
    'Check-In Time',
    'Attendance Status',
    'Lateness (mins)',
    'Check-Out Time',
    'Check-Out Status',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((rec) => [
    escapeCsv(rec.teacherName),
    escapeCsv(rec.staffNumber),
    escapeCsv(rec.className),
    escapeCsv(rec.schoolDate),
    escapeCsv(rec.checkInTime),
    escapeCsv(rec.attendanceStatus),
    escapeCsv(rec.latenessMinutes),
    escapeCsv(rec.checkOutTime),
    escapeCsv(rec.checkoutStatus),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
}

export interface SummaryStats {
  totalActiveTeachers: number;
  checkedInCount: number;
  onTimeCount: number;
  lateCount: number;
  notCheckedInCount: number;
  checkedOutCount: number;
  outstandingCheckoutCount: number;
  attendancePercentage: number;
  punctualityRate: number;
}

export function calculateAttendanceMetrics(
  totalActiveTeachers: number,
  records: Array<{
    attendance_status: string;
    check_in_at: string | null;
    check_out_at: string | null;
  }>
): SummaryStats {
  const checkedIn = records.filter((r) => !!r.check_in_at);
  const checkedInCount = checkedIn.length;
  const onTimeCount = checkedIn.filter((r) => r.attendance_status === 'present').length;
  const lateCount = checkedIn.filter((r) => r.attendance_status === 'late').length;
  const notCheckedInCount = Math.max(0, totalActiveTeachers - checkedInCount);
  const checkedOutCount = records.filter((r) => !!r.check_out_at).length;
  const outstandingCheckoutCount = checkedInCount - checkedOutCount;

  const attendancePercentage =
    totalActiveTeachers > 0 ? Math.round((checkedInCount / totalActiveTeachers) * 100) : 0;

  const punctualityRate =
    checkedInCount > 0 ? Math.round((onTimeCount / checkedInCount) * 100) : 0;

  return {
    totalActiveTeachers,
    checkedInCount,
    onTimeCount,
    lateCount,
    notCheckedInCount,
    checkedOutCount,
    outstandingCheckoutCount,
    attendancePercentage,
    punctualityRate,
  };
}
