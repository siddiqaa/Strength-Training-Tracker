/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Workout, Intensity, UserPlan } from '../types';
import { calculate60DayVolumeData, SessionVolume } from '../lib/workoutUtils';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { BarChart3, Maximize2, Minimize2, Calendar, Dumbbell, Layers, TrendingUp } from 'lucide-react';

const INTENSITY_COLORS: Record<Intensity, string> = {
  Heavy: '#ef4444',
  Medium: '#f97316',
  Light: '#3b82f6',
};

const formatLbs = (val: number): string => {
  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(1)}M`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  }
  return val.toString();
};

const CustomSessionTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const session: SessionVolume = payload[0].payload;
  if (!session) return null;

  const intensityColor = INTENSITY_COLORS[session.intensity] || '#e4e4e7';

  return (
    <div
      className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3.5 shadow-2xl z-[1000] min-w-[220px] max-w-[300px] backdrop-blur-md pointer-events-auto select-none"
      onMouseMove={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
        <div>
          <div className="text-xs font-bold text-white tracking-tight">{session.fullDateStr}</div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {session.exerciseCount} exercise{session.exerciseCount > 1 ? 's' : ''} • {session.totalReps} reps
          </div>
        </div>
        <span
          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border"
          style={{
            color: intensityColor,
            borderColor: `${intensityColor}40`,
            backgroundColor: `${intensityColor}15`,
          }}
        >
          {session.intensity}
        </span>
      </div>

      <div className="mb-2.5">
        <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Session Volume</div>
        <div className="text-base font-black font-mono text-white flex items-baseline gap-1">
          {session.totalVolume.toLocaleString()}
          <span className="text-xs text-zinc-500 font-normal">lbs</span>
        </div>
      </div>

      {session.exercises && session.exercises.length > 0 && (
        <div
          className="space-y-1 pt-2 border-t border-zinc-800/60 max-h-36 overflow-y-auto pr-1"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Breakdown</div>
          {session.exercises.map((ex, idx) => (
            <div key={`${ex.exerciseName}-${idx}`} className="flex items-center justify-between text-[10px] py-0.5">
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <span className="text-zinc-300 font-medium truncate max-w-[110px]" title={ex.exerciseName}>
                  {ex.exerciseName}
                </span>
                {ex.equipment && (
                  <span className="text-[8px] text-zinc-500 font-mono px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded flex-shrink-0" title={`Equipment: ${ex.equipment}`}>
                    {ex.equipment}
                  </span>
                )}
              </div>
              <span className="font-mono text-zinc-400 whitespace-nowrap">
                {ex.isBW && ex.volume === 0 ? (
                  <span className="text-zinc-500">{ex.reps} reps (BW)</span>
                ) : (
                  <span>
                    {ex.volume.toLocaleString()} <span className="text-zinc-600 text-[9px]">lbs</span>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomWeeklyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3.5 shadow-2xl z-[1000] min-w-[200px] backdrop-blur-md">
      <div className="text-xs font-bold text-white tracking-tight mb-1">Week of {label}</div>
      <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2">Total Weekly Volume</div>
      <div className="text-base font-black font-mono text-white flex items-baseline gap-1 mb-3">
        {item.totalVolume.toLocaleString()}
        <span className="text-xs text-zinc-500 font-normal">lbs</span>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-red-400 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Heavy:
          </span>
          <span className="font-mono text-white font-bold">{item.Heavy.toLocaleString()} lbs</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-orange-400 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Medium:
          </span>
          <span className="font-mono text-white font-bold">{item.Medium.toLocaleString()} lbs</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-blue-400 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Light:
          </span>
          <span className="font-mono text-white font-bold">{item.Light.toLocaleString()} lbs</span>
        </div>
      </div>
    </div>
  );
};

const CustomCumulativeTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3.5 shadow-2xl z-[1000] min-w-[210px] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
        <div className="text-xs font-bold text-white tracking-tight">{item.fullDateStr}</div>
        <span
          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border"
          style={{
            color: INTENSITY_COLORS[item.intensity as Intensity] || '#e4e4e7',
            borderColor: `${INTENSITY_COLORS[item.intensity as Intensity]}40`,
            backgroundColor: `${INTENSITY_COLORS[item.intensity as Intensity]}15`,
          }}
        >
          {item.intensity}
        </span>
      </div>

      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Cumulative Volume</div>
        <div className="text-base font-black font-mono text-white flex items-baseline gap-1">
          {item.cumulativeTotal.toLocaleString()}
          <span className="text-xs text-zinc-500 font-normal">lbs</span>
        </div>
        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
          +{item.sessionVolume.toLocaleString()} lbs this session
        </div>
      </div>

      <div className="space-y-1 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-red-400 font-medium">Heavy accumulated:</span>
          <span className="font-mono text-zinc-300">{item.cumulativeHeavy.toLocaleString()} lbs</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-orange-400 font-medium">Medium accumulated:</span>
          <span className="font-mono text-zinc-300">{item.cumulativeMedium.toLocaleString()} lbs</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-blue-400 font-medium">Light accumulated:</span>
          <span className="font-mono text-zinc-300">{item.cumulativeLight.toLocaleString()} lbs</span>
        </div>
      </div>
    </div>
  );
};

export function VolumeChart({ workouts, userPlan }: { workouts: Workout[]; userPlan?: UserPlan | null }) {
  const [viewMode, setViewMode] = useState<'session' | 'weekly' | 'cumulative'>('session');
  const [selectedIntensity, setSelectedIntensity] = useState<'All' | Intensity>('All');
  const [isExpanded, setIsExpanded] = useState(false);

  const { sessions, stats, cumulativeData, weeklyBuckets } = useMemo(() => {
    return calculate60DayVolumeData(workouts, new Date(), userPlan);
  }, [workouts, userPlan]);

  const filteredSessions = useMemo(() => {
    if (selectedIntensity === 'All') return sessions;
    return sessions.filter((s) => s.intensity === selectedIntensity);
  }, [sessions, selectedIntensity]);

  if (workouts.length === 0) return null;

  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-xl mt-8 transition-all ${
        isExpanded ? 'col-span-full' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            VOLUME TRACKER
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Total training volume (lbs) over the last 60 days • Heavy, Light & Medium
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {/* Desktop expand button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden sm:flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors"
            title={isExpanded ? 'Collapse chart' : 'Expand full width'}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Total Volume */}
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-zinc-400" />
            60-Day Volume
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-black font-mono text-white">
              {stats.totalVolume.toLocaleString()}{' '}
              <span className="text-[11px] font-normal text-zinc-500">lbs</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''} • {stats.totalReps.toLocaleString()} reps
            </div>
          </div>
        </div>

        {/* Heavy Volume */}
        <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Heavy Volume
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-black font-mono text-red-400">
              {stats.heavyVolume.toLocaleString()}{' '}
              <span className="text-[11px] font-normal text-zinc-500">lbs</span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
              {stats.heavySessions} sessions • avg {stats.avgHeavyVolume.toLocaleString()} lbs
            </div>
          </div>
        </div>

        {/* Medium Volume */}
        <div className="bg-orange-950/20 border border-orange-500/20 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Medium Volume
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-black font-mono text-orange-400">
              {stats.mediumVolume.toLocaleString()}{' '}
              <span className="text-[11px] font-normal text-zinc-500">lbs</span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
              {stats.mediumSessions} sessions • avg {stats.avgMediumVolume.toLocaleString()} lbs
            </div>
          </div>
        </div>

        {/* Light Volume */}
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Light Volume
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-black font-mono text-blue-400">
              {stats.lightVolume.toLocaleString()}{' '}
              <span className="text-[11px] font-normal text-zinc-500">lbs</span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
              {stats.lightSessions} sessions • avg {stats.avgLightVolume.toLocaleString()} lbs
            </div>
          </div>
        </div>
      </div>

      {/* Chart View Controls and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Mode Selector */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setViewMode('session')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'session'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Session Bars
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'weekly'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Weekly Load
          </button>
          <button
            onClick={() => setViewMode('cumulative')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'cumulative'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Cumulative
          </button>
        </div>

        {/* Intensity Filter (Active for Session view) */}
        {viewMode === 'session' && (
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-end sm:self-auto">
            {(['All', 'Heavy', 'Medium', 'Light'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedIntensity(tier)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  selectedIntensity === tier
                    ? tier === 'Heavy'
                      ? 'bg-red-500 text-white shadow-sm'
                      : tier === 'Medium'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : tier === 'Light'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div
        className={`w-full transition-all duration-300 bg-zinc-950/40 rounded-2xl border border-zinc-800/60 p-4 ${
          isExpanded ? 'h-[440px]' : 'h-[320px]'
        }`}
      >
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <BarChart3 className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
              No workouts logged in the last 60 days
            </p>
          </div>
        ) : viewMode === 'session' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredSessions}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateStr"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
                tickFormatter={formatLbs}
              />
              <Tooltip
                content={<CustomSessionTooltip />}
                reverseDirection={{ x: true, y: false }}
                offset={10}
                wrapperStyle={{ zIndex: 1000, pointerEvents: 'auto' }}
                cursor={{ fill: '#27272a', opacity: 0.4 }}
              />
              <Bar dataKey="totalVolume" radius={[4, 4, 0, 0]}>
                {filteredSessions.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={INTENSITY_COLORS[entry.intensity] || '#e4e4e7'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : viewMode === 'weekly' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyBuckets}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="weekLabel"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
                tickFormatter={formatLbs}
              />
              <Tooltip
                content={<CustomWeeklyTooltip />}
                wrapperStyle={{ zIndex: 1000 }}
                cursor={{ fill: '#27272a', opacity: 0.4 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              />
              <Bar dataKey="Heavy" stackId="volume" fill="#ef4444" radius={[0, 0, 0, 0]} name="Heavy" />
              <Bar dataKey="Medium" stackId="volume" fill="#f97316" radius={[0, 0, 0, 0]} name="Medium" />
              <Bar dataKey="Light" stackId="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Light" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={cumulativeData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="totalVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e4e4e7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#e4e4e7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heavyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mediumVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lightVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateStr"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
                tickFormatter={formatLbs}
              />
              <Tooltip
                content={<CustomCumulativeTooltip />}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeTotal"
                name="Total Volume"
                stroke="#e4e4e7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#totalVolumeGradient)"
              />
              <Area
                type="monotone"
                dataKey="cumulativeHeavy"
                name="Heavy"
                stroke="#ef4444"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#heavyVolumeGradient)"
              />
              <Area
                type="monotone"
                dataKey="cumulativeMedium"
                name="Medium"
                stroke="#f97316"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#mediumVolumeGradient)"
              />
              <Area
                type="monotone"
                dataKey="cumulativeLight"
                name="Light"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#lightVolumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Footer for Session View */}
      {viewMode === 'session' && sessions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-500"></span>
            <span>Heavy Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-orange-500"></span>
            <span>Medium Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-500"></span>
            <span>Light Session</span>
          </div>
        </div>
      )}
    </div>
  );
}
