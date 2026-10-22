import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSchoolDayProgress, parseTimeToDate, formatDuration } from './countdown';

test('calculateSchoolDayProgress handles before school hours (e.g. 05:45)', () => {
  const ref = new Date('2026-10-22T05:45:00');
  const result = calculateSchoolDayProgress(ref, '06:00', '16:30');

  assert.equal(result.phase, 'before_school');
  assert.equal(result.percentage, 0);
  assert.equal(result.ratio, 0);
  assert.equal(result.isClosingTimePassed, false);
  assert.equal(result.timeRemainingSeconds, 15 * 60);
});

test('calculateSchoolDayProgress handles midday progress (e.g. 11:15 is halfway between 06:00 and 16:30)', () => {
  // 06:00 to 16:30 is 10.5 hours = 630 minutes.
  // 11:15 is 5 hours 15 minutes = 315 minutes from 06:00 = 50.0%
  const ref = new Date('2026-10-22T11:15:00');
  const result = calculateSchoolDayProgress(ref, '06:00', '16:30');

  assert.equal(result.phase, 'school_in_session');
  assert.equal(result.percentage, 50);
  assert.equal(result.isClosingTimePassed, false);
});

test('calculateSchoolDayProgress handles exact closing time and after closing time (16:30+)', () => {
  const refAtEnd = new Date('2026-10-22T16:30:00');
  const resultAtEnd = calculateSchoolDayProgress(refAtEnd, '06:00', '16:30');
  assert.equal(resultAtEnd.phase, 'school_ended');
  assert.equal(resultAtEnd.percentage, 100);
  assert.equal(resultAtEnd.isClosingTimePassed, true);

  const refAfter = new Date('2026-10-22T18:00:00');
  const resultAfter = calculateSchoolDayProgress(refAfter, '06:00', '16:30');
  assert.equal(resultAfter.phase, 'school_ended');
  assert.equal(resultAfter.percentage, 100);
  assert.equal(resultAfter.isClosingTimePassed, true);
});

test('formatDuration formats hours and minutes properly', () => {
  assert.equal(formatDuration(3660), '1h 01m');
  assert.equal(formatDuration(125), '2m 05s');
});
