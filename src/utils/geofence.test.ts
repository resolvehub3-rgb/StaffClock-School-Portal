import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistanceMeters, validateGeofence } from './geofence';

test('calculateDistanceMeters accurately computes distance between two known points', () => {
  // Accra High School to Independence Square (~2.5km)
  const p1 = { latitude: 5.55602, longitude: -0.1969 };
  const p2 = { latitude: 5.5458, longitude: -0.1925 };
  const distance = calculateDistanceMeters(p1, p2);

  // Expected distance roughly 1200-1300 meters
  assert.ok(distance > 1000 && distance < 1500, `Expected ~1200m, got ${distance}`);

  // Same point distance should be 0
  assert.equal(calculateDistanceMeters(p1, p1), 0);
});

test('calculateDistanceMeters rejects invalid coordinates', () => {
  assert.throws(() => {
    calculateDistanceMeters({ latitude: 100, longitude: 0 }, { latitude: 0, longitude: 0 });
  }, /Coordinates out of range/);

  assert.throws(() => {
    calculateDistanceMeters({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 });
  }, /Invalid coordinates/);
});

test('validateGeofence accepts location within school radius', () => {
  const school = { latitude: 5.6037, longitude: -0.187 };
  // 30 meters away
  const teacher = { latitude: 5.6039, longitude: -0.187 };
  const radius = 100;
  const accuracy = 15;

  const result = validateGeofence(teacher, school, radius, accuracy);
  assert.equal(result.isInside, true);
  assert.equal(result.acceptableAccuracy, true);
});

test('validateGeofence rejects location outside radius', () => {
  const school = { latitude: 5.6037, longitude: -0.187 };
  // 500 meters away
  const teacher = { latitude: 5.608, longitude: -0.187 };
  const radius = 100;
  const accuracy = 10;

  const result = validateGeofence(teacher, school, radius, accuracy);
  assert.equal(result.isInside, false);
});

test('validateGeofence rejects poor accuracy (> 100m)', () => {
  const school = { latitude: 5.6037, longitude: -0.187 };
  const teacher = { latitude: 5.6037, longitude: -0.187 };
  const radius = 100;
  const poorAccuracy = 150;

  const result = validateGeofence(teacher, school, radius, poorAccuracy);
  assert.equal(result.acceptableAccuracy, false);
  assert.equal(result.isInside, false);
});
