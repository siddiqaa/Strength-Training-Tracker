/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { calculateShowDeloadBadge, getOrderedExerciseNames, createExerciseOrderItems, createExerciseOrderTuples, isSameDay, getLastDayWorkoutForExercise, parseWorkoutDate, isBWTarget, getWorkoutTotalReps, getWorkoutPlotValue, calculate60DayVolumeData, calculateEffectiveWeight, getYouTubeEmbedUrl, normalizeVideoUrl } from './workoutUtils';
import { Workout, UserPlan, MUSCLE_GROUPS } from '../types';

describe('createExerciseOrderItems', () => {
  it('should convert string array into position objects', () => {
    const exercises = ['Squat', 'Bench Press', 'Barbell Row'];
    expect(createExerciseOrderItems(exercises)).toEqual([
      { exercise: 'Squat', position: 0 },
      { exercise: 'Bench Press', position: 1 },
      { exercise: 'Barbell Row', position: 2 }
    ]);
  });
});

describe('getOrderedExerciseNames', () => {
  it('should parse explicit position objects correctly', () => {
    const items = [
      { exercise: 'Deadlift', position: 2 },
      { exercise: 'Squat', position: 0 },
      { exercise: 'Bench Press', position: 1 }
    ];
    // Even if array order is shuffled during serialization/deserialization, it must sort by position index
    expect(getOrderedExerciseNames(items)).toEqual([
      'Squat',
      'Bench Press',
      'Deadlift'
    ]);
  });

  it('should parse legacy tuples or strings cleanly', () => {
    const tuples: [string, number][] = [
      ['Deadlift', 2],
      ['Squat', 0],
      ['Bench Press', 1]
    ];
    expect(getOrderedExerciseNames(tuples)).toEqual([
      'Squat',
      'Bench Press',
      'Deadlift'
    ]);
  });

  it('should handle legacy string array order', () => {
    const legacyArray = ['Squat', 'Bench Press', 'Deadlift'];
    expect(getOrderedExerciseNames(legacyArray)).toEqual([
      'Squat',
      'Bench Press',
      'Deadlift'
    ]);
  });

  it('should handle deletion in the middle and re-number position indices contiguous', () => {
    const initialExercises = ['Squat', 'Bench Press', 'Barbell Row', 'Deadlift'];
    // User deletes 'Bench Press'
    const remaining = initialExercises.filter(e => e !== 'Bench Press');
    const updatedItems = createExerciseOrderItems(remaining);
    
    expect(updatedItems).toEqual([
      { exercise: 'Squat', position: 0 },
      { exercise: 'Barbell Row', position: 1 },
      { exercise: 'Deadlift', position: 2 }
    ]);

    expect(getOrderedExerciseNames(updatedItems)).toEqual([
      'Squat',
      'Barbell Row',
      'Deadlift'
    ]);
  });

  it('should handle new exercises added into plan and assign next available position index on save', () => {
    const existingOrder = [
      { exercise: 'Squat', position: 0 },
      { exercise: 'Bench Press', position: 1 }
    ];
    const allActiveIncludingNew = ['Squat', 'Bench Press', 'Overhead Press'];
    
    // getOrderedExerciseNames places newly added exercises at the end
    const currentOrder = getOrderedExerciseNames(existingOrder, allActiveIncludingNew);
    expect(currentOrder).toEqual(['Squat', 'Bench Press', 'Overhead Press']);

    // When saved, createExerciseOrderItems re-indexes all items contiguously
    const savedOrder = createExerciseOrderItems(currentOrder);
    expect(savedOrder).toEqual([
      { exercise: 'Squat', position: 0 },
      { exercise: 'Bench Press', position: 1 },
      { exercise: 'Overhead Press', position: 2 }
    ]);
  });
});

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

describe('isSameDay', () => {
  it('should return true for timestamps on the same calendar day', () => {
    const d1 = new Date('2026-08-04T10:00:00').getTime();
    const d2 = new Date('2026-08-04T18:30:00').getTime();
    expect(isSameDay(d1, d2)).toBe(true);
  });

  it('should return false for timestamps on different calendar days', () => {
    const d1 = new Date('2026-08-04T10:00:00').getTime();
    const d2 = new Date('2026-07-28T10:00:00').getTime();
    expect(isSameDay(d1, d2)).toBe(false);
  });
});

describe('getLastDayWorkoutForExercise', () => {
  const aug4Morning = new Date('2026-08-04T09:00:00').getTime();
  const aug4Noon = new Date('2026-08-04T12:00:00').getTime();
  const jul28Noon = new Date('2026-07-28T12:00:00').getTime();

  const workouts: Workout[] = [
    { id: '1', userId: 'u1', exerciseName: 'Bench Press', intensity: 'Heavy', weight: 100, set1: 8, set2: 8, set3: 8, targetWeight: 100, targetReps: '8', targetSets: 3, rpe: 'M', date: aug4Noon },
    { id: '2', userId: 'u1', exerciseName: 'Squat', intensity: 'Heavy', weight: 140, set1: 8, set2: 8, set3: 8, targetWeight: 140, targetReps: '8', targetSets: 3, rpe: 'M', date: aug4Morning },
    { id: '3', userId: 'u1', exerciseName: 'Overhead Press', intensity: 'Heavy', weight: 60, set1: 8, set2: 8, set3: 8, targetWeight: 60, targetReps: '8', targetSets: 3, rpe: 'M', date: jul28Noon },
  ];

  it('should return the workout from the last relevant day (Aug 4)', () => {
    const result = getLastDayWorkoutForExercise(workouts, 'Bench Press', 'Heavy');
    expect(result?.id).toBe('1');
  });

  it('should return undefined if an exercise was skipped on the last relevant day (Aug 4)', () => {
    // Overhead Press was logged on Jul 28, but not on Aug 4 (the last Heavy day)
    const result = getLastDayWorkoutForExercise(workouts, 'Overhead Press', 'Heavy');
    expect(result).toBeUndefined();
  });
});

describe('parseWorkoutDate', () => {
  it('should correctly parse Firestore Timestamp objects with toMillis', () => {
    const fakeTimestamp = { toMillis: () => 1700000000000 };
    expect(parseWorkoutDate(fakeTimestamp)).toBe(1700000000000);
  });

  it('should correctly parse seconds object', () => {
    const fakeSeconds = { seconds: 1700000000 };
    expect(parseWorkoutDate(fakeSeconds)).toBe(1700000000000);
  });

  it('should return number as is', () => {
    expect(parseWorkoutDate(1700000000000)).toBe(1700000000000);
  });

  it('should handle pending serverTimestamp() sentinel objects without returning NaN', () => {
    const before = Date.now();
    const result = parseWorkoutDate({ _methodName: 'serverTimestamp' });
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
    expect(isNaN(result)).toBe(false);
  });

  it('should handle null/undefined without returning NaN', () => {
    expect(isNaN(parseWorkoutDate(null))).toBe(false);
    expect(isNaN(parseWorkoutDate(undefined))).toBe(false);
  });
});

describe('BW target and plot calculations', () => {
  const planWithBW: UserPlan = {
    userId: 'u1',
    Heavy: {
      'Pullups': { weight: 0, sets: 3, reps: '8', isBW: true },
      'Bench Press': { weight: 185, sets: 3, reps: '8', isBW: false }
    },
    Light: {
      'Pullups': { weight: 0, sets: 2, reps: '12', isBW: true }
    },
    Medium: {}
  };

  it('should detect isBWTarget from userPlan', () => {
    expect(isBWTarget('Pullups', 'Heavy', planWithBW)).toBe(true);
    expect(isBWTarget('Pullups', 'Light', planWithBW)).toBe(true);
    expect(isBWTarget('Bench Press', 'Heavy', planWithBW)).toBe(false);
    expect(isBWTarget('Squat', 'Heavy', planWithBW)).toBe(false);
  });

  it('should calculate total reps accurately', () => {
    const w: Workout = {
      userId: 'u1',
      exerciseName: 'Pullups',
      intensity: 'Heavy',
      weight: 0,
      set1: 10,
      set2: 8,
      set3: 6,
      date: Date.now()
    };
    expect(getWorkoutTotalReps(w)).toBe(24);
  });

  it('should plot total reps for BW exercises without multiplier', () => {
    const bwWorkout: Workout = {
      userId: 'u1',
      exerciseName: 'Pullups',
      intensity: 'Heavy',
      weight: 0,
      set1: 8,
      set2: 8,
      set3: 8,
      date: Date.now()
    };
    // 24 reps total
    expect(getWorkoutPlotValue(bwWorkout, planWithBW)).toBe(24);
  });

  it('should plot standard weight for non-BW exercises', () => {
    const regularWorkout: Workout = {
      userId: 'u1',
      exerciseName: 'Bench Press',
      intensity: 'Heavy',
      weight: 185,
      set1: 8,
      set2: 8,
      set3: 8,
      date: Date.now()
    };
    expect(getWorkoutPlotValue(regularWorkout, planWithBW)).toBe(185);
  });

  it('should include Abs in MUSCLE_GROUPS', () => {
    expect(MUSCLE_GROUPS).toContain('Abs');
  });
});

describe('calculate60DayVolumeData', () => {
  const refNow = new Date('2026-09-14T12:00:00Z');
  const dayMs = 24 * 60 * 60 * 1000;

  it('should return empty stats and zero volume for empty workouts', () => {
    const result = calculate60DayVolumeData([], refNow);
    expect(result.sessions).toEqual([]);
    expect(result.stats.totalVolume).toBe(0);
    expect(result.stats.heavyVolume).toBe(0);
    expect(result.stats.mediumVolume).toBe(0);
    expect(result.stats.lightVolume).toBe(0);
    expect(result.stats.totalSessions).toBe(0);
  });

  it('should calculate volume accurately categorized by Heavy, Medium, and Light sessions within 60 days', () => {
    const todayTime = refNow.getTime();

    const workouts: Workout[] = [
      // 5 days ago: Heavy session with Squat and Bench
      {
        id: '1',
        userId: 'u1',
        exerciseName: 'Squat',
        intensity: 'Heavy',
        weight: 200,
        set1: 8,
        set2: 8,
        set3: 8, // 24 reps * 200 = 4800 lbs
        date: todayTime - (5 * dayMs),
      },
      {
        id: '2',
        userId: 'u1',
        exerciseName: 'Bench Press',
        intensity: 'Heavy',
        weight: 150,
        set1: 8,
        set2: 8,
        set3: 8, // 24 reps * 150 = 3600 lbs
        date: todayTime - (5 * dayMs),
      },
      // Total Heavy volume on day -5 = 8400 lbs

      // 3 days ago: Light session with Squat (120 lbs, 2x15 = 30 reps = 3600 lbs)
      {
        id: '3',
        userId: 'u1',
        exerciseName: 'Squat',
        intensity: 'Light',
        weight: 120,
        set1: 15,
        set2: 15,
        date: todayTime - (3 * dayMs),
      },
      // Total Light volume on day -3 = 3600 lbs

      // 1 day ago: Medium session with Squat (150 lbs, 3x10 = 30 reps = 4500 lbs)
      {
        id: '4',
        userId: 'u1',
        exerciseName: 'Squat',
        intensity: 'Medium',
        weight: 150,
        set1: 10,
        set2: 10,
        set3: 10,
        date: todayTime - (1 * dayMs),
      },
      // Total Medium volume on day -1 = 4500 lbs

      // 70 days ago: Outside 60-day window!
      {
        id: '5',
        userId: 'u1',
        exerciseName: 'Deadlift',
        intensity: 'Heavy',
        weight: 300,
        set1: 5,
        set2: 5,
        date: todayTime - (70 * dayMs),
      }
    ];

    const result = calculate60DayVolumeData(workouts, refNow);

    // Only 3 sessions within 60 days
    expect(result.sessions.length).toBe(3);
    expect(result.stats.totalSessions).toBe(3);

    // Heavy session check
    expect(result.stats.heavySessions).toBe(1);
    expect(result.stats.heavyVolume).toBe(8400);
    expect(result.stats.avgHeavyVolume).toBe(8400);

    // Light session check
    expect(result.stats.lightSessions).toBe(1);
    expect(result.stats.lightVolume).toBe(3600);
    expect(result.stats.avgLightVolume).toBe(3600);

    // Medium session check
    expect(result.stats.mediumSessions).toBe(1);
    expect(result.stats.mediumVolume).toBe(4500);
    expect(result.stats.avgMediumVolume).toBe(4500);

    // Total volume: 8400 + 3600 + 4500 = 16500 lbs
    expect(result.stats.totalVolume).toBe(16500);

    // Check chronological order (oldest to newest): day -5 (Heavy), day -3 (Light), day -1 (Medium)
    expect(result.sessions[0].intensity).toBe('Heavy');
    expect(result.sessions[0].totalVolume).toBe(8400);
    expect(result.sessions[0].exerciseCount).toBe(2);

    expect(result.sessions[1].intensity).toBe('Light');
    expect(result.sessions[1].totalVolume).toBe(3600);

    expect(result.sessions[2].intensity).toBe('Medium');
    expect(result.sessions[2].totalVolume).toBe(4500);

    // Cumulative progression
    expect(result.cumulativeData.length).toBe(3);
    expect(result.cumulativeData[0].cumulativeTotal).toBe(8400);
    expect(result.cumulativeData[1].cumulativeTotal).toBe(12000);
    expect(result.cumulativeData[2].cumulativeTotal).toBe(16500);

    // Verify weekly buckets start on Monday
    expect(result.weeklyBuckets.length).toBeGreaterThan(0);
    result.weeklyBuckets.forEach(bucket => {
      const startDate = new Date(bucket.weekStart);
      const endDate = new Date(bucket.weekEnd);
      // Monday in JavaScript getDay() is 1
      expect(startDate.getDay()).toBe(1);
      // Sunday in JavaScript getDay() is 0
      expect(endDate.getDay()).toBe(0);
    });

    // Sum of all weekly buckets should match total volume of all sessions
    const weeklySum = result.weeklyBuckets.reduce((acc, b) => acc + b.totalVolume, 0);
    expect(weeklySum).toBe(16500);
  });
});

describe('normalizeVideoUrl', () => {
  it('should return empty string for null, undefined, or empty string', () => {
    expect(normalizeVideoUrl(undefined)).toBe('');
    expect(normalizeVideoUrl('')).toBe('');
    expect(normalizeVideoUrl('   ')).toBe('');
  });

  it('should preserve existing https:// and http:// protocols', () => {
    expect(normalizeVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normalizeVideoUrl('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('http://youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('should prepend https:// if protocol is missing', () => {
    expect(normalizeVideoUrl('youtu.be/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normalizeVideoUrl('www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});

describe('getYouTubeEmbedUrl', () => {
  it('should return null for empty or invalid urls', () => {
    expect(getYouTubeEmbedUrl(undefined)).toBeNull();
    expect(getYouTubeEmbedUrl('')).toBeNull();
    expect(getYouTubeEmbedUrl('https://example.com/video')).toBeNull();
    expect(getYouTubeEmbedUrl('not a url')).toBeNull();
  });

  it('should extract video ID from standard youtube.com watch URLs', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('should extract video ID from shortened youtu.be URLs', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('should extract video ID from youtube shorts URLs', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('should extract video ID from embed URLs', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('should extract video ID from mobile m.youtube.com URLs', () => {
    expect(getYouTubeEmbedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('should extract timestamp offsets in seconds or combined units', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=45');
    expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90');
    expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ?start=65'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=65');
  });
});

describe('calculateEffectiveWeight', () => {
  it('should double the weight entered for 2 dumbbell equipment', () => {
    expect(calculateEffectiveWeight(25, '2 dumbbell')).toBe(50);
    expect(calculateEffectiveWeight(37.5, '2 dumbbell')).toBe(75);
    expect(calculateEffectiveWeight(0, '2 dumbbell')).toBe(0);
  });

  it('should calculate double the weight entered plus 45 lb bar for barbell equipment', () => {
    // 45 lb plate weight entered (one 45 on each side + 45 bar = 135 total)
    expect(calculateEffectiveWeight(45, 'barbell')).toBe(135);
    // 100 lb plate weight entered (two 45s + 10 = 100 on each side + 45 bar = 245 total)
    expect(calculateEffectiveWeight(100, 'barbell')).toBe(245);
    // 0 plate weight entered (empty 45 bar)
    expect(calculateEffectiveWeight(0, 'barbell')).toBe(45);
  });

  it('should return weight entered as is for cable and 1 dumbbell', () => {
    expect(calculateEffectiveWeight(60, 'cable')).toBe(60);
    expect(calculateEffectiveWeight(50, '1 dumbbell')).toBe(50);
  });

  it('should return weight entered as is when equipment is undefined or unspecified', () => {
    expect(calculateEffectiveWeight(135, undefined)).toBe(135);
    expect(calculateEffectiveWeight(100)).toBe(100);
  });

  it('should return 0 for bodyweight exercise with 0 weight and no equipment', () => {
    expect(calculateEffectiveWeight(0, undefined, true)).toBe(0);
  });
});

describe('calculate60DayVolumeData with equipment', () => {
  const refNow = new Date('2026-09-14T12:00:00Z');
  const dayMs = 24 * 60 * 60 * 1000;

  it('should properly apply equipment multipliers to volume calculations', () => {
    const userPlan: UserPlan = {
      userId: 'u1',
      Heavy: {},
      Light: {},
      Medium: {},
      exerciseMetadata: {
        'Dumbbell Press': { equipment: '2 dumbbell' },
        'Barbell Bench Press': { equipment: 'barbell' },
        'Cable Triceps Pushdown': { equipment: 'cable' },
        'One-Arm Dumbbell Row': { equipment: '1 dumbbell' },
      }
    };

    const workouts: Workout[] = [
      {
        id: '1',
        userId: 'u1',
        exerciseName: 'Dumbbell Press',
        intensity: 'Heavy',
        weight: 30, // 30 * 2 = 60 effective wt
        set1: 10,
        set2: 10,
        set3: 10, // 30 reps * 60 = 1800 lbs
        date: refNow.getTime() - (2 * dayMs),
      },
      {
        id: '2',
        userId: 'u1',
        exerciseName: 'Barbell Bench Press',
        intensity: 'Heavy',
        weight: 45, // (45 * 2) + 45 = 135 effective wt
        set1: 8,
        set2: 8,
        set3: 8, // 24 reps * 135 = 3240 lbs
        date: refNow.getTime() - (2 * dayMs),
      },
      {
        id: '3',
        userId: 'u1',
        exerciseName: 'Cable Triceps Pushdown',
        intensity: 'Heavy',
        weight: 50, // 50 effective wt
        set1: 10,
        set2: 10, // 20 reps * 50 = 1000 lbs
        date: refNow.getTime() - (2 * dayMs),
      },
      {
        id: '4',
        userId: 'u1',
        exerciseName: 'One-Arm Dumbbell Row',
        intensity: 'Heavy',
        weight: 40, // 40 effective wt
        set1: 10,
        set2: 10, // 20 reps * 40 = 800 lbs
        date: refNow.getTime() - (2 * dayMs),
      }
    ];

    const result = calculate60DayVolumeData(workouts, refNow, userPlan);

    // Total expected volume: 1800 + 3240 + 1000 + 800 = 6840 lbs
    expect(result.sessions.length).toBe(1);
    expect(result.sessions[0].totalVolume).toBe(6840);
    expect(result.stats.totalVolume).toBe(6840);

    const dbPress = result.sessions[0].exercises.find(e => e.exerciseName === 'Dumbbell Press');
    expect(dbPress?.effectiveWeight).toBe(60);
    expect(dbPress?.volume).toBe(1800);

    const bbBench = result.sessions[0].exercises.find(e => e.exerciseName === 'Barbell Bench Press');
    expect(bbBench?.effectiveWeight).toBe(135);
    expect(bbBench?.volume).toBe(3240);
  });
});



