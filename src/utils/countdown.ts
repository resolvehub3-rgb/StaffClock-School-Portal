/**
 * Official School Timetable Countdown & Progress Calculations
 * 
 * Rules:
 * - Timetable is 06:00 to 16:30 (10 hours 30 minutes).
 * - Progress is strictly based on the school schedule, NOT on individual teacher check-in time.
 * - Progress = clamp((current_time - scheduled_start) / (scheduled_end - scheduled_start), 0, 1)
 */

export interface SchoolDayProgress {
  percentage: number; // 0 to 100
  ratio: number; // 0 to 1
  phase: 'before_school' | 'school_in_session' | 'school_ended';
  timeRemainingSeconds: number;
  timeRemainingFormatted: string;
  isClosingTimePassed: boolean;
  scheduledStart: Date;
  scheduledEnd: Date;
}

/**
 * Parses time string (e.g. '06:00' or '16:30') into a Date for the reference day.
 */
export function parseTimeToDate(timeStr: string, referenceDate: Date = new Date()): Date {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = parseInt(minutesStr || '0', 10);

  const date = new Date(referenceDate.getTime());
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Calculates school day progress and remaining time.
 */
export function calculateSchoolDayProgress(
  currentTime: Date,
  openingTimeStr: string = '06:00',
  closingTimeStr: string = '16:30'
): SchoolDayProgress {
  const start = parseTimeToDate(openingTimeStr, currentTime);
  const end = parseTimeToDate(closingTimeStr, currentTime);

  const currentMs = currentTime.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();
  const totalDurationMs = Math.max(1, endMs - startMs);

  if (currentMs < startMs) {
    const remainingBeforeStart = Math.max(0, Math.floor((startMs - currentMs) / 1000));
    return {
      percentage: 0,
      ratio: 0,
      phase: 'before_school',
      timeRemainingSeconds: remainingBeforeStart,
      timeRemainingFormatted: formatDuration(remainingBeforeStart),
      isClosingTimePassed: false,
      scheduledStart: start,
      scheduledEnd: end,
    };
  }

  if (currentMs >= endMs) {
    return {
      percentage: 100,
      ratio: 1,
      phase: 'school_ended',
      timeRemainingSeconds: 0,
      timeRemainingFormatted: '00h 00m',
      isClosingTimePassed: true,
      scheduledStart: start,
      scheduledEnd: end,
    };
  }

  const elapsedMs = currentMs - startMs;
  const ratio = Math.min(1, Math.max(0, elapsedMs / totalDurationMs));
  const percentage = Math.round(ratio * 1000) / 10;
  const remainingSeconds = Math.max(0, Math.floor((endMs - currentMs) / 1000));

  return {
    percentage,
    ratio,
    phase: 'school_in_session',
    timeRemainingSeconds: remainingSeconds,
    timeRemainingFormatted: formatDuration(remainingSeconds),
    isClosingTimePassed: false,
    scheduledStart: start,
    scheduledEnd: end,
  };
}

/**
 * Formats seconds into HH:MM or HHh MMm.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
}
