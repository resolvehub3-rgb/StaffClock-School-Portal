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
