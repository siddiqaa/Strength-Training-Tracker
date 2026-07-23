/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workout } from '../types';

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
