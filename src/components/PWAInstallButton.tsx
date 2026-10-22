import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#8E1B1B] transition focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
        aria-label="Install StaffClock App on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#202124] hover:bg-gray-50 transition"
          aria-label="Install App on iPhone or iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#C62828]" />
          <span>Install (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-[#E5E7EB]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <h3 className="text-base font-semibold text-[#202124]">Install on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-xs text-[#202124] space-y-2">
                <p>To install StaffClock on your home screen for quick daily check-ins:</p>
                <ol className="list-decimal pl-5 space-y-1 text-[#667085]">
                  <li>Open this page in Safari.</li>
                  <li>Tap the <strong>Share</strong> button at the bottom.</li>
                  <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                </ol>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#C62828] py-2 text-xs font-medium text-white hover:bg-[#8E1B1B]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
