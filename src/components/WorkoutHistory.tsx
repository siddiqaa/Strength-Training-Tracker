/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Workout, OperationType } from '../types';
import { getOrderedExerciseNames, isSameDay, getWorkoutTotalReps } from '../lib/workoutUtils';
import { History, Calendar } from 'lucide-react';

export function WorkoutHistory({ workouts, userPlan }: { workouts: Workout[], userPlan?: any }) {
  const [stagnationThreshold, setStagnationThreshold] = useState(2);

  const lastHeavyWorkout = workouts.find(w => w.intensity === 'Heavy');
  const lastLightWorkout = workouts.find(w => w.intensity === 'Light');
  const lastMediumWorkout = workouts.find(w => w.intensity === 'Medium');

  const lastHeavyDate = lastHeavyWorkout ? new Date(lastHeavyWorkout.date) : null;
  const lastLightDate = lastLightWorkout ? new Date(lastLightWorkout.date) : null;
  const lastMediumDate = lastMediumWorkout ? new Date(lastMediumWorkout.date) : null;

  if (workouts.length === 0 && (!userPlan || Object.keys(userPlan).length === 0)) {
    return (
      <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
        <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">No workouts logged yet. Start training!</p>
      </div>
    );
  }

  // Helper to check if an exercise is inactive (case-insensitive and trimmed)
  const isExerciseInactive = (name: string): boolean => {
    if (!userPlan?.exerciseMetadata) return false;
    if (userPlan.exerciseMetadata[name]?.isInactive) return true;
    const normalized = name.trim().toLowerCase();
    for (const [key, meta] of Object.entries(userPlan.exerciseMetadata as Record<string, any>)) {
      if (key.trim().toLowerCase() === normalized && meta?.isInactive) {
        return true;
      }
    }
    return false;
  };

  // Only show active exercises from the current plan, keeping the plan's custom order
  let exercises: string[] = [];
  if (userPlan) {
    const allActive = new Set<string>();
    (['Heavy', 'Light', 'Medium'] as const).forEach(int => {
      Object.keys(userPlan[int] || {}).forEach(ex => {
        if (!isExerciseInactive(ex)) {
          allActive.add(ex);
        }
      });
    });

    if (userPlan.exerciseMetadata) {
      Object.keys(userPlan.exerciseMetadata).forEach(ex => {
        if (isExerciseInactive(ex)) {
          allActive.delete(ex);
        }
      });
    }

    exercises = getOrderedExerciseNames(
      userPlan.exerciseOrder,
      Array.from(allActive)
    ).filter(ex => allActive.has(ex));
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-500" />
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Training Archive</h2>
        </div>
        
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-3 py-1 self-start sm:self-center">
          <span className="text-[10px] font-black bg-cyan-400 text-zinc-950 px-1.5 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">Stagnation:</span>
          <select 
            value={stagnationThreshold} 
            onChange={(e) => setStagnationThreshold(Number(e.target.value))}
            className="bg-transparent text-[10px] font-mono text-zinc-400 outline-none cursor-pointer focus:text-white transition-colors"
          >
            {[2, 3, 4, 5, 6, 8, 10].map(v => (
              <option key={v} value={v} className="bg-zinc-900 text-white">{v} sessions</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-2 sm:p-4 shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[300px]">
          <thead>
            <tr>
              <th className="p-1 pr-0 sm:p-2 border-b border-zinc-800 text-[8px] sm:text-[10px] font-black text-white uppercase tracking-widest align-bottom w-[25%] sm:w-auto">Exercise</th>
              <th className="p-2 border-b border-zinc-800 text-[9px] sm:text-[10px] font-black text-red-500 uppercase tracking-widest text-center align-bottom">
                <div>Heavy</div>
                {lastHeavyDate && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {lastHeavyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest text-center align-bottom">
                <div>Light</div>
                {lastLightDate && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {lastLightDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-widest text-center align-bottom">
                <div>Medium</div>
                {lastMediumDate && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {lastMediumDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {exercises.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
                  No active exercises in plan
                </td>
              </tr>
            ) : (
              exercises.map(exercise => {
                const getHistoryForIntensity = (intensity: 'Heavy' | 'Light' | 'Medium') => 
                  workouts
                    .filter(w => w.exerciseName === exercise && w.intensity === intensity)
                    .sort((a, b) => {
                      const dateA = typeof a.date === 'number' ? a.date : new Date(a.date).getTime();
                      const dateB = typeof b.date === 'number' ? b.date : new Date(b.date).getTime();
                      return dateB - dateA;
                    });

                const heavyHistory = getHistoryForIntensity('Heavy');
                const lightHistory = getHistoryForIntensity('Light');
                const mediumHistory = getHistoryForIntensity('Medium');

                const heavy = lastHeavyDate ? heavyHistory.find(w => isSameDay(w.date, lastHeavyDate)) : undefined;
                const light = lastLightDate ? lightHistory.find(w => isSameDay(w.date, lastLightDate)) : undefined;
                const medium = lastMediumDate ? mediumHistory.find(w => isSameDay(w.date, lastMediumDate)) : undefined;

                return (
                  <tr key={exercise} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-1 pr-0 sm:p-2 font-normal text-white align-middle text-[9px] sm:text-xs leading-tight">
                      <span>{exercise}</span>
                    </td>
                    <td className="p-0.5 sm:p-1 align-middle bg-red-500/5">
                      <TableCell workout={heavy} history={heavyHistory} threshold={stagnationThreshold} />
                    </td>
                    <td className="p-1 align-middle bg-blue-500/5">
                      <TableCell workout={light} history={lightHistory} threshold={stagnationThreshold} />
                    </td>
                    <td className="p-1 align-middle bg-orange-500/5">
                      <TableCell workout={medium} history={mediumHistory} threshold={stagnationThreshold} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableCell({ workout, history, threshold }: { workout?: Workout, history: Workout[], threshold: number }) {
  if (!workout) return <div className="text-zinc-700 text-xs font-mono text-center py-2">-</div>;

  // Stagnation is calculated strictly within the history of the same intensity.
  // The 'threshold' represents the total number of sessions to include in the lookback.
  // Threshold 2: compares Current vs Previous (1 interval)
  // Threshold 3: compares Current vs Previous AND Previous vs Previous-1 (2 intervals)
  const isStagnant = history.length >= threshold && history.slice(0, threshold).every((w, i, arr) => {
    if (i === arr.length - 1) return true;
    const prev = arr[i+1];
    
    // Weight must be same or less than previous session of the SAME intensity
    const weightSameOrLess = Number(w.weight) <= Number(prev.weight);
    
    // Calculate total reps for comparison within same intensity
    const wTotal = getWorkoutTotalReps(w);
    const pTotal = getWorkoutTotalReps(prev);
    
    // Reps must be same or less than previous session of the SAME intensity
    const repsSameOrLess = wTotal <= pTotal;

    // Stagnation for this step is true if neither weight nor reps improved compared to the session before it.
    return weightSameOrLess && repsSameOrLess;
  });

  let weightColor = 'text-white';
  if (workout.rpe === 'E') weightColor = 'text-green-500';
  else if (workout.rpe === 'M') weightColor = 'text-yellow-500';
  else if (workout.rpe === 'H') weightColor = 'text-red-500';

  const setsList: (number | string)[] = [];
  for (let i = 1; ; i++) {
    const val = workout[`set${i}`];
    if (val !== undefined && val !== null && val !== '') {
      setsList.push(val);
    } else {
      const hasHigher = Object.keys(workout).some(k => {
        const match = k.match(/^set(\d+)$/);
        return match && Number(match[1]) > i && workout[k] !== undefined && workout[k] !== null && workout[k] !== '';
      });
      if (!hasHigher) break;
      setsList.push(0);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0 py-1.5 px-0 sm:px-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <span className={`${weightColor} font-bold sm:font-black sm:text-sm px-1 rounded ${isStagnant ? 'bg-cyan-400 text-zinc-950' : ''}`}>
          {workout.isBW ? 'BW' : workout.weight}
        </span>
        <span className="text-zinc-700 font-black">|</span>
        <span className="text-zinc-400 font-medium">
          {setsList.join(' ')}
        </span>
      </div>
    </div>
  );
}
