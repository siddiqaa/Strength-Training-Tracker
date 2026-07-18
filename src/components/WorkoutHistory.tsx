/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Workout, OperationType } from '../types';
import { History, Calendar } from 'lucide-react';

export function WorkoutHistory({ workouts }: { workouts: Workout[] }) {
  if (workouts.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
        <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">No workouts logged yet. Start training!</p>
      </div>
    );
  }

  const exercises = Array.from(new Set(workouts.map(w => w.exerciseName))).sort();

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-zinc-500" />
        <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Training Archive</h2>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-2 sm:p-4 shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-2 border-b border-zinc-800 text-[10px] font-black text-white uppercase tracking-widest align-bottom">Exercise</th>
              <th className="p-2 border-b border-zinc-800 text-[10px] font-black text-red-500 uppercase tracking-widest text-center align-bottom">
                <div>Heavy</div>
                {workouts.find(w => w.intensity === 'Heavy')?.date && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(workouts.find(w => w.intensity === 'Heavy')!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[10px] font-black text-blue-500 uppercase tracking-widest text-center align-bottom">
                <div>Light</div>
                {workouts.find(w => w.intensity === 'Light')?.date && (
                  <div className="text-[8px] text-zinc-600 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(workouts.find(w => w.intensity === 'Light')!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </th>
              <th className="p-2 border-b border-zinc-800 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center align-bottom">
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
              const heavy = workouts.find(w => w.exerciseName === exercise && w.intensity === 'Heavy');
              const light = workouts.find(w => w.exerciseName === exercise && w.intensity === 'Light');
              const medium = workouts.find(w => w.exerciseName === exercise && w.intensity === 'Medium');

              return (
                <tr key={exercise} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="p-2 font-black text-white align-middle text-xs">{exercise}</td>
                  <td className="p-1 align-middle bg-red-500/5">
                    <TableCell workout={heavy} />
                  </td>
                  <td className="p-1 align-middle bg-blue-500/5">
                    <TableCell workout={light} />
                  </td>
                  <td className="p-1 align-middle bg-orange-500/5">
                    <TableCell workout={medium} />
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

function TableCell({ workout }: { workout?: Workout }) {
  if (!workout) return <div className="text-zinc-700 text-xs font-mono text-center py-2">-</div>;

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-xs font-mono whitespace-nowrap">
      <div className="flex items-center gap-1.5 font-black text-white">
        <span>
          {workout.weight} <span className="text-zinc-500 font-normal">lb</span>
        </span>
        <span className="text-zinc-700">|</span>
        <span className="text-zinc-300">
          {workout.set1}/{workout.set2}{workout.set3 !== undefined && workout.set3 !== null ? `/${workout.set3}` : ''}
        </span>
      </div>
      {workout.rpe && (
        <div className="flex items-center">
          <span className={`text-[9px] px-1.5 rounded-sm ${
            workout.rpe === 'E' ? 'bg-blue-500/20 text-blue-400' :
            workout.rpe === 'M' ? 'bg-orange-500/20 text-orange-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            RPE: {workout.rpe}
          </span>
        </div>
      )}
    </div>
  );
}
