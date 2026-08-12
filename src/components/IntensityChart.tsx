import React, { useState, useMemo } from 'react';
import { Workout, Intensity } from '../types';
import { getOrderedExerciseNames } from '../lib/workoutUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Maximize2, Minimize2 } from 'lucide-react';

const CustomIntensityTooltip = ({ active, payload, hoveredExercise, mouseYRatio }: any) => {
  if (!active || !payload || !payload.length) return null;

  const validItems = payload.filter((item: any) => item.value !== undefined && item.value !== null);
  if (validItems.length === 0) return null;

  let selectedItem = null;

  if (hoveredExercise) {
    selectedItem = validItems.find((item: any) => (item.name || item.dataKey) === hoveredExercise);
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

  const exerciseName = selectedItem.name || selectedItem.dataKey;
  const weight = selectedItem.value;
  const rpe = selectedItem.payload?.[`${exerciseName}_rpe`];

  let weightColorClass = 'text-orange-400';
  if (rpe === 'E') weightColorClass = 'text-green-500';
  else if (rpe === 'M') weightColorClass = 'text-yellow-500';
  else if (rpe === 'H') weightColorClass = 'text-red-500';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 shadow-xl z-[1000] flex flex-col gap-0.5 min-w-[120px]">
      <div className="text-xs font-bold text-white tracking-tight">{exerciseName}</div>
      <div className={`text-xs font-mono font-bold ${weightColorClass}`}>{weight} lbs</div>
    </div>
  );
};

const SingleIntensityChart: React.FC<{
  intensity: Intensity;
  workouts: Workout[];
  userPlan?: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ intensity, workouts, userPlan, isExpanded, onToggleExpand }) => {
  const [hoveredExercise, setHoveredExercise] = useState<string | null>(null);
  const [mouseYRatio, setMouseYRatio] = useState<number>(0.5);

  const chartData = useMemo(() => {
    const dataByDate = new Map<string, any>();
    
    const intensityWorkouts = workouts
      .filter(w => w.intensity === intensity && w.date)
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
  }, [workouts, intensity]);

  const availableExercises = useMemo(() => {
    const exercises = new Set<string>();
    chartData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'date' && k !== 'timestamp' && !k.endsWith('_rpe')) {
          exercises.add(k);
        }
      });
    });
    
    if (userPlan) {
      const orderedNames = getOrderedExerciseNames(
        userPlan.exerciseOrder,
        Array.from(exercises)
      );
      return orderedNames.filter(ex => exercises.has(ex));
    }

    return Array.from(exercises).sort();
  }, [chartData, userPlan]);

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
        onMouseEnter={() => setHoveredExercise(dataKey)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const badgeColor = intensity === 'Heavy' 
    ? 'bg-red-500/10 text-red-400 border-red-500/20' 
    : intensity === 'Medium' 
    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

  const dotColor = intensity === 'Heavy' ? 'bg-red-500' : intensity === 'Medium' ? 'bg-orange-500' : 'bg-blue-500';

  return (
    <div className={`bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-lg transition-all duration-300 ${
      isExpanded ? 'lg:col-span-3 border-blue-500/40 ring-1 ring-blue-500/20' : 'lg:col-span-1'
    }`}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
          <h3 className="text-base font-bold text-white tracking-tight">
            {intensity} Intensity
          </h3>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeColor}`}>
            {intensity}
          </span>
        </div>

        <button
          onClick={onToggleExpand}
          className="hidden lg:flex p-1.5 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors items-center gap-1.5 text-xs font-mono font-medium"
          title={isExpanded ? "Collapse to grid" : "Expand to full width"}
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
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
          setHoveredExercise(null);
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
                content={<CustomIntensityTooltip hoveredExercise={hoveredExercise} mouseYRatio={mouseYRatio} />}
                shared={false}
                wrapperStyle={{ zIndex: 1000 }}
              />
              
              {availableExercises.map((ex, index) => {
                const colors = ['#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1'];
                const color = colors[index % colors.length];
                return (
                  <Line 
                    key={ex}
                    type="monotone" 
                    dataKey={ex} 
                    stroke={color} 
                    strokeWidth={2.5}
                    connectNulls
                    dot={<CustomDot />}
                    activeDot={{ 
                      r: 5, 
                      stroke: color, 
                      strokeWidth: 2, 
                      fill: '#18181b',
                      onMouseEnter: () => setHoveredExercise(ex)
                    }}
                    onMouseEnter={() => setHoveredExercise(ex)}
                  />
                );
              })}
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

export function IntensityChart({ workouts, userPlan }: { workouts: Workout[], userPlan?: any }) {
  const [expandedIntensity, setExpandedIntensity] = useState<Intensity | null>(null);

  if (workouts.length === 0) return null;

  const intensities: Intensity[] = ['Heavy', 'Medium', 'Light'];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-500" />
          INTENSITY TRACKER
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {intensities.map(intensity => (
          <SingleIntensityChart 
            key={intensity} 
            intensity={intensity} 
            workouts={workouts} 
            userPlan={userPlan} 
            isExpanded={expandedIntensity === intensity}
            onToggleExpand={() => setExpandedIntensity(prev => prev === intensity ? null : intensity)}
          />
        ))}
      </div>
    </div>
  );
}

