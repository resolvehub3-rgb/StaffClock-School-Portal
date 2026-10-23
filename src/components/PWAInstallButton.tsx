import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

/**
 * Shown to every user/staff member who has NOT installed the app yet.
 * - Installed                 -> hidden
 * - Install prompt available  -> installs directly (native prompt)
 * - Otherwise (iOS, fresh visits, browsers without prompt support)
 *                             -> opens step-by-step install guide
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Browser can install the app natively (Chrome / Edge)
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

  // No native prompt yet (iOS Safari, first visits, other browsers) —
  // still show the button so new users/staff always see it.
  const steps = isIOS
    ? [
        'Open this page in Safari.',
        'Tap the Share button at the bottom.',
        'Scroll down and select Add to Home Screen.',
      ]
    : [
        'Android (Chrome): tap the ⋮ menu at the top-right, then choose “Install app” or “Add to Home screen”.',
        'iPhone / iPad (Safari): tap the Share button → Add to Home Screen.',
        'Computer (Chrome / Edge): click the install icon in the address bar, or the ⋮ menu → Install StaffClock.',
      ];

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#8E1B1B] transition focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
        aria-label="Install StaffClock App on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-base font-semibold text-[#202124]">Install StaffClock App</h3>
              <button
                onClick={() => setShowGuide(false)}
                className="text-[#667085] hover:text-[#202124] p-1 rounded-md"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 text-xs text-[#202124] space-y-2">
              <p>Add StaffClock to your home screen for quick daily check-ins:</p>
              <ol className="list-decimal pl-5 space-y-1 text-[#667085]">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-lg bg-[#C62828] py-2 text-xs font-medium text-white hover:bg-[#8E1B1B]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
