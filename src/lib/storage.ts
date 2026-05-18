import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BodyPart, BodyWeightRecord, Exercise, ExerciseType,
  PersonalBest, WorkoutSession, WorkoutSet, CurrentSession, ExerciseRecord,
} from './types';

// ── Keys ──────────────────────────────────────────────────────────────────────
const KEYS = {
  EXERCISES: 'trememo_exercises',
  SESSIONS: 'trememo_sessions',
  PBS: 'trememo_pbs',
  CURRENT_SESSION: 'trememo_current_session',
  WEEKLY_GOAL: 'trememo_weekly_goal',
  BODY_WEIGHT: 'trememo_body_weight',
  LAST_SUMMARY: 'trememo_last_summary',
};

async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ── Exercise type classifier ──────────────────────────────────────────────────
export function classifyExercise(name: string): ExerciseType {
  const lower = name.toLowerCase();
  const cardioWords = [
    'ランニング', 'ジョギング', 'ウォーキング', 'バイク', '自転車', 'エアロバイク',
    'ステッパー', 'トレッドミル', '水泳', 'スイミング', 'ロープ', '縄跳び',
    'サイクリング', 'マラソン', 'ウォーク', 'ランナー', '有酸素', 'ローイング',
    'running', 'jogging', 'cycling', 'swimming', 'cardio', 'bike', 'walk',
    'treadmill', 'rowing', 'elliptical', 'jump rope', 'skipping',
  ];
  const bwWords = [
    '懸垂', '腕立て', 'プッシュアップ', 'ディップス', 'プランク', 'クランチ',
    'シットアップ', 'バーピー', 'チンアップ', 'プルアップ', 'レッグレイズ',
    'マウンテンクライマー', '自重',
    'pullup', 'chinup', 'pushup', 'push-up', 'dips', 'plank', 'burpee',
    'crunch', 'situp', 'bodyweight', 'leg raise',
  ];
  if (cardioWords.some((w) => lower.includes(w))) return 'CARDIO';
  if (bwWords.some((w) => lower.includes(w))) return 'BODYWEIGHT';
  return 'WEIGHT';
}

// ── Exercises ─────────────────────────────────────────────────────────────────
export async function getExercises(): Promise<Exercise[]> {
  return getItem<Exercise[]>(KEYS.EXERCISES, []);
}

export async function getExercisesByBodyPart(bodyPart: BodyPart): Promise<Exercise[]> {
  const exercises = await getExercises();
  return exercises
    .filter((e) => e.bodyPart === bodyPart)
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
}

export async function addOrUpdateExercise(
  name: string, bodyPart: BodyPart, exerciseType?: ExerciseType
): Promise<Exercise> {
  const exercises = await getExercises();
  const existing = exercises.find(
    (e) => e.name.toLowerCase() === name.toLowerCase() && e.bodyPart === bodyPart
  );
  if (existing) {
    existing.usageCount += 1;
    existing.lastUsed = new Date().toISOString();
    if (exerciseType) existing.exerciseType = exerciseType;
    await setItem(KEYS.EXERCISES, exercises);
    return existing;
  }
  const newEx: Exercise = {
    id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name, bodyPart,
    exerciseType: exerciseType ?? classifyExercise(name),
    usageCount: 1,
    lastUsed: new Date().toISOString(),
  };
  exercises.push(newEx);
  await setItem(KEYS.EXERCISES, exercises);
  return newEx;
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function getSessions(): Promise<WorkoutSession[]> {
  return getItem<WorkoutSession[]>(KEYS.SESSIONS, []);
}

export async function saveSession(session: WorkoutSession): Promise<void> {
  const sessions = await getSessions();
  sessions.push(session);
  await setItem(KEYS.SESSIONS, sessions);
}

export async function getLastSession(): Promise<WorkoutSession | null> {
  const sessions = await getSessions();
  return sessions.length ? sessions[sessions.length - 1] : null;
}

export async function getLastExerciseRecord(
  exerciseId: string
): Promise<{ sets: WorkoutSet[]; date: string } | null> {
  const sessions = await getSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const record = sessions[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (record) return { sets: record.sets, date: sessions[i].date };
  }
  return null;
}

export async function getTodaySavedSets(): Promise<number> {
  const today = new Date().toDateString();
  const sessions = await getSessions();
  return sessions
    .filter((s) => new Date(s.date).toDateString() === today)
    .reduce((total, s) => total + s.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
}

// ── Personal Bests ────────────────────────────────────────────────────────────
export async function getPersonalBests(): Promise<Record<string, PersonalBest>> {
  return getItem<Record<string, PersonalBest>>(KEYS.PBS, {});
}

export async function getPersonalBest(exerciseId: string): Promise<PersonalBest | null> {
  const pbs = await getPersonalBests();
  return pbs[exerciseId] ?? null;
}

export function calculateEstimated1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export async function updatePersonalBest(
  exerciseId: string, exerciseName: string, weight: number, reps: number
): Promise<{ isNewPB: boolean; pbType?: 'weight' | 'reps' }> {
  const pbs = await getPersonalBests();
  const existing = pbs[exerciseId];
  const newE1RM = calculateEstimated1RM(weight, reps);
  if (!existing) {
    pbs[exerciseId] = { exerciseId, exerciseName, weight, reps, estimated1RM: newE1RM, date: new Date().toISOString() };
    await setItem(KEYS.PBS, pbs);
    return { isNewPB: true, pbType: 'weight' };
  }
  if (newE1RM > existing.estimated1RM) {
    const pbType: 'weight' | 'reps' = weight > existing.weight ? 'weight' : 'reps';
    pbs[exerciseId] = { exerciseId, exerciseName, weight, reps, estimated1RM: newE1RM, date: new Date().toISOString() };
    await setItem(KEYS.PBS, pbs);
    return { isNewPB: true, pbType };
  }
  return { isNewPB: false };
}

// ── Weekly goal ───────────────────────────────────────────────────────────────
export async function getWeeklyGoal(): Promise<number> {
  return getItem<number>(KEYS.WEEKLY_GOAL, 3);
}

export async function setWeeklyGoal(goal: number): Promise<void> {
  await setItem(KEYS.WEEKLY_GOAL, Math.max(1, Math.min(7, goal)));
}

export async function getWeeklyStats(): Promise<{ count: number; goal: number }> {
  const sessions = await getSessions();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const days = new Set(
    sessions
      .filter((s) => new Date(s.date) >= weekStart)
      .map((s) => new Date(s.date).toDateString())
  );
  return { count: days.size, goal: await getWeeklyGoal() };
}

// ── Recommended body part ─────────────────────────────────────────────────────
export async function getRecommendedBodyPart(): Promise<BodyPart> {
  const PARTS: BodyPart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs', 'cardio'];
  const sessions = await getSessions();
  if (!sessions.length) return 'chest';
  const lastUsed: Partial<Record<BodyPart, number>> = {};
  for (const s of sessions) {
    lastUsed[s.bodyPart] = Math.max(lastUsed[s.bodyPart] ?? 0, new Date(s.date).getTime());
  }
  let oldest: BodyPart = 'chest';
  let oldestTime = Infinity;
  for (const bp of PARTS) {
    const t = lastUsed[bp] ?? 0;
    if (t < oldestTime) { oldestTime = t; oldest = bp; }
  }
  return oldest;
}

// ── Body Weight ───────────────────────────────────────────────────────────────
export async function getBodyWeightHistory(): Promise<BodyWeightRecord[]> {
  return getItem<BodyWeightRecord[]>(KEYS.BODY_WEIGHT, []);
}

export async function recordBodyWeight(weight: number): Promise<void> {
  const records = await getBodyWeightHistory();
  const today = new Date().toISOString().split('T')[0];
  const idx = records.findIndex((r) => r.date === today);
  if (idx >= 0) {
    records[idx].weight = weight;
  } else {
    records.push({ date: today, weight });
    records.sort((a, b) => a.date.localeCompare(b.date));
  }
  await setItem(KEYS.BODY_WEIGHT, records);
}

export async function getLatestBodyWeight(): Promise<BodyWeightRecord | null> {
  const records = await getBodyWeightHistory();
  return records.length ? records[records.length - 1] : null;
}

// ── Current Session ───────────────────────────────────────────────────────────
export async function getCurrentSession(): Promise<CurrentSession | null> {
  return getItem<CurrentSession | null>(KEYS.CURRENT_SESSION, null);
}

export async function setCurrentSession(session: CurrentSession | null): Promise<void> {
  await setItem(KEYS.CURRENT_SESSION, session);
}

export async function startNewSession(bodyPart: BodyPart): Promise<CurrentSession> {
  const session: CurrentSession = {
    id: `session_${Date.now()}`,
    startTime: new Date().toISOString(),
    bodyPart,
    exercises: [],
  };
  await setCurrentSession(session);
  return session;
}

// ── Session Summary ───────────────────────────────────────────────────────────
export interface ExerciseSummary {
  name: string;
  bodyPart: BodyPart;
  setsLabel: string;
  isNewPB: boolean;
}
export interface SessionSummary {
  bodyPart: BodyPart;
  exercises: ExerciseSummary[];
  hasPB: boolean;
}

export async function saveLastSessionSummary(summary: SessionSummary): Promise<void> {
  await setItem(KEYS.LAST_SUMMARY, summary);
}

export async function getLastSessionSummary(): Promise<SessionSummary | null> {
  return getItem<SessionSummary | null>(KEYS.LAST_SUMMARY, null);
}

// ── Exercise History ──────────────────────────────────────────────────────────
export async function getExerciseHistory(exerciseId: string): Promise<Array<{
  date: string; sets: WorkoutSet[]; maxSet: WorkoutSet; estimated1RM: number;
}>> {
  const sessions = await getSessions();
  const result: Array<{ date: string; sets: WorkoutSet[]; maxSet: WorkoutSet; estimated1RM: number }> = [];
  for (const session of sessions) {
    const record = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (record && record.sets.length > 0) {
      const maxSet = record.sets.reduce((best, s) =>
        calculateEstimated1RM(s.weight, s.reps) > calculateEstimated1RM(best.weight, best.reps) ? s : best
      );
      result.push({
        date: session.date, sets: record.sets, maxSet,
        estimated1RM: calculateEstimated1RM(maxSet.weight, maxSet.reps),
      });
    }
  }
  return result;
}
