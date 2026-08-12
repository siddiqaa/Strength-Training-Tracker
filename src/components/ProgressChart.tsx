import React, { useState, useMemo } from 'react';
import { Workout } from '../types';
import { getOrderedExerciseNames } from '../lib/workoutUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Maximize2, Minimize2 } from 'lucide-react';

const CustomProgressTooltip = ({ active, payload, label, hoveredIntensity, mouseYRatio }: any) => {
  if (!active || !payload || !payload.length) return null;

  const validItems = payload.filter((item: any) => item.value !== undefined && item.value !== null);
  if (validItems.length === 0) return null;

  let selectedItem = null;

  if (hoveredIntensity) {
    selectedItem = validItems.find((item: any) => (item.name || item.dataKey) === hoveredIntensity);
  }

  if (!selectedItem) {
    if (validItems.length === 1) {
      selectedItem = validItems[0];
    } else {
      const weights = validItems.map((item: any) => Number(item.value)).filter((v: number) => !isNaN(v));
      const minW = Math.min(...weights);
      const maxW = Math.max(...weights);

      let closestItem = validItems[0];
      let minDiff = Infinity;

      validItems.forEach((item: any) => {
        const val = Number(item.value);
        if (!isNaN(val)) {
          const itemRatio = minW === maxW ? 0.5 : (val - minW) / (maxW - minW);
          const diff = Math.abs(itemRatio - (mouseYRatio ?? 0.5));
          if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
          }
        }
      });

      selectedItem = closestItem;
    }
  }

  const intensity = selectedItem.name || selectedItem.dataKey;
  const weight = selectedItem.value;
  const rpe = selectedItem.payload?.[`${intensity}_rpe`];

  let weightColorClass = 'text-orange-400';
  if (rpe === 'E') weightColorClass = 'text-green-500';
  else if (rpe === 'M') weightColorClass = 'text-yellow-500';
  else if (rpe === 'H') weightColorClass = 'text-red-500';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 shadow-xl z-[1000] flex flex-col gap-0.5 min-w-[120px]">
      <div className="text-xs font-bold text-white tracking-tight">{label} • {intensity}</div>
      <div className={`text-xs font-mono font-bold ${weightColorClass}`}>{weight} lbs</div>
    </div>
  );
};

const SingleExerciseChart: React.FC<{
  exerciseName: string;
  workouts: Workout[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ exerciseName, workouts, isExpanded, onToggleExpand }) => {
  const [hoveredIntensity, setHoveredIntensity] = useState<string | null>(null);
  const [mouseYRatio, setMouseYRatio] = useState<number>(0.5);

  const chartData = useMemo(() => {
    const dataByDate = new Map<string, any>();
    
    const exerciseWorkouts = workouts
      .filter(w => w.exerciseName === exerciseName && w.date)
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
  }, [workouts, exerciseName]);

  const availableIntensities = useMemo(() => {
    const intensities = new Set<string>();
    chartData.forEach(d => {
      if (d.Heavy !== undefined) intensities.add('Heavy');
      if (d.Light !== undefined) intensities.add('Light');
      if (d.Medium !== undefined) intensities.add('Medium');
    });
    return intensities;
  }, [chartData]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey, stroke, value } = props;
    if (value === undefined || value === null) return null;

    const rpe = payload[`${dataKey}_rpe`];
    let fill = '#18181b';
    if (rpe === 'E') fill = '#22c55e'; // green-500
    else if (rpe === 'M') fill = '#eab308'; // yellow-500
    else if (rpe === 'H') fill = '#ef4444'; // red-500

    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={4} 
        fill={fill} 
        stroke={stroke} 
        strokeWidth={2}
        onMouseEnter={() => setHoveredIntensity(dataKey)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  return (
    <div className={`bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-lg transition-all duration-300 ${
      isExpanded ? 'lg:col-span-2 border-orange-500/40 ring-1 ring-orange-500/20' : 'lg:col-span-1'
    }`}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          {exerciseName}
        </h3>

        <button
          onClick={onToggleExpand}
          className="hidden lg:flex p-1.5 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors items-center gap-1.5 text-xs font-mono font-medium"
          title={isExpanded ? "Collapse to grid" : "Expand to full width"}
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-orange-400" />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Width</span>
            </>
          )}
        </button>
      </div>

      <div 
        className={`${isExpanded ? 'h-[360px]' : 'h-[260px]'} w-full transition-all duration-300`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.height > 0) {
            const y = e.clientY - rect.top;
            const ratio = Math.max(0, Math.min(1, 1 - (y / rect.height)));
            setMouseYRatio(ratio);
          }
        }}
        onMouseLeave={() => {
          setHoveredIntensity(null);
          setMouseYRatio(0.5);
        }}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#52525b" 
                fontSize={10} 
                tickMargin={8} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#52525b" 
                fontSize={10} 
                tickMargin={8} 
                axisLine={false} 
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                content={<CustomProgressTooltip hoveredIntensity={hoveredIntensity} mouseYRatio={mouseYRatio} />}
                shared={false}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              {availableIntensities.has('Heavy') && (
                <Line 
                  type="monotone" 
                  dataKey="Heavy" 
                  stroke="#ef4444" 
                  strokeWidth={2.5}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ 
                    r: 5, 
                    stroke: '#ef4444', 
                    strokeWidth: 2, 
                    fill: '#18181b',
                    onMouseEnter: () => setHoveredIntensity('Heavy')
                  }}
                  onMouseEnter={() => setHoveredIntensity('Heavy')}
                />
              )}
              {availableIntensities.has('Light') && (
                <Line 
                  type="monotone" 
                  dataKey="Light" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ 
                    r: 5, 
                    stroke: '#3b82f6', 
                    strokeWidth: 2, 
                    fill: '#18181b',
                    onMouseEnter: () => setHoveredIntensity('Light')
                  }}
                  onMouseEnter={() => setHoveredIntensity('Light')}
                />
              )}
              {availableIntensities.has('Medium') && (
                <Line 
                  type="monotone" 
                  dataKey="Medium" 
                  stroke="#f97316" 
                  strokeWidth={2.5}
                  connectNulls
                  dot={<CustomDot />}
                  activeDot={{ 
                    r: 5, 
                    stroke: '#f97316', 
                    strokeWidth: 2, 
                    fill: '#18181b',
                    onMouseEnter: () => setHoveredIntensity('Medium')
                  }}
                  onMouseEnter={() => setHoveredIntensity('Medium')}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
            No data logged yet
          </div>
        )}
      </div>
    </div>
  );
};

export function ProgressChart({ workouts, userPlan }: { workouts: Workout[], userPlan?: any }) {
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const exercises = useMemo(() => {
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

    return [...planExercisesList, ...historyOnlyExercises];
  }, [workouts, userPlan]);

  if (workouts.length === 0 && (!userPlan || Object.keys(userPlan).length === 0)) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-xl mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          PROGRESSION TRACKER
        </h2>
      </div>

      {exercises.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 font-mono text-sm uppercase tracking-widest">
          No exercises available
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {exercises.map(exerciseName => (
            <SingleExerciseChart 
              key={exerciseName} 
              exerciseName={exerciseName} 
              workouts={workouts} 
              isExpanded={expandedExercise === exerciseName}
              onToggleExpand={() => setExpandedExercise(prev => prev === exerciseName ? null : exerciseName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

