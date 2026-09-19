/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workout, ExerciseOrderItem, Intensity, UserPlan, ExerciseEquipment, PlannedSet } from '../types';

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
 * Goal Achieved (GA) = true if each set logged meets or exceeds the target reps across all target sets.
 * Evaluates strictly against explicit targets defined in userPlan or on the workout document,
 * without synthetic fallback targets.
 */
export function isGoalAchieved(workout: Workout, userPlan?: UserPlan): boolean {
  // 1. Locate the exercise in userPlan for the workout intensity (case-insensitive & whitespace-trimmed)
  let planTarget: PlannedSet | undefined = userPlan?.[workout.intensity]?.[workout.exerciseName];
  if (!planTarget && userPlan?.[workout.intensity]) {
    const dayPlan = userPlan[workout.intensity];
    const trimmed = workout.exerciseName?.trim().toLowerCase();
    for (const [name, target] of Object.entries(dayPlan)) {
      if (name.trim().toLowerCase() === trimmed) {
        planTarget = target;
        break;
      }
    }
  }

  // 2. Strict target sets calculation:
  // Must come from explicit planTarget.sets or workout.targetSets (no fallback sets)
  const explicitTargetSets = planTarget?.sets && Number(planTarget.sets) > 0
    ? Number(planTarget.sets)
    : (workout.targetSets && Number(workout.targetSets) > 0 ? Number(workout.targetSets) : 0);

  // If set3 was logged with actual reps (> 0), at least 3 sets were performed in this session,
  // so set 3 must be evaluated.
  const hasSet3 = workout.set3 !== undefined && workout.set3 !== null && Number(workout.set3) > 0;
  const targetSets = hasSet3 ? Math.max(explicitTargetSets, 3) : explicitTargetSets;

  if (targetSets <= 0) {
    return false;
  }

  // 3. Strict target reps calculation:
  // Must come from explicit planTarget.reps or workout.targetReps as a single rep target value
  const rawTargetReps = planTarget?.reps ?? workout.targetReps;
  if (rawTargetReps === undefined || rawTargetReps === null || String(rawTargetReps).trim() === '') {
    return false;
  }

  const targetRepsValue = parseInt(String(rawTargetReps).trim(), 10);
  if (isNaN(targetRepsValue) || targetRepsValue <= 0) {
    return false;
  }

  // 4. Evaluate all target sets
  const set1 = Number(workout.set1) || 0;
  const set2 = Number(workout.set2) || 0;
  const set3 = Number(workout.set3) || 0;
  const sets = [set1, set2, set3];

  for (let i = 0; i < targetSets; i++) {
    if ((sets[i] || 0) < targetRepsValue) {
      return false;
    }
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

/**
 * Calculates the effective total weight lifted based on exercise equipment:
 * - '2 dumbbell': double the weight entered (W * 2)
 * - 'barbell': double the weight entered (plate weight) plus 45 lb barbell (W * 2 + 45)
 * - 'cable' | '1 dumbbell' | undefined: weight entered as is (W)
 */
export function calculateEffectiveWeight(
  enteredWeight: number | undefined,
  equipment?: ExerciseEquipment | string,
  isBW?: boolean
): number {
  const w = Number(enteredWeight) || 0;
  if (isBW && w === 0 && !equipment) {
    return 0;
  }
  switch (equipment) {
    case '2 dumbbell':
      return w * 2;
    case 'barbell':
      return (w * 2) + 45;
    case 'cable':
    case '1 dumbbell':
    default:
      return w;
  }
}

export interface ExerciseVolumeDetail {
  exerciseName: string;
  weight: number;
  effectiveWeight?: number;
  equipment?: ExerciseEquipment;
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
  now: Date = new Date(),
  userPlan?: UserPlan | null
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
    const isBW = isBWTarget(w.exerciseName, w.intensity, userPlan, w) || !!w.isBW;
    const equipment = userPlan?.exerciseMetadata?.[w.exerciseName]?.equipment;
    const effectiveWeight = calculateEffectiveWeight(weight, equipment, isBW);
    const volume = effectiveWeight * reps;

    const exerciseDetail: ExerciseVolumeDetail = {
      exerciseName: w.exerciseName,
      weight,
      effectiveWeight,
      equipment,
      reps,
      volume,
      isBW
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

/**
 * Normalizes a video URL to guarantee a valid web protocol.
 */
export function normalizeVideoUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Parses a YouTube video URL (standard watch, short links, shorts, embed) and returns
 * a privacy-enhanced embed URL for iframes, preserving timestamp offsets.
 * Returns null if the URL is not a recognizable YouTube video link.
 */
export function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Regex matching standard watch, shortened youtu.be, shorts, and embeds
  const regExp = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i;
  const match = trimmed.match(regExp);

  if (match && match[1]) {
    const videoId = match[1];
    let startParam = '';
    const timeMatch = trimmed.match(/[?&](?:t|start)=([0-9hms]+)/i);
    if (timeMatch && timeMatch[1]) {
      const timeStr = timeMatch[1].toLowerCase();
      let seconds = 0;
      if (timeStr.includes('h') || timeStr.includes('m') || timeStr.includes('s')) {
        const h = timeStr.match(/(\d+)h/);
        const m = timeStr.match(/(\d+)m/);
        const s = timeStr.match(/(\d+)s/);
        if (h) seconds += parseInt(h[1], 10) * 3600;
        if (m) seconds += parseInt(m[1], 10) * 60;
        if (s) seconds += parseInt(s[1], 10);
      } else {
        seconds = parseInt(timeStr, 10) || 0;
      }
      if (seconds > 0) {
        startParam = `?start=${seconds}`;
      }
    }
    return `https://www.youtube-nocookie.com/embed/${videoId}${startParam}`;
  }

  return null;
}

