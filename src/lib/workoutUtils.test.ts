/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { calculateShowDeloadBadge } from './workoutUtils';

describe('calculateShowDeloadBadge', () => {
  const referenceNow = new Date('2026-07-22T12:00:00Z');
  const dayMs = 24 * 60 * 60 * 1000;

  it('should return false if there are no workouts', () => {
    expect(calculateShowDeloadBadge([], referenceNow)).toBe(false);
  });

  it('should return true if the user has trained consistently with no 6-day break in the last 60 days', () => {
    // Workout every 3 days. Max consecutive break is 2 days.
    const workouts: { date: number }[] = [];
    const todayTime = referenceNow.getTime();
    
    for (let i = 0; i < 60; i += 3) {
      workouts.push({ date: todayTime - (i * dayMs) });
    }

    expect(calculateShowDeloadBadge(workouts, referenceNow)).toBe(true);
  });

  it('should return false if the user has a break of 6 days or more in the last 60 days', () => {
    // Train for 20 days, then 6 days of break, then train for another 34 days
    const workouts: { date: number }[] = [];
    const todayTime = referenceNow.getTime();

    // Workouts in the first block (days 0 to 20)
    for (let i = 0; i <= 20; i++) {
      workouts.push({ date: todayTime - (i * dayMs) });
    }

    // Days 21, 22, 23, 24, 25, 26 have no workouts (6 consecutive break days)

    // Workouts in the second block (days 27 to 60)
    for (let i = 27; i <= 60; i++) {
      workouts.push({ date: todayTime - (i * dayMs) });
    }

    expect(calculateShowDeloadBadge(workouts, referenceNow)).toBe(false);
  });

  it('should return false if the user has a break of exactly 6 days in the last 60 days', () => {
    const workouts: { date: number }[] = [];
    const todayTime = referenceNow.getTime();

    // Workout on day 0
    workouts.push({ date: todayTime });

    // Days 1, 2, 3, 4, 5, 6 are rest days (6 consecutive rest days)

    // Workout on day 7
    workouts.push({ date: todayTime - (7 * dayMs) });

    // Workout every 2 days for the rest of the 60 days
    for (let i = 8; i <= 60; i += 2) {
      workouts.push({ date: todayTime - (i * dayMs) });
    }

    expect(calculateShowDeloadBadge(workouts, referenceNow)).toBe(false);
  });

  it('should return true if the longest break is exactly 5 days', () => {
    const workouts: { date: number }[] = [];
    const todayTime = referenceNow.getTime();

    // Workout on day 0
    workouts.push({ date: todayTime });

    // Days 1, 2, 3, 4, 5 are rest days (5 consecutive rest days)

    // Workout on day 6
    workouts.push({ date: todayTime - (6 * dayMs) });

    // Workout every day or every other day elsewhere
    for (let i = 7; i <= 60; i += 2) {
      workouts.push({ date: todayTime - (i * dayMs) });
    }

    expect(calculateShowDeloadBadge(workouts, referenceNow)).toBe(true);
  });
});
