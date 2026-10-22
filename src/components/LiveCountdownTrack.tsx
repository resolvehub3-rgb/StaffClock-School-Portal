import React, { useEffect, useState } from 'react';
import { calculateSchoolDayProgress, SchoolDayProgress } from '../utils/countdown';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface LiveCountdownTrackProps {
  openingTime?: string;
  closingTime?: string;
  className?: string;
}

export const LiveCountdownTrack: React.FC<LiveCountdownTrackProps> = ({
  openingTime = '06:00',
  closingTime = '16:30',
  className = '',
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [progress, setProgress] = useState<SchoolDayProgress>(() =>
    calculateSchoolDayProgress(new Date(), openingTime, closingTime)
  );

  useEffect(() => {
    // Update every second for live countdown
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      setProgress(calculateSchoolDayProgress(current, openingTime, closingTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [openingTime, closingTime]);

  const isWalking = progress.phase === 'school_in_session';
  const percentageDisplay = `${progress.percentage.toFixed(1)}%`;

  return (
    <div
      className={`bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-xs ${className}`}
      aria-label="Official School Day Countdown"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#C62828]" />
          <span className="text-xs font-semibold text-[#202124] uppercase tracking-wide">
            School Day Schedule ({openingTime} – {closingTime})
          </span>
        </div>
        <div className="text-xs font-medium text-[#667085]">
          {progress.phase === 'before_school' && (
            <span className="text-amber-700 font-semibold">Starts in {progress.timeRemainingFormatted}</span>
          )}
          {progress.phase === 'school_in_session' && (
            <span className="text-[#C62828] font-bold">{progress.timeRemainingFormatted} remaining</span>
          )}
          {progress.phase === 'school_ended' && (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> School Day Concluded
            </span>
          )}
        </div>
      </div>

      {/* Progress Track with Walking Figure */}
      <div className="relative pt-6 pb-2">
        {/* Walking Human Figure Avatar pinned to exact progress percentage */}
        <div
          className="absolute -top-1 transition-all duration-700 ease-out z-10 pointer-events-none"
          style={{
            left: `clamp(14px, ${progress.percentage}%, calc(100% - 24px))`,
            transform: 'translateX(-50%)',
          }}
          aria-hidden="true"
        >
          <div className="relative flex flex-col items-center">
            {/* Tooltip bubble with percentage */}
            <div className="mb-0.5 rounded-full bg-[#C62828] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              {percentageDisplay}
            </div>

            {/* Walking Character SVG */}
            <div className={`${isWalking ? 'animate-walking-bounce' : ''}`}>
              <svg
                width="24"
                height="28"
                viewBox="0 0 24 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#C62828] drop-shadow-xs"
              >
                {/* Head */}
                <circle cx="12" cy="5" r="3.5" fill="#C62828" />
                {/* Torso */}
                <path d="M12 9V17" stroke="#C62828" strokeWidth="2.5" strokeLinecap="round" />
                {/* Arms */}
                <path
                  d={isWalking ? "M8 12L12 14L16 11" : "M7 14L12 12L17 14"}
                  stroke="#C62828"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {/* Legs */}
                <path
                  d={isWalking ? "M12 17L9 25 M12 17L15 23" : "M12 17L10 25 M12 17L14 25"}
                  stroke="#C62828"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Progress Bar Background */}
        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden border border-[#E5E7EB]">
          <div
            className="h-full bg-gradient-to-r from-[#C62828] to-[#8E1B1B] transition-all duration-700 ease-out rounded-full"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Track Markers */}
        <div className="flex justify-between items-center text-[11px] font-medium text-[#667085] mt-2">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]" />
            <span>06:00 Opening</span>
          </div>

          <div className="text-center font-bold text-[#202124]">
            {percentageDisplay} Complete
          </div>

          <div className="flex items-center gap-1">
            <span>16:30 Dismissal</span>
            <span className={`w-1.5 h-1.5 rounded-full ${progress.isClosingTimePassed ? 'bg-emerald-600' : 'bg-gray-400'}`} />
          </div>
        </div>
      </div>

      {progress.isClosingTimePassed && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-[#8E1B1B] border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#C62828]" />
          <span>
            The school day has ended (16:30). If you have not checked out, please submit your checkout below.
          </span>
        </div>
      )}
    </div>
  );
};
