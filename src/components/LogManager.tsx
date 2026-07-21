import React, { useState } from 'react';
import { Workout, OperationType } from '../types';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Trash2, Edit2, Check, X, Calendar, Dumbbell, Hash, Target } from 'lucide-react';
import { format } from 'date-fns';

interface LogManagerProps {
  workouts: Workout[];
}

export function LogManager({ workouts }: LogManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Workout>>({});

  const handleStartEdit = (workout: Workout) => {
    setEditingId(workout.id);
    setEditData({ ...workout });
  };

  const handleSave = async (id: string) => {
    try {
      const workoutRef = doc(db, 'workouts', id);
      const { id: _, ...updateValues } = editData;
      await updateDoc(workoutRef, updateValues as any);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workouts/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'workouts', id));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workouts/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Log Management</h2>
          <p className="text-zinc-500 text-sm">Review, edit, or remove individual performance entries.</p>
        </div>
        <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            {workouts.length} Total Entries
          </span>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Exercise</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Sets/Reps</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Weight</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">RPE</th>
                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {workouts.map((workout) => {
                const isEditing = editingId === workout.id;
                const displayDate = workout.date ? format(new Date(workout.date), 'MMM dd, yyyy') : 'No Date';

                return (
                  <tr key={workout.id} className="hover:bg-zinc-900/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                        <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                        {displayDate}
                      </div>
                    </td>
                    <td className="p-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.exerciseName || ''}
                          onChange={(e) => setEditData({ ...editData, exerciseName: e.target.value })}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-3.5 h-3.5 text-blue-500/50" />
                          <span className="text-white font-bold text-sm">{workout.exerciseName}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={editData.set1 || 0}
                            onChange={(e) => setEditData({ ...editData, set1: Number(e.target.value) })}
                            className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-center text-xs text-white"
                            title="Set 1"
                          />
                          <input
                            type="number"
                            value={editData.set2 || 0}
                            onChange={(e) => setEditData({ ...editData, set2: Number(e.target.value) })}
                            className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-center text-xs text-white"
                            title="Set 2"
                          />
                          <input
                            type="number"
                            value={editData.set3 || 0}
                            onChange={(e) => setEditData({ ...editData, set3: Number(e.target.value) })}
                            className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-center text-xs text-white"
                            title="Set 3"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-sm font-mono text-white">
                          <span>{workout.set1}</span>
                          <span className="text-zinc-600">/</span>
                          <span>{workout.set2}</span>
                          {workout.set3 !== undefined && (
                            <>
                              <span className="text-zinc-600">/</span>
                              <span>{workout.set3}</span>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editData.weight || 0}
                          onChange={(e) => setEditData({ ...editData, weight: Number(e.target.value) })}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-center text-xs text-white mx-auto"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <span className="text-white font-mono">{workout.weight}</span>
                          <span className="text-zinc-600 text-[10px] uppercase font-black">Lbs</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {isEditing ? (
                        <select
                          value={editData.rpe || 'M'}
                          onChange={(e) => setEditData({ ...editData, rpe: e.target.value as any })}
                          className="bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-xs text-white mx-auto"
                        >
                          <option value="E">Easy</option>
                          <option value="M">Med</option>
                          <option value="H">Hard</option>
                        </select>
                      ) : (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs ${
                          workout.rpe === 'E' ? 'bg-green-500/10 border border-green-500/20 text-green-500' :
                          workout.rpe === 'M' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500' :
                          'bg-red-500/10 border border-red-500/20 text-red-500'
                        }`}>
                          {workout.rpe}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(workout.id)}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(workout)}
                              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                              title="Edit Log"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(workout.id)}
                              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${
                                confirmDeleteId === workout.id 
                                  ? 'bg-red-500 text-white px-2' 
                                  : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'
                              }`}
                              title={confirmDeleteId === workout.id ? "Click again to confirm" : "Delete Log"}
                            >
                              <Trash2 className="w-4 h-4" />
                              {confirmDeleteId === workout.id && (
                                <span className="text-[10px] font-black uppercase tracking-tighter">Confirm?</span>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {workouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Hash className="w-8 h-8 text-zinc-800" />
                      <p className="text-zinc-500 font-medium">No log entries found. Start training to see data here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
