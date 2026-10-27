/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { UserPlan, Intensity, Workout } from '../types';
import { calculateSessionDuration, formatDuration, formatClockTime } from '../lib/workoutUtils';
import { Timer, Clock, Hourglass, CheckCircle2, Zap, Dumbbell, Coffee } from 'lucide-react';

interface SessionDurationTrackerProps {
  userPlan: UserPlan | null;
  intensity: Intensity;
  enteredRepsByExercise?: Record<string, (string | number)[]>;
  workouts?: Workout[];
}

export const SessionDurationTracker: React.FC<SessionDurationTrackerProps> = ({
  userPlan,
  intensity,
  enteredRepsByExercise,
  workouts,
}) => {
  const [viewMode, setViewMode] = useState<'total' | 'workOnly'>('total');

  const stats = useMemo(() => {
    return calculateSessionDuration(userPlan, intensity, enteredRepsByExercise, workouts);
  }, [userPlan, intensity, enteredRepsByExercise, workouts]);

  if (stats.totalPlannedSets === 0) {
    return null;
  }

  const cadenceText = intensity === 'Heavy' ? '2s / rep cadence' : '3s / rep cadence';
  const cadenceBadgeColor = intensity === 'Heavy' 
    ? 'bg-red-500/10 text-red-400 border-red-500/20' 
    : intensity === 'Medium'
    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

  const isAllCompleted = stats.completedSets >= stats.totalPlannedSets && stats.remainingSeconds === 0;

  // Values depending on viewMode
  const activeForecast = viewMode === 'total' ? stats.forecastSeconds : stats.plannedWorkSeconds;
  const activeRemaining = viewMode === 'total' ? stats.remainingSeconds : stats.remainingWorkSeconds;
  const activeCompleted = viewMode === 'total' ? stats.completedSeconds : stats.completedWorkSeconds;

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl mb-6 backdrop-blur-sm transition-all duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Session Duration & Forecast
              </h3>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${cadenceBadgeColor}`}>
                {cadenceText}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              Live forecast vs remaining time dynamically updated as reps are entered
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Status Pill */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono">
            <button
              onClick={() => setViewMode('total')}
              className={`px-2 py-1 rounded-md transition-colors ${
                viewMode === 'total'
                  ? 'bg-orange-500 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Calculate total workout time (Lifting + Rest intervals)"
            >
              Work + Rest
            </button>
            <button
              onClick={() => setViewMode('workOnly')}
              className={`px-2 py-1 rounded-md transition-colors ${
                viewMode === 'workOnly'
                  ? 'bg-orange-500 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Calculate pure lifting time only (Time Under Tension @ 2s or 3s per rep)"
            >
              Work Only
            </button>
          </div>

          {isAllCompleted ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Done!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full whitespace-nowrap">
              <Clock className="w-3 h-3 text-orange-400" />
              <span>{stats.totalPlannedSets} sets</span>
            </span>
          )}
        </div>
      </div>

      {/* Primary 4-Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        {/* Forecast / Total Session */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              {viewMode === 'total' ? 'Forecast Total' : 'Forecast Work'}
            </span>
            <span className="font-mono text-[9px] text-zinc-500">
              {formatClockTime(activeForecast)}
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
              {formatDuration(activeForecast)}
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
              {viewMode === 'total' ? (
                <>Work: {formatDuration(stats.plannedWorkSeconds)} • Rest: {formatDuration(stats.plannedRestSeconds)}</>
              ) : (
                <>{stats.secondsPerRep}s / rep cadence</>
              )}
            </div>
          </div>
        </div>

        {/* Remaining Time */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between transition-colors ${
          isAllCompleted 
            ? 'bg-emerald-950/20 border-emerald-500/30' 
            : 'bg-zinc-900/60 border-zinc-800/80 ring-1 ring-orange-500/10'
        }`}>
          <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1 text-orange-400">
              <Hourglass className="w-3 h-3 text-orange-400 animate-pulse" />
              Remaining Time
            </span>
            <span className="font-mono text-[9px] text-orange-400/80">
              {formatClockTime(activeRemaining)}
            </span>
          </div>
          <div className="mt-1.5">
            <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${
              isAllCompleted ? 'text-emerald-400' : 'text-orange-400'
            }`}>
              {formatDuration(activeRemaining)}
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
              {viewMode === 'total' ? (
                <>{stats.totalPlannedSets - stats.completedSets} set{stats.totalPlannedSets - stats.completedSets === 1 ? '' : 's'} remaining</>
              ) : (
                <>Rem work: {formatDuration(stats.remainingWorkSeconds)}</>
              )}
            </div>
          </div>
        </div>

        {/* Completed Time */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap className="w-3 h-3 text-emerald-400" />
              Completed Time
            </span>
            <span className="font-mono text-[9px] text-zinc-500">
              {formatClockTime(activeCompleted)}
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
              {formatDuration(activeCompleted)}
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
              {viewMode === 'total' ? (
                <>{formatDuration(stats.completedWorkSeconds)} work + {formatDuration(stats.completedRestSeconds)} rest</>
              ) : (
                <>Lifting done so far</>
              )}
            </div>
          </div>
        </div>

        {/* Progress & Sets Count */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1 text-cyan-400">
              <Dumbbell className="w-3 h-3 text-cyan-400" />
              Sets Completed
            </span>
            <span className="font-mono text-[9px] text-cyan-400 font-bold">
              {stats.percentComplete}%
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
              {stats.completedSets} <span className="text-xs text-zinc-500 font-normal">/ {stats.totalPlannedSets}</span>
            </div>
            <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
              {isAllCompleted ? 'All targets hit' : `${stats.percentComplete}% session done`}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full mb-3">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Session Progress
          </span>
          <span className="font-bold text-zinc-300">{stats.percentComplete}%</span>
        </div>
        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 p-0.5">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
            style={{ width: `${Math.max(stats.percentComplete > 0 ? 3 : 0, stats.percentComplete)}%` }}
          />
        </div>
      </div>

      {/* Transparent Detailed Breakdown Banner */}
      <div className="pt-2.5 border-t border-zinc-800/70 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Dumbbell className="w-3 h-3 text-orange-400" />
            <span>Lifting Time ({stats.secondsPerRep}s/rep):</span>
          </span>
          <span className="text-zinc-200 font-bold">
            Done: {formatDuration(stats.completedWorkSeconds)} • Rem: {formatDuration(stats.remainingWorkSeconds)} • Total: {formatDuration(stats.plannedWorkSeconds)}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Coffee className="w-3 h-3 text-blue-400" />
            <span>Rest Intervals:</span>
          </span>
          <span className="text-zinc-200 font-bold">
            Done: {formatDuration(stats.completedRestSeconds)} • Rem: {formatDuration(stats.remainingRestSeconds)} • Total: {formatDuration(stats.plannedRestSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
};
