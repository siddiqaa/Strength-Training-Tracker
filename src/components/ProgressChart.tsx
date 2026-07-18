import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Workout } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export function ProgressChart() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Workout[];
      setWorkouts(docs);
    });
    return () => unsubscribe();
  }, []);

  const exercises = useMemo(() => {
    const exList = Array.from(new Set(workouts.map(w => w.exerciseName)));
    return exList.sort();
  }, [workouts]);

  useEffect(() => {
    if (exercises.length > 0 && !selectedExercise) {
      setSelectedExercise(exercises[0]);
    }
  }, [exercises, selectedExercise]);

  const chartData = useMemo(() => {
    if (!selectedExercise) return [];
    
    const dataByDate = new Map<string, any>();
    
    const exerciseWorkouts = workouts
      .filter(w => w.exerciseName === selectedExercise && w.date)
      .sort((a, b) => a.date.toMillis() - b.date.toMillis());

    exerciseWorkouts.forEach(w => {
      const dateStr = w.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dataByDate.has(dateStr)) {
        dataByDate.set(dateStr, {
          date: dateStr,
          timestamp: w.date.toMillis(),
        });
      }
      const entry = dataByDate.get(dateStr);
      entry[w.intensity] = w.weight;
    });

    return Array.from(dataByDate.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [workouts, selectedExercise]);

  if (workouts.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-xl mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          PROGRESSION TRACKER
        </h2>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-white text-sm font-mono font-bold rounded-xl px-4 py-2 outline-none focus:border-orange-500 transition-colors w-full sm:w-auto"
        >
          {exercises.map(ex => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>
      </div>

      <div className="h-[300px] w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#52525b" 
                fontSize={10} 
                tickMargin={10} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#52525b" 
                fontSize={10} 
                tickMargin={10} 
                axisLine={false} 
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.75rem' }}
                itemStyle={{ fontWeight: 900, fontFamily: 'monospace' }}
                labelStyle={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              <Line 
                type="monotone" 
                dataKey="Heavy" 
                stroke="#ef4444" 
                strokeWidth={3}
                connectNulls
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4, stroke: '#18181b' }}
                activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#18181b' }}
              />
              <Line 
                type="monotone" 
                dataKey="Light" 
                stroke="#3b82f6" 
                strokeWidth={3}
                connectNulls
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#18181b' }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#18181b' }}
              />
              <Line 
                type="monotone" 
                dataKey="Medium" 
                stroke="#f97316" 
                strokeWidth={3}
                connectNulls
                dot={{ fill: '#f97316', strokeWidth: 2, r: 4, stroke: '#18181b' }}
                activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2, fill: '#18181b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-sm uppercase tracking-widest">
            No data for this exercise
          </div>
        )}
      </div>
    </div>
  );
}
