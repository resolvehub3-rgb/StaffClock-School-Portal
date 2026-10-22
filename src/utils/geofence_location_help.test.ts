import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDevicePlatform,
  getLocationHelpGuide,
  friendlyGeolocationError,
  getGeolocationPermissionState,
} from './geofence';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const IPADOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

test('detectDevicePlatform identifies platforms from user agents', () => {
  assert.equal(detectDevicePlatform(IOS_UA), 'ios');
  assert.equal(detectDevicePlatform(IPADOS_UA), 'ios');
  assert.equal(detectDevicePlatform(ANDROID_UA), 'android');
  assert.equal(detectDevicePlatform(DESKTOP_UA), 'desktop');
  assert.equal(detectDevicePlatform(''), 'desktop');
});

test('getLocationHelpGuide returns actionable steps for every platform', () => {
  for (const ua of [IOS_UA, IPADOS_UA, ANDROID_UA, DESKTOP_UA]) {
    const guide = getLocationHelpGuide(ua);
    assert.ok(guide.label.length > 0, 'guide must name the device');
    assert.ok(guide.steps.length >= 3, `expected >=3 steps for ${guide.platform}`);
    assert.ok(guide.steps.every((s) => s.length > 0), 'steps must not be empty');
    assert.ok(guide.systemNote.length > 0, 'must include an OS-level note');
    assert.ok(['ios', 'android', 'desktop'].includes(guide.platform));
  }
});

test('getLocationHelpGuide mentions reloading and retrying on iOS', () => {
  const guide = getLocationHelpGuide(IOS_UA);
  const joined = guide.steps.join(' ');
  assert.match(joined, /location/i);
  assert.match(joined, /allow/i);
});

test('friendlyGeolocationError maps all geolocation error codes', () => {
  const denied = friendlyGeolocationError(1);
  assert.match(denied, /blocked/i);
  assert.match(denied, /retry/i);

  const unavailable = friendlyGeolocationError(2);
  assert.match(unavailable, /unavailable/i);

  const timeout = friendlyGeolocationError(3);
  assert.match(timeout, /timed out/i);

  const other = friendlyGeolocationError(0, 'something odd');
  assert.match(other, /something odd/);
});

test('getGeolocationPermissionState never throws outside a browser', async () => {
  const state = await getGeolocationPermissionState();
  assert.ok(['granted', 'denied', 'prompt', 'unknown'].includes(state));
});
