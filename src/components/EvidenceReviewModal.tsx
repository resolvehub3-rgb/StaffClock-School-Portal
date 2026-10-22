import React, { useState, useEffect } from 'react';
import { getEvidenceSignedUrl } from '../lib/supabase';
import { X, ShieldCheck, Calendar, Clock, MapPin, AlertTriangle, Loader2 } from 'lucide-react';

interface EvidenceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidencePath: string | null;
  teacherName: string;
  schoolDate: string;
  checkInTime: string | null;
  status: string;
  distanceMeters?: number | null;
}

export const EvidenceReviewModal: React.FC<EvidenceReviewModalProps> = ({
  isOpen,
  onClose,
  evidencePath,
  teacherName,
  schoolDate,
  checkInTime,
  status,
  distanceMeters,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && evidencePath) {
      setIsLoading(true);
      setError(null);
      getEvidenceSignedUrl(evidencePath, 1800)
        .then((url) => {
          if (url) {
            setSignedUrl(url);
          } else {
            setError('Could not generate secure view link for this evidence.');
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to load photo');
        })
        .finally(() => setIsLoading(false));
    } else {
      setSignedUrl(null);
    }
  }, [isOpen, evidencePath]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden shadow-2xl border border-[#E5E7EB]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F8F8] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C62828]" />
            <h3 className="text-sm font-bold text-[#202124]">Attendance Photo Evidence</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Photo Container */}
          <div className="relative aspect-square w-full rounded-xl bg-gray-100 overflow-hidden border border-[#E5E7EB] flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-xs text-[#667085]">
                <Loader2 className="w-6 h-6 animate-spin text-[#C62828]" />
                <span>Decrypting secure photo evidence...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <AlertTriangle className="mx-auto w-6 h-6 text-amber-500 mb-1" />
                <p className="text-xs text-[#B91C1C] font-medium">{error}</p>
              </div>
            ) : signedUrl ? (
              <img
                src={signedUrl}
                alt={`Attendance selfie for ${teacherName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <p className="text-xs text-[#667085]">No photo evidence record available.</p>
            )}
          </div>

          {/* Details */}
          <div className="mt-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
              <span className="text-[#667085]">Teacher</span>
              <span className="font-bold text-[#202124]">{teacherName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
              <span className="text-[#667085] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date
              </span>
              <span className="font-medium text-[#202124]">{schoolDate}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
              <span className="text-[#667085] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Recorded Time
              </span>
              <span className="font-semibold text-[#202124]">{checkInTime || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
              <span className="text-[#667085]">Status</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  status === 'present'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'late'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {status.toUpperCase()}
              </span>
            </div>
            {distanceMeters != null && (
              <div className="flex justify-between items-center py-1">
                <span className="text-[#667085] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> School Distance
                </span>
                <span className="font-medium text-[#202124]">{Math.round(distanceMeters)}m from center</span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-gray-100 py-2 text-xs font-semibold text-[#202124] hover:bg-gray-200"
          >
            Close Evidence Review
          </button>
        </div>
      </div>
    </div>
  );
};
