import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { validateGeofence, GeofenceValidationResult, Coordinates } from '../utils/geofence';

interface LocationVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationVerified: (coords: { latitude: number; longitude: number; accuracy: number; distance: number }) => void;
  schoolCoords: Coordinates;
  geofenceRadiusMeters: number;
  maxAccuracyThreshold?: number;
  actionTitle?: string;
}

export const LocationVerificationModal: React.FC<LocationVerificationModalProps> = ({
  isOpen,
  onClose,
  onLocationVerified,
  schoolCoords,
  geofenceRadiusMeters,
  maxAccuracyThreshold = 100,
  actionTitle = 'Duty Verification',
}) => {
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<GeofenceValidationResult | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  const requestLocation = useCallback(() => {
    setIsLocating(true);
    setErrorMsg(null);
    setResult(null);

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentCoords({ latitude, longitude, accuracy });

        const validation = validateGeofence(
          { latitude, longitude },
          schoolCoords,
          geofenceRadiusMeters,
          accuracy,
          maxAccuracyThreshold
        );

        setResult(validation);
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMsg('Location access was denied. Please allow location access in your device settings.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMsg('Location information is unavailable. Ensure GPS is enabled.');
        } else if (error.code === error.TIMEOUT) {
          setErrorMsg('Location request timed out. Please try again.');
        } else {
          setErrorMsg(`Unable to determine location: ${error.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0, // Fresh reading required
      }
    );
  }, [schoolCoords, geofenceRadiusMeters, maxAccuracyThreshold]);

  useEffect(() => {
    if (isOpen) {
      requestLocation();
    }
  }, [isOpen, requestLocation]);

  const handleProceed = () => {
    if (result && result.isInside && currentCoords) {
      onLocationVerified({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        accuracy: currentCoords.accuracy,
        distance: result.distanceMeters,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5E7EB]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#C62828]" />
            <h3 className="text-sm font-bold text-[#202124]">School Geofence Check</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-center">
          {isLocating ? (
            <div className="py-6 flex flex-col items-center justify-center gap-3">
              <Navigation className="w-8 h-8 text-[#C62828] animate-spin" />
              <p className="text-xs font-semibold text-[#202124]">Acquiring fresh high-accuracy GPS position...</p>
              <p className="text-[11px] text-[#667085]">Please ensure GPS is enabled on your device.</p>
            </div>
          ) : errorMsg ? (
            <div className="py-3 flex flex-col items-center gap-2 text-center">
              <AlertCircle className="w-8 h-8 text-[#B91C1C]" />
              <p className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</p>
              <button
                onClick={requestLocation}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#8E1B1B]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry GPS</span>
              </button>
            </div>
          ) : result ? (
            <div className="space-y-3">
              {result.isInside ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                  <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-600 mb-1" />
                  <p className="text-xs font-bold text-emerald-900">Verified On School Premises</p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Distance: <strong>{Math.round(result.distanceMeters)}m</strong> from school center (Geofence: {geofenceRadiusMeters}m)
                  </p>
                  <p className="text-[10px] text-emerald-600">
                    GPS accuracy: ±{Math.round(result.accuracyMeters)}m
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
                  <AlertCircle className="mx-auto w-8 h-8 text-[#B91C1C] mb-1" />
                  <p className="text-xs font-bold text-[#B91C1C]">Outside School Premises</p>
                  <p className="text-[11px] text-red-700 mt-1">
                    You are <strong>{Math.round(result.distanceMeters)}m</strong> away.
                    Attendance can only be recorded within <strong>{geofenceRadiusMeters}m</strong> of the school.
                  </p>
                  <p className="text-[10px] text-red-600 mt-1">
                    GPS Accuracy: ±{Math.round(result.accuracyMeters)}m
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-center pt-2">
                <button
                  onClick={requestLocation}
                  className="flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#202124] hover:bg-gray-50"
                >
                  <RefreshCw className="w-3 h-3 text-[#667085]" />
                  <span>Refresh GPS</span>
                </button>

                {result.isInside && (
                  <button
                    onClick={handleProceed}
                    className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#8E1B1B] shadow-xs"
                  >
                    <span>Proceed to {actionTitle}</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
