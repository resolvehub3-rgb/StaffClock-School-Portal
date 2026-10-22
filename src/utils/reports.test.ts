import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCsvContent, calculateAttendanceMetrics } from './reports';

test('calculateAttendanceMetrics accurately calculates totals and percentages', () => {
  const records = [
    { attendance_status: 'present', check_in_at: '2026-10-22T06:05:00Z', check_out_at: '2026-10-22T16:30:00Z' },
    { attendance_status: 'present', check_in_at: '2026-10-22T06:08:00Z', check_out_at: null },
    { attendance_status: 'late', check_in_at: '2026-10-22T06:25:00Z', check_out_at: null },
  ];

  const totalTeachers = 4;
  const metrics = calculateAttendanceMetrics(totalTeachers, records);

  assert.equal(metrics.totalActiveTeachers, 4);
  assert.equal(metrics.checkedInCount, 3);
  assert.equal(metrics.onTimeCount, 2);
  assert.equal(metrics.lateCount, 1);
  assert.equal(metrics.notCheckedInCount, 1);
  assert.equal(metrics.checkedOutCount, 1);
  assert.equal(metrics.outstandingCheckoutCount, 2);
  assert.equal(metrics.attendancePercentage, 75); // 3 / 4 = 75%
  assert.equal(metrics.punctualityRate, 67); // 2 / 3 = 67%
});

test('generateCsvContent properly escapes quotes and commas', () => {
  const data = [
    {
      teacherName: 'John Doe, Jr.',
      staffNumber: 'STF-001',
      className: 'Primary 4 "A"',
      schoolDate: '2026-10-22',
      checkInTime: '06:05 AM',
      attendanceStatus: 'On Time',
      latenessMinutes: 0,
      checkOutTime: '04:30 PM',
      checkoutStatus: 'Completed',
    },
  ];

  const csv = generateCsvContent(data);
  assert.ok(csv.includes('"John Doe, Jr."'));
  assert.ok(csv.includes('"Primary 4 ""A"""'));
});
