/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Intensity = 'Heavy' | 'Light' | 'Medium';

export interface PlannedSet {
  weight: number;
  sets: number;
  reps: string;
}

export type DayPlan = Record<string, PlannedSet>;

export interface UserPlan {
  id?: string;
  userId: string;
  Heavy: DayPlan;
  Light: DayPlan;
  Medium: DayPlan;
}

export interface Workout {
  id?: string;
  userId: string;
  date: any; // Firestore Timestamp
  exerciseName: string;
  weight: number;
  set1: number;
  set2: number;
  set3?: number;
  intensity: Intensity;
  notes?: string;
  targetWeight?: number;
  targetReps?: string;
  targetSets?: number;
  rpe?: 'E' | 'M' | 'H';
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
