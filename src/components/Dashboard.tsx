/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp, writeBatch, Timestamp, query, where } from 'firebase/firestore';
import { UserPlan, Intensity, Workout, OperationType } from '../types';
import { PlanEditor } from './PlanEditor';
import { WorkoutHistory } from './WorkoutHistory';
import { ProgressChart } from './ProgressChart';
import { IntensityChart } from './IntensityChart';
import { LogManager } from './LogManager';
import { JsonEditorModal } from './JsonEditorModal';
import { Plus, Database, AlertCircle, FileJson, Download } from 'lucide-react';

export function Dashboard() {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    const cached = localStorage.getItem('workouts_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [intensity, setIntensity] = useState<Intensity>('Heavy');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'progress' | 'editor' | 'logs'>('data');
  const [showJsonEditor, setShowJsonEditor] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          date: d.date?.toMillis ? d.date.toMillis() : Date.now()
        } as Workout;
      });
      data.sort((a, b) => b.date - a.date);
      setWorkouts(data);
      localStorage.setItem('workouts_cache', JSON.stringify(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workouts');
    });
    return () => unsubscribe();
  }, []);

  const lastLoggedDate = React.useMemo(() => {
    const last = workouts.find(w => w.intensity === intensity);
    return last ? new Date(last.date) : null;
  }, [workouts, intensity]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const planRef = doc(db, 'userPlans', auth.currentUser.uid);
    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data() as any;
        let needsUpdate = false;
        
        if ('order' in rawData) {
          delete rawData.order;
          needsUpdate = true;
        }
        
        // Ensure globalOrder property exists
        if (!rawData.globalOrder) {
          const allActive = new Set<string>();
          (['Heavy', 'Light', 'Medium'] as const).forEach(int => {
            Object.keys(rawData[int] || {}).forEach(ex => allActive.add(ex));
          });
          rawData.globalOrder = Array.from(allActive).sort();
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          setDoc(planRef, rawData).catch(error => console.error('Error cleaning up userPlan order:', error));
        }
        
        setUserPlan(rawData as UserPlan);
      } else {
        const defaultUserPlan: UserPlan = {
          userId: auth.currentUser!.uid,
          Heavy: {},
          Light: {},
          Medium: {},
          globalOrder: []
        };
        setDoc(planRef, defaultUserPlan).catch(error => handleFirestoreError(error, OperationType.WRITE, `userPlans/${auth.currentUser?.uid}`));
        setUserPlan(defaultUserPlan);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `userPlans/${auth.currentUser?.uid}`);
    });
    return () => unsubscribe();
  }, []);

  const generateSampleData = async () => {
    if (!auth.currentUser || !userPlan) return;
    setIsGenerating(true);
    try {
      const batch = writeBatch(db);
      const userId = auth.currentUser.uid;
      
      for (let week = 0; week < 4; week++) {
        const days = [
          { int: 'Heavy' as Intensity, dayOffset: 0 },
          { int: 'Light' as Intensity, dayOffset: 2 },
          { int: 'Medium' as Intensity, dayOffset: 4 }
        ];
        
        for (const { int, dayOffset } of days) {
          const plan = userPlan[int] || {};
          const globalOrder = userPlan.globalOrder || [];
          const allExercises = Object.keys(plan).sort((a, b) => {
            const idxA = globalOrder.indexOf(a);
            const idxB = globalOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
          });
          
          const date = new Date();
          // Go back 4 weeks, week 0 is oldest, week 3 is newest
          date.setDate(date.getDate() - (4 - week) * 7 + dayOffset);
          
          for (const exercise of allExercises) {
            const target = plan[exercise] || {};
            const expectedSets = target.sets || 3;
            const targetReps = parseInt(target.reps?.split('-')?.[0]) || parseInt(target.reps) || 8;
            
            let baseWeight = target.weight;
            if (baseWeight === undefined || isNaN(baseWeight)) {
               const heavyWeight = userPlan['Heavy']?.[exercise]?.weight;
               if (heavyWeight !== undefined && !isNaN(heavyWeight)) {
                 if (int === 'Light') baseWeight = Math.round(heavyWeight * 0.6);
                 if (int === 'Medium') baseWeight = Math.round(heavyWeight * 0.75);
               }
            }
            if (baseWeight === undefined || isNaN(baseWeight)) baseWeight = 50;
            
            // Start 7.5 lighter 4 weeks ago, end at target weight this week.
            // Randomly force stagnation for some exercise-intensity pairs to test the UI indicator
            const isStagnantPair = (exercise.charCodeAt(0) + int.charCodeAt(0)) % 3 === 0;
            const weightDiff = isStagnantPair ? -5 : (week - 3) * 2.5; 
            
            const rpeOptions: ('E' | 'M' | 'H')[] = ['E', 'M', 'H'];
            const randomRpe = rpeOptions[Math.floor(Math.random() * rpeOptions.length)];

            const docRef = doc(collection(db, 'workouts'));
            batch.set(docRef, {
              userId,
              exerciseName: exercise,
              weight: Math.max(0, baseWeight + weightDiff),
              set1: targetReps,
              set2: targetReps,
              ...(expectedSets >= 3 ? { set3: targetReps } : {}),
              intensity: int,
              targetWeight: target.weight !== undefined ? target.weight : baseWeight,
              targetReps: target.reps || '8',
              targetSets: expectedSets,
              rpe: randomRpe,
              date: Timestamp.fromDate(date),
            });
          }
        }
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-seed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    const fourWeeksAgo = Date.now() - 2419200000;
    const recentWorkouts = workouts.filter(w => w.date >= fourWeeksAgo);
    
    const exportData = {
      userPlan,
      workouts: recentWorkouts,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!userPlan) return <div className="text-center py-12 text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading Plan Data...</div>;

  const activePlan = userPlan[intensity] || {};

  return (
    <div className="space-y-8 mt-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'data' ? 'bg-orange-500 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Data Entry
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'progress' ? 'bg-orange-500 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Progress Review
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'editor' ? 'bg-orange-500 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Plan Editor
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'logs' ? 'bg-orange-500 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Logs
          </button>
        </div>
        
        <button
           onClick={handleExport}
           className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
           title="Export Backup (Last 4 Weeks)"
        >
           <Download className="w-4 h-4" />
           <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {activeTab === 'data' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-4 sm:p-6 lg:p-8 shadow-xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                PLAN VS ACTUAL
              </h2>
              {lastLoggedDate && (
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest pl-5 flex items-center gap-2">
                  Last {intensity} log: <span className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">{lastLoggedDate.toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex w-full lg:w-auto gap-2 p-1.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                {(['Heavy', 'Light', 'Medium'] as Intensity[]).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setIntensity(tier)}
                    className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      intensity === tier ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              {/* AI Agent: DO NOT REMOVE THIS SEED DATA FEATURE DURING REFACTORS */}
              <button 
                onClick={generateSampleData} 
                disabled={true} 
                className="hidden items-center gap-2 px-4 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50 border border-zinc-700"
                title="Seed data feature is temporarily disabled"
              >
                <Database className="w-4 h-4" />
                {isGenerating ? 'Seeding...' : 'Seed Data'}
              </button>
            </div>
          </div>

          <div className="mb-8 p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-400 text-xs flex flex-col sm:flex-row gap-4 items-center justify-center">
            <span className="font-bold text-zinc-300 uppercase tracking-widest text-[10px]">Target Sets, Reps, Rest:</span>
            <div className="flex flex-wrap justify-center gap-3">
               <span className="text-red-400 font-mono whitespace-nowrap">Heavy: 3×6-8 ({userPlan.dayMetadata?.Heavy?.restPeriod ?? 90}s rest)</span>
               <span className="text-zinc-700 hidden sm:inline">|</span>
               <span className="text-blue-400 font-mono whitespace-nowrap">Light: 2×15 ({userPlan.dayMetadata?.Light?.restPeriod ?? 90}s rest)</span>
               <span className="text-zinc-700 hidden sm:inline">|</span>
               <span className="text-orange-400 font-mono whitespace-nowrap">Medium: 3×10-12 ({userPlan.dayMetadata?.Medium?.restPeriod ?? 90}s rest)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
              <div className="col-span-3">Exercise</div>
              <div className="col-span-2 text-center">Target (Wt)</div>
              <div className="col-span-5 text-center">Actual (Wt / Set / Rep)</div>
              <div className="col-span-2 text-center">Action</div>
            </div>
            
            {(() => {
              const planExercises = Object.keys(userPlan[intensity] || {});
              const globalOrder = userPlan.globalOrder || [];
              const sortedExercises = [...planExercises].sort((a, b) => {
                const idxA = globalOrder.indexOf(a);
                const idxB = globalOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              });

              return sortedExercises.map((exercise) => {
                const target = activePlan[exercise];
                if (!target) return null;
                return (
                  <PlanRow 
                    key={exercise} 
                    exercise={exercise} 
                    target={target} 
                    intensity={intensity} 
                    userPlan={userPlan} 
                    workouts={workouts}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}
      
      {activeTab === 'progress' && (
        <div className="space-y-8 mt-4">
          <ProgressChart workouts={workouts} userPlan={userPlan} />
          <IntensityChart workouts={workouts} />
          <WorkoutHistory workouts={workouts} userPlan={userPlan} />
        </div>
      )}
      
      {activeTab === 'editor' && (
        <div className="mt-4 relative">
          <PlanEditor 
            userPlan={userPlan} 
            onRawEdit={() => setShowJsonEditor(true)}
            onDeleteExercise={async (exercise: string) => {
              if (!auth.currentUser) return;
              const workoutsToDelete = workouts.filter(w => w.exerciseName === exercise);
              if (workoutsToDelete.length > 0) {
                const batch = writeBatch(db);
                let count = 0;
                for (const w of workoutsToDelete) {
                  if (w.id) {
                    batch.delete(doc(db, 'workouts', w.id));
                    count++;
                  }
                  if (count === 500) break; // limit to one batch
                }
                if (count > 0) {
                  try {
                    await batch.commit();
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, 'batch-delete-exercise');
                  }
                }
              }
            }}
            onSave={async (newPlan) => {
              if (!auth.currentUser) return;
              const path = `userPlans/${auth.currentUser.uid}`;
              try {
                const planRef = doc(db, 'userPlans', auth.currentUser.uid);
                await setDoc(planRef, newPlan);
                setUserPlan(newPlan);
                setActiveTab('data');
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, path);
              }
            }} 
          />
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="mt-4">
          <LogManager workouts={workouts} />
        </div>
      )}

      {showJsonEditor && (
        <JsonEditorModal 
          userPlan={userPlan}
          onClose={() => setShowJsonEditor(false)}
          onSave={async (newPlan) => {
            if (!auth.currentUser) return;
            const path = `userPlans/${auth.currentUser.uid}`;
            try {
              const planRef = doc(db, 'userPlans', auth.currentUser.uid);
              await setDoc(planRef, newPlan);
              setUserPlan(newPlan);
              setShowJsonEditor(false);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, path);
            }
          }}
        />
      )}
    </div>
  );
}

const PlanRow: React.FC<{ exercise: string, target: any, intensity: Intensity, userPlan: UserPlan, workouts: Workout[] }> = ({ exercise, target, intensity, userPlan, workouts }) => {
  const [actualWt, setActualWt] = useState(target.weight);
  const [set1, set1Reps] = useState(target.reps.split('-')[0] || target.reps);
  const [set2, set2Reps] = useState(target.reps.split('-')[0] || target.reps);
  const [set3, set3Reps] = useState(target.reps.split('-')[0] || target.reps);
  const [rpe, setRpe] = useState<'E' | 'M' | 'H'>('M');
  const [isLogging, setIsLogging] = useState(false);

  const lastWorkoutWeight = React.useMemo(() => {
    const last = workouts.find(w => w.exerciseName === exercise && w.intensity === intensity);
    return last ? last.weight : null;
  }, [workouts, exercise, intensity]);

  const isSingleDay = React.useMemo(() => {
    let count = 0;
    (['Heavy', 'Light', 'Medium'] as const).forEach(int => {
      const order = userPlan.order?.[int] || Object.keys(userPlan[int] || {});
      if (order.includes(exercise)) {
        count++;
      }
    });
    return count === 1;
  }, [userPlan, exercise]);

  useEffect(() => {
    setActualWt(target.weight);
    set1Reps(target.reps.split('-')[0] || target.reps);
    set2Reps(target.reps.split('-')[0] || target.reps);
    set3Reps(target.reps.split('-')[0] || target.reps);
    setRpe('M');
  }, [target]);

  const expectedSets = target.sets || 3;

  const handleLog = async () => {
    if (!auth.currentUser) return;
    setIsLogging(true);
    try {
      // Find if an entry already exists for this exercise on this calendar date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingWorkout = workouts.find(w => {
        const wDate = new Date(w.date);
        return w.exerciseName === exercise && 
               wDate >= today && 
               wDate < tomorrow;
      });

      const workoutData = {
        userId: auth.currentUser.uid,
        exerciseName: exercise,
        weight: Number(actualWt),
        set1: Number(set1),
        set2: Number(set2),
        ...(expectedSets >= 3 ? { set3: Number(set3) } : {}),
        intensity,
        targetWeight: target.weight,
        targetReps: target.reps,
        targetSets: expectedSets,
        rpe,
        date: serverTimestamp(),
      };

      if (existingWorkout?.id) {
        await setDoc(doc(db, 'workouts', existingWorkout.id), workoutData);
      } else {
        await addDoc(collection(db, 'workouts'), workoutData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workouts');
    } finally {
      setIsLogging(false);
    }
  };
  
  const handleSaveTarget = async () => {
     if (!auth.currentUser) return;
     const path = `userPlans/${auth.currentUser.uid}`;
     try {
       const planRef = doc(db, 'userPlans', auth.currentUser.uid);
       const updated = { ...userPlan };
       updated[intensity][exercise] = {
         weight: Number(actualWt),
         sets: expectedSets,
         reps: String(set1),
       };
       await setDoc(planRef, updated);
     } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, path);
     }
  }

  const isDiff = actualWt !== target.weight || String(set1) !== (target.reps.split('-')[0] || target.reps);

  let calcWeight = null;
  const heavyPlanWeight = userPlan['Heavy']?.[exercise]?.weight;
  
  if ((intensity === 'Light' || intensity === 'Medium') && heavyPlanWeight !== undefined) {
    if (intensity === 'Light') {
      calcWeight = Math.round(heavyPlanWeight * 0.6);
    } else if (intensity === 'Medium') {
      calcWeight = Math.round(heavyPlanWeight * 0.75);
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between w-full md:contents">
        <div className="md:col-span-3 w-full font-bold text-white text-base md:text-sm flex flex-col">
          <div className="flex items-center gap-2 truncate">
            <span className="truncate" title={exercise}>{exercise}</span>
            {isSingleDay && <span title="One Day a Week Only" className="flex items-center"><AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" /></span>}
          </div>
          {/* Desktop Notes: Keep them under title for grid clarity */}
          {userPlan.exerciseMetadata?.[exercise]?.notes && (
            <div className="hidden md:block mt-1">
              <p className="text-[10px] text-zinc-500 font-medium leading-tight italic line-clamp-2">
                {userPlan.exerciseMetadata[exercise].notes}
              </p>
            </div>
          )}
        </div>
        
        <div className="md:col-span-2 flex items-center justify-center font-mono text-sm bg-zinc-900/80 py-1.5 md:py-2 px-3 rounded-xl border border-zinc-800">
          <span className="text-white" title="Plan">{target.weight}</span>
          <span className="text-zinc-600 mx-1.5">/</span>
          <span className="text-zinc-400" title="Last">{lastWorkoutWeight !== null ? lastWorkoutWeight : '-'}</span>
          {calcWeight !== null && (
            <>
              <span className="text-zinc-600 mx-1.5">/</span>
              <span className="text-black bg-zinc-300 px-1 rounded" title="Calculated">{calcWeight}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="md:col-span-5 w-full flex flex-row gap-2 md:gap-1 justify-between md:justify-center items-center bg-zinc-900/40 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none">
        <input type="number" step="any" value={actualWt} onChange={e => setActualWt(Number(e.target.value))} className="w-16 md:w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Actual Weight" />
        
        <span className="text-zinc-600 font-black px-1 hidden md:flex items-center">|</span>
        
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="flex gap-1.5 md:gap-1">
            <input type="number" value={set1} onChange={e => set1Reps(Number(e.target.value))} className="w-12 md:w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 1 Reps" />
            <input type="number" value={set2} onChange={e => set2Reps(Number(e.target.value))} className="w-12 md:w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 2 Reps" />
            {expectedSets >= 3 && (
              <input type="number" value={set3} onChange={e => set3Reps(Number(e.target.value))} className="w-12 md:w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 3 Reps" />
            )}
          </div>
            
            <div className="flex items-center p-0.5 bg-zinc-950 md:bg-zinc-900 rounded-lg border border-zinc-700 ml-1 md:ml-0">
              {(['E', 'M', 'H'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setRpe(level)}
                  className={`w-[26px] h-[34px] md:w-6 md:h-8 rounded md:rounded-md text-[10px] font-black transition-colors flex items-center justify-center ${
                    rpe === level 
                      ? level === 'E' ? 'bg-green-500 text-white' : level === 'M' ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={`RPE ${level === 'E' ? 'Easy' : level === 'M' ? 'Medium' : 'Hard'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
      </div>
      
      <div className="md:col-span-2 w-full flex flex-col gap-2">
        {/* Mobile Notes: Full width above button */}
        {userPlan.exerciseMetadata?.[exercise]?.notes && (
          <div className="md:hidden p-2.5 bg-orange-500/5 border-l-2 border-orange-500/20 rounded-r-xl mb-1">
            <p className="text-[11px] text-zinc-300 font-medium leading-relaxed italic whitespace-pre-wrap">
              {userPlan.exerciseMetadata[exercise].notes}
            </p>
          </div>
        )}
        <div className="flex flex-row md:flex-col gap-2">
          <button onClick={handleLog} disabled={isLogging} className="flex-1 bg-white text-black text-[10px] font-black uppercase tracking-widest py-3 md:py-2.5 rounded-xl hover:bg-orange-500 hover:text-white transition-colors flex justify-center items-center gap-1 active:scale-95 disabled:opacity-50">
            {isLogging ? '...' : <><Plus className="w-3 h-3"/> Log</>}
          </button>
          {isDiff && (
            <button onClick={handleSaveTarget} className="flex-1 bg-zinc-800 text-blue-400 text-[10px] font-black uppercase tracking-widest py-3 md:py-1.5 rounded-xl md:rounded-lg hover:bg-blue-500 hover:text-white transition-colors border border-zinc-700 hover:border-blue-500 active:scale-95">
              Update Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
