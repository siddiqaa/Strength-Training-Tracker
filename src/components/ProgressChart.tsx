import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Workout } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export function ProgressChart({ workouts, userPlan }: { workouts: Workout[], userPlan?: any }) {
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const exercises = useMemo(() => {
    const planExercisesList: string[] = [];
    if (userPlan) {
      const savedOrder = userPlan.globalOrder && userPlan.globalOrder.length > 0 ? [...userPlan.globalOrder] : [];
      const allActive = new Set<string>();
      (['Heavy', 'Light', 'Medium'] as const).forEach(int => {
        Object.keys(userPlan[int] || {}).forEach(ex => allActive.add(ex));
      });
      const missing = Array.from(allActive).filter(ex => !savedOrder.includes(ex));
      missing.sort();
      planExercisesList.push(...savedOrder, ...missing);
    }
    
    const planExercisesSet = new Set(planExercisesList);
    const historyExercises = workouts.map(w => w.exerciseName);
    const historyOnlyExercises = Array.from(new Set(historyExercises))
      .filter(ex => !planExercisesSet.has(ex))
      .sort();

    return [...planExercisesList, ...historyOnlyExercises];
  }, [workouts, userPlan]);

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
      .sort((a, b) => a.date - b.date);

    exerciseWorkouts.forEach(w => {
      const dateObj = new Date(w.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dataByDate.has(dateStr)) {
        dataByDate.set(dateStr, {
          date: dateStr,
          timestamp: w.date,
        });
      }
      const entry = dataByDate.get(dateStr);
      entry[w.intensity] = w.weight;
      entry[`${w.intensity}_rpe`] = w.rpe;
    });

    return Array.from(dataByDate.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [workouts, selectedExercise]);

  const availableIntensities = useMemo(() => {
    const intensities = new Set<string>();
    chartData.forEach(d => {
      if (d.Heavy !== undefined) intensities.add('Heavy');
      if (d.Light !== undefined) intensities.add('Light');
      if (d.Medium !== undefined) intensities.add('Medium');
    });
    return intensities;
  }, [chartData]);

  if (workouts.length === 0 && (!userPlan || Object.keys(userPlan).length === 0)) return null;

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey, stroke, value } = props;
    
    // Do not render a dot if there is no value for this intensity on this date
    if (value === undefined || value === null) return null;

    const rpe = payload[`${dataKey}_rpe`];
    
    let fill = '#18181b';
    if (rpe === 'E') fill = '#22c55e'; // green-500
    else if (rpe === 'M') fill = '#eab308'; // yellow-500
    else if (rpe === 'H') fill = '#ef4444'; // red-500

    return (
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke={stroke} strokeWidth={2} />
    );
  };

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
            <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
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
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              {availableIntensities.has('Heavy') && (
                <Line 
                  type="monotone" 
                  dataKey="Heavy" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#18181b' }}
                />
              )}
              {availableIntensities.has('Light') && (
                <Line 
                  type="monotone" 
                  dataKey="Light" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#18181b' }}
                />
              )}
              {availableIntensities.has('Medium') && (
                <Line 
                  type="monotone" 
                  dataKey="Medium" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2, fill: '#18181b' }}
                />
              )}
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
