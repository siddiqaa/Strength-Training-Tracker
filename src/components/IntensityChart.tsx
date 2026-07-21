import React, { useState, useMemo } from 'react';
import { Workout, Intensity } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';

export function IntensityChart({ workouts }: { workouts: Workout[] }) {
  const [selectedIntensity, setSelectedIntensity] = useState<Intensity>('Heavy');

  const chartData = useMemo(() => {
    const dataByDate = new Map<string, any>();
    
    const intensityWorkouts = workouts
      .filter(w => w.intensity === selectedIntensity && w.date)
      .sort((a, b) => a.date - b.date);

    intensityWorkouts.forEach(w => {
      const dateObj = new Date(w.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      if (!dataByDate.has(dateStr)) {
        dataByDate.set(dateStr, {
          date: dateStr,
          timestamp: w.date,
        });
      }
      
      const entry = dataByDate.get(dateStr);
      entry[w.exerciseName] = w.weight;
      entry[`${w.exerciseName}_rpe`] = w.rpe;
    });

    return Array.from(dataByDate.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [workouts, selectedIntensity]);

  const availableExercises = useMemo(() => {
    const exercises = new Set<string>();
    chartData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'date' && k !== 'timestamp' && !k.endsWith('_rpe')) {
          exercises.add(k);
        }
      });
    });
    return Array.from(exercises).sort();
  }, [chartData]);

  if (workouts.length === 0) return null;

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-500" />
          INTENSITY TRACKER
        </h2>
        <select
          value={selectedIntensity}
          onChange={(e) => setSelectedIntensity(e.target.value as Intensity)}
          className="bg-zinc-950 border border-zinc-700 text-white text-sm font-mono font-bold rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors w-full sm:w-auto"
        >
          <option value="Heavy">Heavy</option>
          <option value="Medium">Medium</option>
          <option value="Light">Light</option>
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
              
              {availableExercises.map((ex, index) => {
                const colors = ['#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1'];
                const color = colors[index % colors.length];
                return (
                  <Line 
                    key={ex}
                    type="monotone" 
                    dataKey={ex} 
                    stroke={color} 
                    strokeWidth={3}
                    connectNulls
                    dot={<CustomDot />}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: '#18181b' }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-sm uppercase tracking-widest">
            No data for this intensity
          </div>
        )}
      </div>
    </div>
  );
}
