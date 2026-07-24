/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Workout, OperationType } from '../types';
import { getOrderedExerciseNames } from '../lib/workoutUtils';
import { History, Calendar } from 'lucide-react';

export function WorkoutHistory({ workouts, userPlan }: { workouts: Workout[], userPlan?: any }) {
  const [stagnationThreshold, setStagnationThreshold] = useState(2);

  if (workouts.length === 0 && (!userPlan || Object.keys(userPlan).length === 0)) {
    return (
      <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
        <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">No workouts logged yet. Start training!</p>
      </div>
    );
  }

  // Combine exercises from history and from the current plan, keeping the plan's custom order
  let planExercisesList: string[] = [];
  if (userPlan) {
    const allActive = new Set<string>();
    (['Heavy', 'Light', 'Medium'] as const).forEach(int => {
      Object.keys(userPlan[int] || {}).forEach(ex => allActive.add(ex));
    });
    planExercisesList = getOrderedExerciseNames(
      userPlan.exerciseOrder,
      Array.from(allActive)
    );
  }
  
  const planExercisesSet = new Set(planExercisesList);
  const historyExercises = workouts.map(w => w.exerciseName);
  const historyOnlyExercises = Array.from(new Set(historyExercises))
    .filter(ex => !planExercisesSet.has(ex))
    .sort();

  const exercises = [...planExercisesList, ...historyOnlyExercises];

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-500" />
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Training Archive</h2>
        </div>
        
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-3 py-1 self-start sm:self-center">
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest whitespace-nowrap">Stagnation:</span>
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
                {workouts.find(w => w.intensity === 'Heavy')?.date && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(workouts.find(w => w.intensity === 'Heavy')!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest text-center align-bottom">
                <div>Light</div>
                {workouts.find(w => w.intensity === 'Light')?.date && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(workouts.find(w => w.intensity === 'Light')!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-widest text-center align-bottom">
                <div>Medium</div>
                {workouts.find(w => w.intensity === 'Medium')?.date && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(workouts.find(w => w.intensity === 'Medium')!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {exercises.map(exercise => {
              const getHistory = (intensity: 'Heavy' | 'Light' | 'Medium') => 
                workouts
                  .filter(w => w.exerciseName === exercise && w.intensity === intensity)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              const heavyHistory = getHistory('Heavy');
              const lightHistory = getHistory('Light');
              const mediumHistory = getHistory('Medium');

              const heavy = heavyHistory[0];
              const light = lightHistory[0];
              const medium = mediumHistory[0];

              return (
                <tr key={exercise} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="p-1 pr-0 sm:p-2 font-normal text-white align-middle text-[9px] sm:text-xs leading-tight">{exercise}</td>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableCell({ workout, history, threshold }: { workout?: Workout, history: Workout[], threshold: number }) {
  if (!workout) return <div className="text-zinc-700 text-xs font-mono text-center py-2">-</div>;

  const isStagnant = history.length >= threshold && history.slice(0, threshold).every((w, i, arr) => {
    if (i === arr.length - 1) return true;
    return w.weight <= arr[i+1].weight;
  });

  let weightColor = 'text-white';
  if (workout.rpe === 'E') weightColor = 'text-green-500';
  else if (workout.rpe === 'M') weightColor = 'text-yellow-500';
  else if (workout.rpe === 'H') weightColor = 'text-red-500';

  return (
    <div className="flex flex-col items-center justify-center gap-0 py-1.5 px-0 sm:px-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <span className={`${weightColor} font-bold sm:font-black sm:text-sm px-1 rounded ${isStagnant ? 'bg-cyan-400 text-zinc-950' : ''}`}>
          {workout.weight}
        </span>
        <span className="text-zinc-700 font-black">|</span>
        <span className="text-zinc-400 font-medium">
          {workout.set1} {workout.set2}{workout.set3 !== undefined && workout.set3 !== null ? ` ${workout.set3}` : ''}
        </span>
      </div>
    </div>
  );
}
