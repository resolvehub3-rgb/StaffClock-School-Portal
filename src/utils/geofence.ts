/**
 * Geolocation & Geofence validation utilities
 * Computes precise Haversine distance and checks acceptable accuracy thresholds.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceValidationResult {
  isInside: boolean;
  distanceMeters: number;
  accuracyMeters: number;
  acceptableAccuracy: boolean;
  message: string;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula.
 */
export function calculateDistanceMeters(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  if (
    !Number.isFinite(coord1.latitude) ||
    !Number.isFinite(coord1.longitude) ||
    !Number.isFinite(coord2.latitude) ||
    !Number.isFinite(coord2.longitude)
  ) {
    throw new Error('Invalid coordinates: values must be finite numbers');
  }

  if (
    coord1.latitude < -90 ||
    coord1.latitude > 90 ||
    coord2.latitude < -90 ||
    coord2.latitude > 90 ||
    coord1.longitude < -180 ||
    coord1.longitude > 180 ||
    coord2.longitude < -180 ||
    coord2.longitude > 180
  ) {
    throw new Error('Coordinates out of range: lat [-90, 90], lon [-180, 180]');
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const lat1Rad = toRad(coord1.latitude);
  const lat2Rad = toRad(coord2.latitude);
  const deltaLat = toRad(coord2.latitude - coord1.latitude);
  const deltaLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

/**
 * Validates whether a device location satisfies school geofence criteria.
 * @param teacherCoord Device GPS coordinate
 * @param schoolCoord Official school coordinate
 * @param radiusMeters Approved radius around school
 * @param accuracyMeters Reported GPS accuracy in meters
 * @param maxAccuracyThreshold Maximum allowable GPS uncertainty (default 100m)
 */
export function validateGeofence(
  teacherCoord: Coordinates,
  schoolCoord: Coordinates,
  radiusMeters: number,
  accuracyMeters: number,
  maxAccuracyThreshold: number = 100
): GeofenceValidationResult {
  if (accuracyMeters < 0 || !Number.isFinite(accuracyMeters)) {
    return {
      isInside: false,
      distanceMeters: Infinity,
      accuracyMeters,
      acceptableAccuracy: false,
      message: 'Invalid GPS accuracy reported by device',
    };
  }

  const acceptableAccuracy = accuracyMeters <= maxAccuracyThreshold;
  if (!acceptableAccuracy) {
    return {
      isInside: false,
      distanceMeters: Infinity,
      accuracyMeters,
      acceptableAccuracy: false,
      message: `GPS accuracy is too low (${Math.round(accuracyMeters)}m). Please move outdoors or near a window.`,
    };
  }

  const distanceMeters = calculateDistanceMeters(teacherCoord, schoolCoord);
  // Account for GPS accuracy tolerance: distance minus accuracy margin
  const effectiveDistance = Math.max(0, distanceMeters - accuracyMeters * 0.5);
  const isInside = effectiveDistance <= radiusMeters;

  return {
    isInside,
    distanceMeters,
    accuracyMeters,
    acceptableAccuracy,
    message: isInside
      ? `Within school premises (${Math.round(distanceMeters)}m from center)`
      : `Outside school geofence (${Math.round(distanceMeters)}m away, limit is ${radiusMeters}m)`,
  };
}

// ---------------------------------------------------------------------------
// Geolocation permission diagnostics & user-facing guidance
// ---------------------------------------------------------------------------

export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Reads the current geolocation permission state for this origin (best effort).
 * Returns 'unknown' when the Permissions API is unavailable (older Safari).
 */
export async function getGeolocationPermissionState(): Promise<LocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

/** Detects the user's device platform from a user-agent string. */
export function detectDevicePlatform(userAgent: string): DevicePlatform {
  const ua = userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS masquerades as a Macintosh but keeps the Mobile token
  if (/Macintosh/i.test(ua) && /Mobile\//.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export interface LocationHelpGuide {
  platform: DevicePlatform;
  /** Human-readable device label, e.g. "iPhone / iPad" */
  label: string;
  /** Ordered, clickable steps to re-enable location for this site */
  steps: string[];
  /** Extra note covering OS-level location switches */
  systemNote: string;
}

/**
 * Platform-specific instructions for un-blocking location access.
 * The browser prompt only appears once; after a denial users must re-allow
 * the site through browser chrome, which is what these steps explain.
 */
export function getLocationHelpGuide(userAgent: string): LocationHelpGuide {
  const platform = detectDevicePlatform(userAgent);

  switch (platform) {
    case 'ios':
      return {
        platform,
        label: 'iPhone / iPad',
        steps: [
          'Tap the "aA" or lock icon at the top of the address bar.',
          'Tap "Website Settings", then set Location to "Allow".',
          'Reload this page and tap "Retry GPS".',
        ],
        systemNote:
          'If it still fails, open Settings > Privacy & Security > Location Services > your browser (or the StaffClock app) and choose "While Using the App".',
      };
    case 'android':
      return {
        platform,
        label: 'Android',
        steps: [
          'Tap the lock or tune icon in the address bar.',
          'Tap "Permissions" > "Location" > "Allow".',
          'Reload this page and tap "Retry GPS".',
        ],
        systemNote:
          'Also switch on Settings > Location (GPS). For better indoor accuracy, enable Google Location Accuracy / Wi-Fi scanning.',
      };
    default:
      return {
        platform,
        label: 'Computer',
        steps: [
          'Click the lock or tune icon to the left of the site address.',
          'Open "Site settings" > "Location" and choose "Allow".',
          'Reload this page and tap "Retry GPS".',
        ],
        systemNote:
          'Also make sure location is enabled in your OS settings (Windows: Settings > Privacy > Location; Mac: System Settings > Privacy & Security > Location Services).',
      };
  }
}

/** Maps a GeolocationPositionError code to an actionable, friendly message. */
export function friendlyGeolocationError(code: number, message?: string): string {
  switch (code) {
    case 1:
      return 'Location access is blocked for this site. Follow the steps above, then tap Retry GPS.';
    case 2:
      return 'Location is unavailable right now. Turn on Location (GPS) and Wi-Fi, move near a window, then retry.';
    case 3:
      return 'The GPS request timed out. Tap Retry GPS — moving outdoors helps.';
    default:
      return `Unable to determine location${message ? `: ${message}` : '.'}`;
  }
}
