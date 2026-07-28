import React, { useState, useEffect, useRef } from 'react';
import { Intensity } from '../types';
import { X, Play, Pause, RotateCcw, Plus, Minus, Timer, CheckCircle2, Clock } from 'lucide-react';

interface RestTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restSeconds: number;
  exerciseName: string;
  intensity: Intensity;
}

export const RestTimerModal: React.FC<RestTimerModalProps> = ({
  isOpen,
  onClose,
  restSeconds,
  exerciseName,
  intensity,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl flex flex-col items-center gap-6">
        {/* Manual Resync Clock Button */}
        <button
          onClick={() => {
            syncTimeLeft();
          }}
          className="absolute top-4 left-4 p-2 text-zinc-500 hover:text-orange-400 hover:bg-zinc-800 rounded-full transition-colors"
          title="Manual Sync with System Clock"
        >
          <Clock className="w-5 h-5" />
        </button>

        {/* Close / Dismiss button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          title="Cancel / Dismiss Timer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center gap-2 w-full pt-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
            <Timer className="w-4 h-4 text-orange-500" />
            <span>Rest Timer</span>
          </div>
          <h3 className="text-xl font-black text-white truncate max-w-[240px]" title={exerciseName}>
            {exerciseName}
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${intensityBadgeClass}`}>
            {intensity} Day ({restSeconds}s Rest)
          </span>
        </div>

        {/* Timer Visual Ring & Countdown */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Circular SVG Progress */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              className="stroke-zinc-800"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              className={`transition-all duration-1000 ease-linear ${
                hasFinished ? 'stroke-green-500' : 'stroke-orange-500'
              }`}
              strokeWidth="6"
              strokeDasharray="263.89"
              strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {hasFinished ? (
              <div className="flex flex-col items-center gap-1 animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <span className="text-xs font-black text-green-400 uppercase tracking-widest mt-1">
                  Rest Done!
                </span>
              </div>
            ) : (
              <>
                <span className="text-4xl font-mono font-black text-white tracking-tight">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                  {isRunning ? 'Resting...' : 'Paused'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-2 w-full">
          <button
            onClick={() => handleAdjustTime(-10)}
            disabled={timeLeft <= 0}
            className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-40"
            title="Subtract 10 Seconds"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={handleTogglePlayPause}
            disabled={hasFinished}
            className="flex-1 py-2.5 px-4 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-lg"
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
            className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white hover:border-zinc-700 transition-colors"
            title="Add 10 Seconds"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white hover:border-zinc-700 transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Cancel / Dismiss Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
        >
          Cancel / Dismiss
        </button>
      </div>
    </div>
  );
};
