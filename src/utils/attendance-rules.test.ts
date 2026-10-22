import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCheckInPunctuality, evaluateCheckoutStatus } from './attendance-rules';

test('evaluateCheckInPunctuality marks arrivals before or at 06:10 as on time (with 10min grace period)', () => {
  // 05:55 on time
  const t1 = new Date('2026-10-22T05:55:00');
  const res1 = evaluateCheckInPunctuality(t1, '06:00', 10);
  assert.equal(res1.status, 'present');
  assert.equal(res1.isOnTime, true);
  assert.equal(res1.latenessMinutes, 0);

  // 06:00 on time
  const t2 = new Date('2026-10-22T06:00:00');
  const res2 = evaluateCheckInPunctuality(t2, '06:00', 10);
  assert.equal(res2.status, 'present');
  assert.equal(res2.isOnTime, true);
  assert.equal(res2.latenessMinutes, 0);

  // 06:10 on time (exactly at grace period boundary)
  const t3 = new Date('2026-10-22T06:10:00');
  const res3 = evaluateCheckInPunctuality(t3, '06:00', 10);
  assert.equal(res3.status, 'present');
  assert.equal(res3.isOnTime, true);
  assert.equal(res3.latenessMinutes, 0);
});

test('evaluateCheckInPunctuality marks arrivals at 06:11 or later as late with correct lateness from opening time', () => {
  // 06:11: late, 11 minutes from 06:00
  const t1 = new Date('2026-10-22T06:11:00');
  const res1 = evaluateCheckInPunctuality(t1, '06:00', 10);
  assert.equal(res1.status, 'late');
  assert.equal(res1.isOnTime, false);
  assert.equal(res1.latenessMinutes, 11);

  // 06:35: late by 35 minutes
  const t2 = new Date('2026-10-22T06:35:00');
  const res2 = evaluateCheckInPunctuality(t2, '06:00', 10);
  assert.equal(res2.status, 'late');
  assert.equal(res2.latenessMinutes, 35);
});

test('evaluateCheckoutStatus identifies completed vs early vs overdue', () => {
  const normal = new Date('2026-10-22T16:32:00');
  assert.equal(evaluateCheckoutStatus(normal, '16:30'), 'completed');

  const early = new Date('2026-10-22T15:00:00');
  assert.equal(evaluateCheckoutStatus(early, '16:30'), 'early');

  const overdue = new Date('2026-10-22T18:00:00');
  assert.equal(evaluateCheckoutStatus(overdue, '16:30'), 'overdue');
});
