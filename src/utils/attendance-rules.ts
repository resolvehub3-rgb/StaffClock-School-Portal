/**
 * School Attendance Rules & Punctuality Evaluation
 * 
 * Rules:
 * - Official start: opening_time (e.g. 06:00)
 * - Cutoff = opening_time + grace_period_minutes (e.g. 06:10)
 * - Check-in <= cutoff is 'present' (On Time), lateness_minutes = 0.
 * - Check-in > cutoff is 'late', lateness_minutes = round((check_in - opening_time) / 60000).
 * - Official closing: closing_time (e.g. 16:30)
 * - Checkout >= 16:30 is 'completed'. If checkout occurs during school hours or overdue, classified accurately.
 */

import { parseTimeToDate } from './countdown';

export interface PunctualityResult {
  status: 'present' | 'late';
  latenessMinutes: number;
  cutoffTime: Date;
  openingTime: Date;
  isOnTime: boolean;
  displayText: string;
}

export function evaluateCheckInPunctuality(
  checkInDate: Date,
  openingTimeStr: string = '06:00',
  gracePeriodMinutes: number = 10
): PunctualityResult {
  const openingTime = parseTimeToDate(openingTimeStr, checkInDate);
  const cutoffTime = new Date(openingTime.getTime() + gracePeriodMinutes * 60 * 1000);

  const checkInMs = checkInDate.getTime();
  const cutoffMs = cutoffTime.getTime();
  const openingMs = openingTime.getTime();

  if (checkInMs <= cutoffMs) {
    return {
      status: 'present',
      latenessMinutes: 0,
      cutoffTime,
      openingTime,
      isOnTime: true,
      displayText: 'On Time',
    };
  }

  // Calculate lateness in full minutes past opening time
  const latenessMinutes = Math.max(1, Math.round((checkInMs - openingMs) / (60 * 1000)));

  return {
    status: 'late',
    latenessMinutes,
    cutoffTime,
    openingTime,
    isOnTime: false,
    displayText: `Late by ${latenessMinutes} min`,
  };
}

export function evaluateCheckoutStatus(
  checkOutDate: Date,
  closingTimeStr: string = '16:30'
): 'completed' | 'overdue' | 'early' {
  const closingTime = parseTimeToDate(closingTimeStr, checkOutDate);
  const diffMinutes = Math.round((checkOutDate.getTime() - closingTime.getTime()) / (60 * 1000));

  if (diffMinutes < -15) {
    return 'early';
  }
  if (diffMinutes > 60) {
    return 'overdue';
  }
  return 'completed';
}
