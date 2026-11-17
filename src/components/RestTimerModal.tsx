import React, { useState, useEffect, useRef } from 'react';
import { Intensity } from '../types';
import { X, Play, Pause, RotateCcw, Plus, Minus, Timer, CheckCircle2, Clock, Hourglass, Dumbbell } from 'lucide-react';
import { formatDuration } from '../lib/workoutUtils';

interface RestTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restSeconds: number;
  exerciseName: string;
  intensity: Intensity;
  sessionRemainingSeconds?: number;
  sessionTotalPlannedSets?: number;
  sessionCompletedSets?: number;
  sessionForecastSeconds?: number;
}

export const RestTimerModal: React.FC<RestTimerModalProps> = ({
  isOpen,
  onClose,
  restSeconds,
  exerciseName,
  intensity,
  sessionRemainingSeconds,
  sessionTotalPlannedSets,
  sessionCompletedSets,
  sessionForecastSeconds,
}) => {
  const [timeLeft, setTimeLeft] = useState(restSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [hasFinished, setHasFinished] = useState(false);
  
  // Store target end timestamp (Date.now() + remainingMs) to prevent background throttling drift
  const endTimeRef = useRef<number>(Date.now() + restSeconds * 1000);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound generator using Web Audio API
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      
      // Play 2 quick soft notification tones
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playTone(880, audioCtx.currentTime, 0.2); // A5
      playTone(1174.66, audioCtx.currentTime + 0.25, 0.4); // D6
    } catch {
      // Ignore audio errors if blocked by browser policy
    }
  };

  // Function to sync remaining time based on actual system clock delta
  const syncTimeLeft = () => {
    if (!isRunning) return;
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
    setTimeLeft(remainingSeconds);
    if (remainingSeconds <= 0) {
      setIsRunning(false);
      setHasFinished(true);
      playBeep();
    }
  };

  // Reset timer state when modal opens
  useEffect(() => {
    if (isOpen) {
      endTimeRef.current = Date.now() + restSeconds * 1000;
      setTimeLeft(restSeconds);
      setIsRunning(true);
      setHasFinished(false);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen, restSeconds]);

  // Handle countdown interval & visibility/focus sync
  useEffect(() => {
    if (isOpen && isRunning && !hasFinished) {
      // Immediately calculate current remaining time on start/resume
      syncTimeLeft();

      timerRef.current = setInterval(() => {
        syncTimeLeft();
      }, 250); // Tick frequently to keep UI crisp

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          syncTimeLeft();
        }
      };

      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleVisibilityChange);
      };
    }
  }, [isOpen, isRunning, hasFinished]);

  // Auto-dismiss modal after timer completes
  useEffect(() => {
    let dismissTimeout: NodeJS.Timeout | null = null;
    if (isOpen && hasFinished) {
      dismissTimeout = setTimeout(() => {
        onClose();
      }, 1200);
    }
    return () => {
      if (dismissTimeout) clearTimeout(dismissTimeout);
    };
  }, [isOpen, hasFinished, onClose]);

  // Handle ESC key to dismiss modal cleanly without affecting logged data
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / (restSeconds || 1)) * 100));

  const handleAdjustTime = (delta: number) => {
    setTimeLeft((prev) => {
      const newTime = Math.max(0, prev + delta);
      endTimeRef.current = Date.now() + newTime * 1000;
      return newTime;
    });
    if (hasFinished && delta > 0) {
      setHasFinished(false);
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    endTimeRef.current = Date.now() + restSeconds * 1000;
    setTimeLeft(restSeconds);
    setIsRunning(true);
    setHasFinished(false);
  };

  const handleTogglePlayPause = () => {
    if (!isRunning) {
      // When resuming from pause, recalculate endTimeRef based on current timeLeft
      endTimeRef.current = Date.now() + timeLeft * 1000;
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  const intensityBadgeClass =
    intensity === 'Heavy'
      ? 'bg-red-500/10 text-red-500 border-red-500/30'
      : intensity === 'Light'
      ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
      : 'bg-orange-500/10 text-orange-500 border-orange-500/30';

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="pointer-events-auto bg-zinc-900 border border-zinc-700 rounded-3xl p-5 sm:p-6 max-w-md w-full text-center relative shadow-2xl shadow-black/80 flex flex-col gap-4 sm:gap-5">
        {/* Header: Exercise info + Sync & Close actions */}
        <div className="flex items-start justify-between w-full pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl flex-shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate max-w-[200px] sm:max-w-[240px]" title={exerciseName}>
                  {exerciseName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border flex-shrink-0 ${intensityBadgeClass}`}>
                  {intensity}
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-medium block mt-0.5">
                Target Rest: <span className="font-mono text-zinc-300 font-bold">{restSeconds}s</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <button
              onClick={syncTimeLeft}
              className="p-2 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded-xl transition-colors"
              title="Sync with System Clock"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              title="Dismiss Timer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Digital Countdown & Linear Progress (No Circle) */}
        <div className="w-full flex flex-col items-center justify-center py-2 sm:py-3">
          {hasFinished ? (
            <div className="flex items-center gap-2.5 text-green-400 py-2 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
              <span className="text-xl sm:text-2xl font-black uppercase tracking-widest">
                Rest Done!
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <span className="text-5xl sm:text-6xl font-mono font-black text-white tracking-tight leading-none drop-shadow">
                {formatTime(timeLeft)}
              </span>
              <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isRunning ? 'text-orange-400' : 'text-zinc-500'}`}>
                {isRunning ? 'Resting...' : 'Paused'}
              </span>
            </div>
          )}

          {/* Sleek linear progress indicator */}
          <div className="w-full bg-zinc-800/90 h-2 sm:h-2.5 rounded-full overflow-hidden mt-3 sm:mt-4 shadow-inner">
            <div
              className={`h-full transition-all duration-300 ease-linear ${
                hasFinished ? 'bg-green-500 shadow-green-500/50' : 'bg-orange-500 shadow-orange-500/50'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-2 w-full">
          <button
            onClick={() => handleAdjustTime(-10)}
            disabled={timeLeft <= 0}
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-40 text-xs sm:text-sm font-bold font-mono active:scale-95"
            title="Subtract 10 Seconds"
          >
            -10s
          </button>

          <button
            onClick={handleTogglePlayPause}
            disabled={hasFinished}
            className="flex-1 py-2.5 sm:py-3 px-4 bg-orange-500 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-orange-500/20 active:scale-95"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume
              </>
            )}
          </button>

          <button
            onClick={() => handleAdjustTime(10)}
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl hover:text-white hover:border-zinc-700 transition-colors text-xs sm:text-sm font-bold font-mono active:scale-95"
            title="Add 10 Seconds"
          >
            +10s
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 sm:p-3 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white hover:border-zinc-700 transition-colors active:scale-95"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Session Time & Sets Remaining Card */}
        {(sessionRemainingSeconds !== undefined || sessionTotalPlannedSets !== undefined) && (
          <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3 sm:p-3.5">
            <div className="grid grid-cols-2 gap-3 items-center">
              {/* Session Time Remaining */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl flex-shrink-0">
                  <Hourglass className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                    Session Left
                  </span>
                  <span 
                    className="text-sm sm:text-base font-black font-mono text-orange-400 truncate block mt-0.5"
                    title={sessionForecastSeconds !== undefined ? `Forecast Total: ${formatDuration(sessionForecastSeconds)}` : undefined}
                  >
                    {formatDuration(sessionRemainingSeconds ?? 0)}
                  </span>
                </div>
              </div>

              {/* Sets Remaining */}
              <div className="flex items-center gap-3 min-w-0 border-l border-zinc-800 pl-3">
                <div className="p-2 sm:p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl flex-shrink-0">
                  <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                    Sets Left
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-white truncate block mt-0.5">
                    {Math.max(0, (sessionTotalPlannedSets ?? 0) - (sessionCompletedSets ?? 0))}{' '}
                    {sessionTotalPlannedSets !== undefined && sessionTotalPlannedSets > 0 && (
                      <span className="text-xs text-zinc-400 font-normal">
                        ({sessionCompletedSets ?? 0}/{sessionTotalPlannedSets})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {sessionForecastSeconds !== undefined && sessionForecastSeconds > 0 && (
              <div className="mt-2.5 pt-2 border-t border-zinc-900/90 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Forecast: <span className="text-zinc-300 font-bold">{formatDuration(sessionForecastSeconds)}</span></span>
                {sessionTotalPlannedSets !== undefined && sessionTotalPlannedSets > 0 && (
                  <span className="font-semibold text-zinc-300">
                    {Math.min(100, Math.round(((sessionCompletedSets ?? 0) / sessionTotalPlannedSets) * 100))}% done
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 sm:py-3 bg-zinc-950/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs sm:text-sm font-black uppercase tracking-widest rounded-xl transition-colors active:scale-95"
        >
          Dismiss Timer
        </button>
      </div>
    </div>
  );
};
