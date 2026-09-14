/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workout, ExerciseOrderItem, Intensity, UserPlan } from '../types';

export { type ExerciseOrderItem };

/**
  * Normalizes exercise order objects ({exercise, position}) into a cleanly ordered list of exercise names based on position index.
  */
export function getOrderedExerciseNames(
  orderData?: ExerciseOrderItem[] | any,
  allActiveExercises: string[] = []
): string[] {
  const tupleList: { name: string; pos: number }[] = [];
  const processedNames = new Set<string>();

  if (Array.isArray(orderData)) {
    orderData.forEach((item, idx) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const name = item.exercise || item.name;
        const pos = typeof item.position === 'number' ? item.position : idx;
        if (name && typeof name === 'string') {
          tupleList.push({ name, pos });
          processedNames.add(name);
        }
      } else if (typeof item === 'string') {
        tupleList.push({ name: item, pos: idx });
        processedNames.add(item);
      } else if (Array.isArray(item)) {
        if (typeof item[0] === 'string' && typeof item[1] === 'number') {
          tupleList.push({ name: item[0], pos: item[1] });
          processedNames.add(item[0]);
        } else if (typeof item[0] === 'number' && typeof item[1] === 'string') {
          tupleList.push({ name: item[1], pos: item[0] });
          processedNames.add(item[1]);
        }
      }
    });
  }

  // Sort strictly by position index
  tupleList.sort((a, b) => a.pos - b.pos);

  const orderedNames = tupleList.map(t => t.name);

  // Add any active exercises missing from orderData at the end
  const missing = allActiveExercises.filter(ex => !processedNames.has(ex));
  return [...orderedNames, ...missing];
}

/**
 * Converts an ordered array of exercise names into explicit position objects: { exercise: exerciseName, position: positionIndex }.
 */
export function createExerciseOrderItems(exercises: string[]): ExerciseOrderItem[] {
  return exercises.map((name, index) => ({ exercise: name, position: index }));
}

/**
 * Alias for createExerciseOrderItems for backward compatibility in imports.
 */
export function createExerciseOrderTuples(exercises: string[]): ExerciseOrderItem[] {
  return createExerciseOrderItems(exercises);
}

/**
 * Calculates whether the user needs a deload.
 * A deload is needed if there has NOT been a break of 6 days or more
 * at any time in the last 60 days.
 * 
 * @param workouts List of completed workouts with their dates in milliseconds.
 * @param now Reference "current" date (defaults to current system time).
 */
export function calculateShowDeloadBadge(workouts: Pick<Workout, 'date'>[], now: Date = new Date()): boolean {
  if (workouts.length === 0) return false;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sixtyDaysAgoStart = todayStart - 60 * 24 * 60 * 60 * 1000;

  const workoutDaysSet = new Set<number>();
  workouts.forEach(w => {
    if (w.date >= sixtyDaysAgoStart) {
      const d = new Date(w.date);
      d.setHours(0, 0, 0, 0);
      workoutDaysSet.add(d.getTime());
    }
  });

  let maxConsecutiveBreakDays = 0;
  let currentBreakDays = 0;

  // We check daily starting from 60 days ago up to today
  for (let i = 0; i <= 60; i++) {
    const dayTime = sixtyDaysAgoStart + i * 24 * 60 * 60 * 1000;
    if (!workoutDaysSet.has(dayTime)) {
      currentBreakDays++;
      if (currentBreakDays > maxConsecutiveBreakDays) {
        maxConsecutiveBreakDays = currentBreakDays;
      }
    } else {
      currentBreakDays = 0;
    }
  }

  return maxConsecutiveBreakDays < 6;
}

/**
 * Checks if two dates represent the same local calendar day.
 */
export function parseWorkoutDate(rawDate: any): number {
  if (!rawDate) return Date.now();
  if (typeof rawDate.toMillis === 'function') {
    return rawDate.toMillis();
  }
  if (typeof rawDate.seconds === 'number') {
    return rawDate.seconds * 1000;
  }
  if (typeof rawDate === 'number' && !isNaN(rawDate)) {
    return rawDate;
  }
  if (rawDate instanceof Date) {
    const time = rawDate.getTime();
    return isNaN(time) ? Date.now() : time;
  }
  if (typeof rawDate === 'string') {
    const time = new Date(rawDate).getTime();
    return isNaN(time) ? Date.now() : time;
  }
  // For pending serverTimestamp() sentinel objects or unparseable objects
  return Date.now();
}

/**
 * Checks if two dates represent the same local calendar day.
 */
export function isSameDay(d1: Date | number, d2: Date | number): boolean {
  const date1 = typeof d1 === 'number' ? new Date(d1) : d1;
  const date2 = typeof d2 === 'number' ? new Date(d2) : d2;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Returns the workout entry for a given exercise and intensity from the last relevant day for that intensity.
 * If the exercise was skipped or not logged on that last day, returns undefined.
 */
export function getLastDayWorkoutForExercise(
  workouts: Workout[],
  exerciseName: string,
  intensity: 'Heavy' | 'Light' | 'Medium'
): Workout | undefined {
  const lastIntensityWorkout = workouts.find(w => w.intensity === intensity);
  if (!lastIntensityWorkout) return undefined;

  const lastDayDate = new Date(lastIntensityWorkout.date);

  return workouts.find(w =>
    w.intensity === intensity &&
    w.exerciseName === exerciseName &&
    isSameDay(new Date(w.date), lastDayDate)
  );
}

/**
 * Calculates if the goal was achieved for a workout entry.
 * Goal Achieved (GA) = true if each set logged meets or exceeds the target reps across the target sets.
 */
export function isGoalAchieved(workout: Workout): boolean {
  const targetSets = workout.targetSets || 0;
  const targetRepsStr = workout.targetReps || '';
  
  if (targetSets === 0 || !targetRepsStr) return false;

  const repMatch = targetRepsStr.match(/\d+/);
  if (!repMatch) return false;
  const targetRepsValue = parseInt(repMatch[0], 10);

  // Check the sets that were actually targetted
  const set1 = Number(workout.set1) || 0;
  const set2 = Number(workout.set2) || 0;
  const set3 = Number(workout.set3) || 0;
  
  const sets = [set1, set2, set3];
  
  for (let i = 0; i < targetSets; i++) {
    if ((sets[i] || 0) < targetRepsValue) return false;
  }
  
  return true;
}

/**
 * Checks if an exercise has Bodyweight (BW) as its target weight.
 */
export function isBWTarget(
  exerciseName?: string, 
  intensity?: Intensity, 
  userPlan?: UserPlan, 
  workout?: Workout
): boolean {
  if (workout?.isBW) return true;
  if (!exerciseName) return false;
  if (userPlan && intensity && userPlan[intensity]?.[exerciseName]?.isBW) return true;
  if (userPlan) {
    if (userPlan.Heavy?.[exerciseName]?.isBW) return true;
    if (userPlan.Light?.[exerciseName]?.isBW) return true;
    if (userPlan.Medium?.[exerciseName]?.isBW) return true;
  }
  return false;
}

/**
 * Gets the total reps logged for a workout entry across completed sets.
 */
export function getWorkoutTotalReps(workout: Workout): number {
  return (Number(workout.set1) || 0) + (Number(workout.set2) || 0) + (Number(workout.set3) || 0);
}

/**
 * Gets the plot value for a workout entry.
 * For exercises with BW as the target weight, plot the total completed reps.
 * Otherwise returns the logged weight.
 */
export function getWorkoutPlotValue(
  workout: Workout, 
  userPlan?: UserPlan
): number {
  const isBw = isBWTarget(workout.exerciseName, workout.intensity, userPlan, workout);
  if (isBw) {
    return getWorkoutTotalReps(workout);
  }
  return workout.weight;
}

export interface ExerciseVolumeDetail {
  exerciseName: string;
  weight: number;
  reps: number;
  volume: number;
  isBW?: boolean;
}

export interface SessionVolume {
  id: string; // dateKey_intensity
  date: number;
  dateStr: string;
  fullDateStr: string;
  intensity: Intensity;
  totalVolume: number;
  totalReps: number;
  exerciseCount: number;
  exercises: ExerciseVolumeDetail[];
  Heavy?: number;
  Medium?: number;
  Light?: number;
}

export interface VolumeStats {
  totalVolume: number;
  totalReps: number;
  heavyVolume: number;
  mediumVolume: number;
  lightVolume: number;
  heavySessions: number;
  mediumSessions: number;
  lightSessions: number;
  totalSessions: number;
  avgHeavyVolume: number;
  avgMediumVolume: number;
  avgLightVolume: number;
}

export interface WeeklyVolumeItem {
  weekLabel: string;
  weekStart: number;
  weekEnd: number;
  Heavy: number;
  Medium: number;
  Light: number;
  totalVolume: number;
}

export interface CumulativeVolumeItem {
  date: number;
  dateStr: string;
  fullDateStr: string;
  intensity: Intensity;
  sessionVolume: number;
  cumulativeTotal: number;
  cumulativeHeavy: number;
  cumulativeMedium: number;
  cumulativeLight: number;
}

/**
 * Calculates volume data for the last 60 days categorized by Heavy, Light, and Medium sessions.
 */
export function calculate60DayVolumeData(
  workouts: Workout[],
  now: Date = new Date()
) {
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const sixtyDaysAgoStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime() - 60 * 24 * 60 * 60 * 1000;

  // Filter workouts within the last 60 days
  const recentWorkouts = workouts.filter(w => {
    const time = parseWorkoutDate(w.date);
    return time >= sixtyDaysAgoStart && time <= todayEnd;
  });

  // Group by calendar day and intensity: "YYYY-MM-DD_<intensity>"
  const sessionMap = new Map<string, SessionVolume>();

  recentWorkouts.forEach(w => {
    const time = parseWorkoutDate(w.date);
    const d = new Date(time);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const sessionKey = `${dateKey}_${w.intensity}`;

    const reps = getWorkoutTotalReps(w);
    const weight = Number(w.weight) || 0;
    const volume = weight * reps;

    const exerciseDetail: ExerciseVolumeDetail = {
      exerciseName: w.exerciseName,
      weight,
      reps,
      volume,
      isBW: !!w.isBW
    };

    if (!sessionMap.has(sessionKey)) {
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      sessionMap.set(sessionKey, {
        id: sessionKey,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        dateStr,
        fullDateStr,
        intensity: w.intensity,
        totalVolume: volume,
        totalReps: reps,
        exerciseCount: 1,
        exercises: [exerciseDetail],
        Heavy: w.intensity === 'Heavy' ? volume : 0,
        Medium: w.intensity === 'Medium' ? volume : 0,
        Light: w.intensity === 'Light' ? volume : 0,
      });
    } else {
      const existing = sessionMap.get(sessionKey)!;
      existing.totalVolume += volume;
      existing.totalReps += reps;
      existing.exerciseCount += 1;
      existing.exercises.push(exerciseDetail);
      if (w.intensity === 'Heavy') existing.Heavy = existing.totalVolume;
      if (w.intensity === 'Medium') existing.Medium = existing.totalVolume;
      if (w.intensity === 'Light') existing.Light = existing.totalVolume;
    }
  });

  // Sort sessions chronologically (oldest to newest)
  const sessions = Array.from(sessionMap.values()).sort((a, b) => a.date - b.date);

  // Compute stats
  let totalVolume = 0;
  let totalReps = 0;
  let heavyVolume = 0;
  let mediumVolume = 0;
  let lightVolume = 0;
  let heavySessions = 0;
  let mediumSessions = 0;
  let lightSessions = 0;

  sessions.forEach(s => {
    totalVolume += s.totalVolume;
    totalReps += s.totalReps;
    if (s.intensity === 'Heavy') {
      heavyVolume += s.totalVolume;
      heavySessions++;
    } else if (s.intensity === 'Medium') {
      mediumVolume += s.totalVolume;
      mediumSessions++;
    } else if (s.intensity === 'Light') {
      lightVolume += s.totalVolume;
      lightSessions++;
    }
  });

  const stats: VolumeStats = {
    totalVolume,
    totalReps,
    heavyVolume,
    mediumVolume,
    lightVolume,
    heavySessions,
    mediumSessions,
    lightSessions,
    totalSessions: sessions.length,
    avgHeavyVolume: heavySessions > 0 ? Math.round(heavyVolume / heavySessions) : 0,
    avgMediumVolume: mediumSessions > 0 ? Math.round(mediumVolume / mediumSessions) : 0,
    avgLightVolume: lightSessions > 0 ? Math.round(lightVolume / lightSessions) : 0,
  };

  // Cumulative progression
  let runningTotal = 0;
  let runningHeavy = 0;
  let runningMedium = 0;
  let runningLight = 0;

  const cumulativeData: CumulativeVolumeItem[] = sessions.map(s => {
    runningTotal += s.totalVolume;
    if (s.intensity === 'Heavy') runningHeavy += s.totalVolume;
    if (s.intensity === 'Medium') runningMedium += s.totalVolume;
    if (s.intensity === 'Light') runningLight += s.totalVolume;

    return {
      date: s.date,
      dateStr: s.dateStr,
      fullDateStr: s.fullDateStr,
      intensity: s.intensity,
      sessionVolume: s.totalVolume,
      cumulativeTotal: runningTotal,
      cumulativeHeavy: runningHeavy,
      cumulativeMedium: runningMedium,
      cumulativeLight: runningLight,
    };
  });

  // Weekly buckets starting on Monday spanning the 60 days
  const sixtyDaysAgoDate = new Date(sixtyDaysAgoStart);
  const diffToMonday = (sixtyDaysAgoDate.getDay() + 6) % 7;
  const firstMondayDate = new Date(
    sixtyDaysAgoDate.getFullYear(),
    sixtyDaysAgoDate.getMonth(),
    sixtyDaysAgoDate.getDate() - diffToMonday,
    0, 0, 0, 0
  );

  const weeklyBuckets: WeeklyVolumeItem[] = [];
  const currentWeekMonday = new Date(firstMondayDate);

  while (currentWeekMonday.getTime() <= todayEnd) {
    const weekStart = currentWeekMonday.getTime();
    const sundayEnd = new Date(
      currentWeekMonday.getFullYear(),
      currentWeekMonday.getMonth(),
      currentWeekMonday.getDate() + 6,
      23, 59, 59, 999
    );
    const weekEnd = sundayEnd.getTime();
    const weekLabel = currentWeekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let wHeavy = 0;
    let wMedium = 0;
    let wLight = 0;

    sessions.forEach(s => {
      if (s.date >= weekStart && s.date <= weekEnd) {
        if (s.intensity === 'Heavy') wHeavy += s.totalVolume;
        else if (s.intensity === 'Medium') wMedium += s.totalVolume;
        else if (s.intensity === 'Light') wLight += s.totalVolume;
      }
    });

    weeklyBuckets.push({
      weekLabel,
      weekStart,
      weekEnd,
      Heavy: wHeavy,
      Medium: wMedium,
      Light: wLight,
      totalVolume: wHeavy + wMedium + wLight,
    });

    currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
  }

  return {
    sessions,
    stats,
    cumulativeData,
    weeklyBuckets,
    sixtyDaysAgoStart,
    todayEnd
  };
}

