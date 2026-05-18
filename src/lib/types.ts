export type BodyPart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs' | 'cardio';

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  shoulders: '肩',
  arms: '腕',
  abs: '腹筋',
  cardio: '有酸素',
};

export const BODY_PART_EN: Record<BodyPart, string> = {
  chest: 'CHEST',
  back: 'BACK',
  legs: 'LEG',
  shoulders: 'SHOULDER',
  arms: 'ARM',
  abs: 'ABS',
  cardio: 'CARDIO',
};

export type BodyWeightRecord = {
  date: string;   // YYYY-MM-DD
  weight: number; // kg
};

/** 種目タイプ：重量×回数 / 自重×回数 / 有酸素（時間・距離） */
export type ExerciseType = 'WEIGHT' | 'BODYWEIGHT' | 'CARDIO';

export type WorkoutSet = {
  weight: number;            // WEIGHT: kg  /  BODYWEIGHT: 0  /  CARDIO: 0
  reps: number;              // WEIGHT・BODYWEIGHT: 回数  /  CARDIO: 0
  durationSeconds?: number;  // CARDIO: 秒数
  distanceKm?: number;       // CARDIO: km（任意）
};

export type Exercise = {
  id: string;
  name: string;
  bodyPart: BodyPart;
  exerciseType?: ExerciseType; // 旧データ互換のためオプショナル
  usageCount: number;
  lastUsed: string;
};

export type ExerciseRecord = {
  exerciseId: string;
  exerciseName: string;
  bodyPart: BodyPart;
  exerciseType?: ExerciseType; // 旧データ互換のためオプショナル
  sets: WorkoutSet[];
  isNewPB: boolean;
  memo?: string;
};

export type WorkoutSession = {
  id: string;
  date: string;
  bodyPart: BodyPart;
  exercises: ExerciseRecord[];
  durationSeconds: number;
  memo?: string;
};

export type PersonalBest = {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  estimated1RM: number;
  date: string;
};

export type CurrentSession = {
  id: string;
  startTime: string;
  bodyPart: BodyPart;
  exercises: ExerciseRecord[];
};
