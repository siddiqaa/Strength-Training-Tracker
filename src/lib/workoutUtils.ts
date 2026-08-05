/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workout, ExerciseOrderItem } from '../types';

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

