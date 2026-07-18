import { UserPlan } from '../types';

export const DEFAULT_PLAN = {
  Heavy: {
    'Incline DB Press': { weight: 50, sets: 3, reps: '6-8' },
    'Low Seated Row': { weight: 115, sets: 3, reps: '6-8' },
    'DB Split Squat': { weight: 40, sets: 3, reps: '6-8' },
    'Romanian Deadlift': { weight: 75, sets: 3, reps: '6-8' },
    'Lat Pulldown': { weight: 120, sets: 3, reps: '6-8' },
    'DB Shoulder Press': { weight: 35, sets: 3, reps: '6-8' },
    'Tricep Pushdown': { weight: 110, sets: 3, reps: '6-8' },
    'Cable Bicep Curl': { weight: 85, sets: 3, reps: '6-8' },
  },
  Light: {
    'Incline DB Press': { weight: 30, sets: 2, reps: '15' },
    'Low Seated Row': { weight: 70, sets: 2, reps: '15' },
    'DB Split Squat': { weight: 25, sets: 2, reps: '15' },
    'Romanian Deadlift': { weight: 45, sets: 2, reps: '15' },
    'Lat Pulldown': { weight: 70, sets: 2, reps: '15' },
    'DB Shoulder Press': { weight: 20, sets: 2, reps: '15' },
    'Tricep Pushdown': { weight: 65, sets: 2, reps: '15' },
    'Cable Bicep Curl': { weight: 50, sets: 2, reps: '15' },
  },
  Medium: {
    'Incline DB Press': { weight: 37.5, sets: 3, reps: '10-12' },
    'Low Seated Row': { weight: 90, sets: 3, reps: '10-12' },
    'DB Split Squat': { weight: 30, sets: 3, reps: '10-12' },
    'Romanian Deadlift': { weight: 55, sets: 3, reps: '10-12' },
    'Lat Pulldown': { weight: 85, sets: 3, reps: '10-12' },
    'DB Shoulder Press': { weight: 27.5, sets: 3, reps: '10-12' },
    'Tricep Pushdown': { weight: 80, sets: 3, reps: '10-12' },
    'Cable Bicep Curl': { weight: 65, sets: 3, reps: '10-12' },
  },
};
