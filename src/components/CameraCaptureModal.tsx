import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob) => void;
  isSubmitting?: boolean;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  isSubmitting = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Start camera stream preferring front-facing camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsStartingCamera(true);
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser or context.');
      setIsStartingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please enable camera access in your browser settings to report on duty.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on your device.');
      } else {
        setCameraError(`Unable to start camera: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsStartingCamera(false);
    }
  }, [stopCameraStream]);

  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setPreviewUrl(null);
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, startCamera, stopCameraStream]);

  const handleSnap = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally for natural selfie mirroring
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          stopCameraStream();
        }
      },
      'image/jpeg',
      0.85
    );
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCapturedBlob(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#E5E7EB]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 bg-[#F8F8F8]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C62828]" />
            <h2 className="text-sm font-bold text-[#202124]">Live Duty Selfie Verification</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-[#667085] hover:bg-gray-200 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="p-4">
          <p className="mb-3 text-xs text-[#667085]">
            Take a clear live selfie on school grounds to confirm your arrival. Gallery uploads are prohibited.
          </p>

          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-black border-2 border-[#E5E7EB] shadow-inner flex items-center justify-center">
            {cameraError ? (
              <div className="p-4 text-center text-white">
                <AlertTriangle className="mx-auto mb-2 w-8 h-8 text-amber-400" />
                <p className="text-xs font-medium text-red-200">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8E1B1B]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Captured attendance selfie preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover transform -scale-x-100"
                />
                {isStartingCamera && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Initializing camera...
                  </div>
                )}
                {/* Face guide target oval */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-36 rounded-full border-2 border-dashed border-white/60 shadow-xs" />
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {!previewUrl ? (
              <button
                type="button"
                onClick={handleSnap}
                disabled={isStartingCamera || !!cameraError}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#C62828] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#8E1B1B] transition active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Selfie</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#202124] hover:bg-gray-100 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#667085]" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#15803D] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Check In</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
