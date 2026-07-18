/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp, writeBatch, Timestamp, query, where } from 'firebase/firestore';
import { UserPlan, Intensity, Workout } from '../types';
import { DEFAULT_PLAN } from '../data/defaultPlan';
import { WorkoutHistory } from './WorkoutHistory';
import { ProgressChart } from './ProgressChart';
import { Plus, Database } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'data' | 'progress'>('data');

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
        const rawData = docSnap.data() as UserPlan;
        if (rawData.Heavy && rawData.Heavy['Lat Pull Down']) {
          const resetPlan = {
            userId: auth.currentUser!.uid,
            Heavy: DEFAULT_PLAN.Heavy,
            Light: DEFAULT_PLAN.Light,
            Medium: DEFAULT_PLAN.Medium,
          };
          setDoc(planRef, resetPlan).catch(console.error);
          return;
        }
        setUserPlan(rawData);
      } else {
        const defaultUserPlan: UserPlan = {
          userId: auth.currentUser!.uid,
          Heavy: DEFAULT_PLAN.Heavy,
          Light: DEFAULT_PLAN.Light,
          Medium: DEFAULT_PLAN.Medium,
        };
        setDoc(planRef, defaultUserPlan).catch(console.error);
        setUserPlan(defaultUserPlan);
      }
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
          const plan = userPlan[int];
          const date = new Date();
          // Go back 4 weeks, week 0 is oldest, week 3 is newest
          date.setDate(date.getDate() - (4 - week) * 7 + dayOffset);
          
          for (const [exercise, targetRaw] of Object.entries(plan)) {
            const target = targetRaw as any;
            const expectedSets = target.sets || 3;
            const targetReps = parseInt(target.reps.split('-')[0]) || parseInt(target.reps) || 8;
            
            // Start 7.5lb lighter 4 weeks ago, end at target weight this week
            const weightDiff = (week - 3) * 2.5; 
            
            const docRef = doc(collection(db, 'workouts'));
            batch.set(docRef, {
              userId,
              exerciseName: exercise,
              weight: Math.max(0, target.weight + weightDiff),
              set1: targetReps,
              set2: targetReps,
              ...(expectedSets >= 3 ? { set3: targetReps } : {}),
              intensity: int,
              targetWeight: target.weight,
              targetReps: target.reps,
              targetSets: expectedSets,
              date: Timestamp.fromDate(date),
            });
          }
        }
      }
      
      await batch.commit();
    } catch (err) {
      console.error('Failed to generate sample data', err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!userPlan) return <div className="text-center py-12 text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading Plan Data...</div>;

  const activePlan = userPlan[intensity] || {};

  return (
    <div className="space-y-8 mt-4">
      <div className="flex gap-4 border-b border-zinc-800 pb-4">
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
      </div>

      {activeTab === 'data' ? (
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
              <button 
                onClick={generateSampleData} 
                disabled={isGenerating} 
                className="flex items-center gap-2 px-4 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50 border border-zinc-700"
              >
                <Database className="w-4 h-4" />
                {isGenerating ? 'Seeding...' : 'Seed Data'}
              </button>
            </div>
          </div>

          <div className="mb-8 p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl text-zinc-400 text-xs flex flex-col sm:flex-row gap-4 items-center justify-center">
            <span className="font-bold text-zinc-300 uppercase tracking-widest text-[10px]">Target Sets & Reps:</span>
            <div className="flex gap-3">
               <span className="text-red-400 font-mono">Heavy: 3×6-8</span>
               <span className="text-zinc-700">|</span>
               <span className="text-blue-400 font-mono">Light: 2×15</span>
               <span className="text-zinc-700">|</span>
               <span className="text-orange-400 font-mono">Medium: 3×10-12</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
              <div className="col-span-3">Exercise</div>
              <div className="col-span-2 text-center">Target (Wt)</div>
              <div className="col-span-5 text-center">Actual (Wt / Set / Rep)</div>
              <div className="col-span-2 text-center">Action</div>
            </div>
            
            {Object.entries(activePlan).map(([exercise, target]) => (
              <PlanRow 
                key={exercise} 
                exercise={exercise} 
                target={target} 
                intensity={intensity} 
                userPlan={userPlan} 
                workouts={workouts}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8 mt-4">
          <ProgressChart workouts={workouts} />
          <WorkoutHistory workouts={workouts} />
        </div>
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
      await addDoc(collection(db, 'workouts'), {
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
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLogging(false);
    }
  };
  
  const handleSaveTarget = async () => {
     if (!auth.currentUser) return;
     const planRef = doc(db, 'userPlans', auth.currentUser.uid);
     const updated = { ...userPlan };
     updated[intensity][exercise] = {
       weight: Number(actualWt),
       sets: expectedSets,
       reps: String(set1),
     };
     await setDoc(planRef, updated);
  }

  const isDiff = actualWt !== target.weight || String(set1) !== (target.reps.split('-')[0] || target.reps);

  let calcWeight = null;
  if ((intensity === 'Light' || intensity === 'Medium') && userPlan['Heavy'] && userPlan['Heavy'][exercise]) {
    const heavyPlanWeight = userPlan['Heavy'][exercise].weight;
    if (intensity === 'Light') {
      calcWeight = Math.round(heavyPlanWeight * 0.6);
    } else if (intensity === 'Medium') {
      calcWeight = Math.round(heavyPlanWeight * 0.75);
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between w-full md:contents">
        <div className="md:col-span-3 w-full font-bold text-white text-base md:text-sm truncate" title={exercise}>{exercise}</div>
        
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
      
      <div className="md:col-span-5 w-full flex flex-col md:flex-row gap-3 md:gap-1 justify-center items-center bg-zinc-900/40 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none">
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest md:hidden">Weight</span>
          <div className="flex items-center gap-1.5 md:gap-0">
            <input type="number" step="any" value={actualWt} onChange={e => setActualWt(Number(e.target.value))} className="w-20 md:w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 md:py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm md:text-sm" title="Actual Weight (lb)" />
            <span className="text-zinc-500 font-mono text-xs md:hidden">lb</span>
          </div>
        </div>
        
        <span className="text-zinc-600 font-black px-1 hidden md:flex items-center">|</span>
        
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest md:hidden">Reps / RPE</span>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="flex gap-1.5 md:gap-1">
              <input type="number" value={set1} onChange={e => set1Reps(Number(e.target.value))} className="w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 1 Reps" />
              <input type="number" value={set2} onChange={e => set2Reps(Number(e.target.value))} className="w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 2 Reps" />
              {expectedSets >= 3 && (
                <input type="number" value={set3} onChange={e => set3Reps(Number(e.target.value))} className="w-14 bg-zinc-950 md:bg-zinc-900 border border-zinc-700 rounded-lg py-2 px-1 text-center text-white font-mono focus:border-orange-500 outline-none text-sm" title="Set 3 Reps" />
              )}
            </div>
            
            <div className="flex items-center p-0.5 bg-zinc-950 md:bg-zinc-900 rounded-lg border border-zinc-700 ml-1 md:ml-0">
              {(['E', 'M', 'H'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setRpe(level)}
                  className={`w-[26px] h-[34px] md:w-6 md:h-8 rounded md:rounded-md text-[10px] font-black transition-colors flex items-center justify-center ${
                    rpe === level 
                      ? level === 'E' ? 'bg-blue-500 text-white' : level === 'M' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
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
      </div>
      
      <div className="md:col-span-2 w-full flex flex-row md:flex-col gap-2">
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
  );
}
