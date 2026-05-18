import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, AppStateStatus, Image, Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import {
  getExercisesByBodyPart, addOrUpdateExercise,
  getLastExerciseRecord, updatePersonalBest, saveSession,
  saveLastSessionSummary, setCurrentSession,
  startNewSession, calculateEstimated1RM,
} from '../lib/storage';
import { colors, bodyColors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import {
  BodyPart, BODY_PART_LABELS, Exercise, ExerciseRecord, ExerciseType, WorkoutSet,
} from '../lib/types';
import { RootStackParamList } from '../lib/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Session'>;

const REST_PRESETS = [30, 60, 90, 120, 180];

// ── Rest Timer Banner (非ブロッキング) ────────────────────────────────────────
function RestTimerBanner({
  seconds, total, onSkip,
}: { seconds: number; total: number; onSkip: () => void }) {
  const pct = total > 0 ? seconds / total : 0;
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <View style={rst.banner}>
      <Svg width={44} height={44}>
        <Circle cx={22} cy={22} r={r} stroke="#1A1A1A" strokeWidth={4} fill="none" />
        <Circle
          cx={22} cy={22} r={r}
          stroke={colors.green} strokeWidth={4} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90} origin="22,22"
        />
      </Svg>
      <View style={rst.textWrap}>
        <Text style={rst.label}>休憩中</Text>
        <Text style={rst.time}>{mins}:{String(secs).padStart(2, '0')}</Text>
      </View>
      <TouchableOpacity style={rst.skipBtn} onPress={onSkip} activeOpacity={0.8}>
        <Text style={rst.skipText}>スキップ</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function SessionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bodyPart } = route.params;

  type Phase = 'selecting' | 'recording';
  const [phase, setPhase] = useState<Phase>('selecting');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [currentSets, setCurrentSets] = useState<WorkoutSet[]>([]);
  const [completedExercises, setCompletedExercises] = useState<ExerciseRecord[]>([]);
  const [lastRecord, setLastRecord] = useState<{ sets: WorkoutSet[]; date: string } | null>(null);

  // Input state
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [distanceInput, setDistanceInput] = useState('');

  // Add exercise UI
  const [showAddInput, setShowAddInput] = useState(false);
  const [newExName, setNewExName] = useState('');

  // 種目名編集
  const [editingName, setEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');

  // メモ
  const [memo, setMemo] = useState('');

  // Rest timer — バックグラウンド対応: 終了時刻で管理
  const [restActive, setRestActive] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restTotal, setRestTotal] = useState(60);
  const restEndTimeRef = useRef<number>(0); // 終了予定タイムスタンプ
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session elapsed — バックグラウンド対応: 開始時刻で管理
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // AppState (バックグラウンド復帰時の再計算)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize
  useEffect(() => {
    (async () => {
      await startNewSession(bodyPart);
      const list = await getExercisesByBodyPart(bodyPart);
      setExercises(list);
    })();

    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // AppState変化を監視（バックグラウンドから戻ったとき）
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // フォアグラウンド復帰 → restタイマーを再計算
        if (restEndTimeRef.current > 0) {
          const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
          if (remaining <= 0) {
            stopRest();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            setRestSeconds(remaining);
          }
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (restRef.current) clearInterval(restRef.current);
      sub.remove();
    };
  }, [bodyPart]);

  // ── Rest timer ─────────────────────────────────────────────────────────────
  const stopRest = useCallback(() => {
    if (restRef.current) clearInterval(restRef.current);
    setRestActive(false);
    setRestSeconds(0);
    restEndTimeRef.current = 0;
  }, []);

  const startRest = useCallback((secs: number) => {
    if (restRef.current) clearInterval(restRef.current);
    const endTime = Date.now() + secs * 1000;
    restEndTimeRef.current = endTime;
    setRestTotal(secs);
    setRestSeconds(secs);
    setRestActive(true);

    restRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      setRestSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(restRef.current!);
        setRestActive(false);
        restEndTimeRef.current = 0;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 500);
  }, []);

  // ── Select exercise ────────────────────────────────────────────────────────
  const selectExercise = useCallback(async (ex: Exercise) => {
    setCurrentExercise(ex);
    setCurrentSets([]);
    setWeightInput('');
    setRepsInput('');
    setDurationInput('');
    setDistanceInput('');
    setEditingName(false);
    setEditNameInput(ex.name);
    const rec = await getLastExerciseRecord(ex.id);
    setLastRecord(rec);
    setPhase('recording');
  }, []);

  // 種目名を変更して保存
  const saveExerciseName = useCallback(async () => {
    const name = editNameInput.trim();
    if (!name || !currentExercise || name === currentExercise.name) {
      setEditingName(false);
      return;
    }
    const updated = await addOrUpdateExercise(name, bodyPart, currentExercise.exerciseType);
    setCurrentExercise(updated);
    const list = await getExercisesByBodyPart(bodyPart);
    setExercises(list);
    setEditingName(false);
  }, [editNameInput, currentExercise, bodyPart]);

  const addNewExercise = useCallback(async () => {
    const name = newExName.trim();
    if (!name) return;
    const ex = await addOrUpdateExercise(name, bodyPart);
    const list = await getExercisesByBodyPart(bodyPart);
    setExercises(list);
    setNewExName('');
    setShowAddInput(false);
    Keyboard.dismiss();
    await selectExercise(ex);
  }, [newExName, bodyPart, selectExercise]);

  // ── Add set ────────────────────────────────────────────────────────────────
  const exerciseType: ExerciseType = currentExercise?.exerciseType ?? 'WEIGHT';

  const addSet = useCallback(async () => {
    if (!currentExercise) return;
    let newSet: WorkoutSet;

    if (exerciseType === 'CARDIO') {
      const dur = parseInt(durationInput);
      if (!dur || dur <= 0) return;
      const dist = parseFloat(distanceInput) || 0;
      newSet = { weight: 0, reps: 0, durationSeconds: dur, distanceKm: dist || undefined };
    } else if (exerciseType === 'BODYWEIGHT') {
      const r = parseInt(repsInput);
      if (!r || r <= 0) return;
      newSet = { weight: 0, reps: r };
    } else {
      const w = parseFloat(weightInput);
      const r = parseInt(repsInput);
      if (!w || w <= 0 || !r || r <= 0) return;
      newSet = { weight: w, reps: r };
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentSets((prev) => [...prev, newSet]);
    startRest(restTotal);
  }, [currentExercise, exerciseType, weightInput, repsInput, durationInput, distanceInput, restTotal, startRest]);

  // ── Remove set ─────────────────────────────────────────────────────────────
  const removeSet = useCallback((idx: number) => {
    setCurrentSets((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Save current exercise & go back to selecting ───────────────────────────
  const saveCurrentExercise = useCallback((): ExerciseRecord | null => {
    if (!currentExercise || currentSets.length === 0) return null;
    return {
      exerciseId: currentExercise.id,
      exerciseName: currentExercise.name,
      bodyPart,
      exerciseType: currentExercise.exerciseType,
      sets: currentSets,
      isNewPB: false,
    };
  }, [currentExercise, currentSets, bodyPart]);

  const backToSelecting = useCallback(() => {
    const rec = saveCurrentExercise();
    if (rec) {
      setCompletedExercises((prev) => {
        const exists = prev.findIndex((e) => e.exerciseId === rec.exerciseId);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = { ...updated[exists], sets: [...updated[exists].sets, ...rec.sets] };
          return updated;
        }
        return [...prev, rec];
      });
    }
    stopRest();
    setCurrentExercise(null);
    setCurrentSets([]);
    setPhase('selecting');
  }, [saveCurrentExercise, stopRest]);

  const confirmBackToSelecting = useCallback(() => {
    if (currentSets.length > 0) {
      Alert.alert('種目を保存', 'このセットを保存して種目選択に戻りますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '保存して戻る', onPress: backToSelecting },
      ]);
    } else {
      setPhase('selecting');
      setCurrentExercise(null);
    }
  }, [currentSets.length, backToSelecting]);

  // ── Finish training ────────────────────────────────────────────────────────
  const finishTraining = useCallback(async () => {
    const currentRec = saveCurrentExercise();
    let allExercises = [...completedExercises];
    if (currentRec) {
      const exists = allExercises.findIndex((e) => e.exerciseId === currentRec.exerciseId);
      if (exists >= 0) {
        allExercises[exists] = {
          ...allExercises[exists],
          sets: [...allExercises[exists].sets, ...currentRec.sets],
        };
      } else {
        allExercises.push(currentRec);
      }
    }

    const totalSets = allExercises.reduce((t, e) => t + e.sets.length, 0);
    if (totalSets === 0) {
      Alert.alert('セットがありません', 'まず1セット記録してください。');
      return;
    }

    Alert.alert('トレーニング終了', '記録を保存して終了しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '保存して終了', onPress: async () => {
          const exerciseSummaries = await Promise.all(
            allExercises.map(async (rec) => {
              let isNewPB = false;
              if (rec.exerciseType !== 'CARDIO' && rec.sets.length > 0) {
                const maxSet = rec.sets.reduce((best, s) =>
                  calculateEstimated1RM(s.weight, s.reps) > calculateEstimated1RM(best.weight, best.reps) ? s : best
                );
                const result = await updatePersonalBest(
                  rec.exerciseId, rec.exerciseName, maxSet.weight, maxSet.reps
                );
                isNewPB = result.isNewPB;
              }

              let setsLabel = '';
              if (rec.exerciseType === 'CARDIO') {
                const totalDur = rec.sets.reduce((t, s) => t + (s.durationSeconds ?? 0), 0);
                const m = Math.floor(totalDur / 60);
                const s = totalDur % 60;
                setsLabel = `${m}分${s > 0 ? s + '秒' : ''}`;
              } else if (rec.exerciseType === 'BODYWEIGHT') {
                setsLabel = rec.sets.map((s) => `${s.reps}回`).join(' / ');
              } else {
                setsLabel = rec.sets.map((s) => `${s.weight}kg×${s.reps}`).join(' / ');
              }

              return {
                name: rec.exerciseName, bodyPart: rec.bodyPart,
                setsLabel, isNewPB,
              };
            })
          );

          const hasPB = exerciseSummaries.some((e) => e.isNewPB);
          const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);

          const session = {
            id: `session_${Date.now()}`,
            date: new Date().toISOString(),
            bodyPart,
            exercises: allExercises.map((rec, i) => ({ ...rec, isNewPB: exerciseSummaries[i].isNewPB })),
            durationSeconds: durationSecs,
            memo: memo.trim() || undefined,
          };

          await saveSession(session);
          await saveLastSessionSummary({ bodyPart, exercises: exerciseSummaries, hasPB });
          await setCurrentSession(null);

          if (elapsedRef.current) clearInterval(elapsedRef.current);
          stopRest();

          navigation.replace('Complete', {
            sets: totalSets,
            duration: durationSecs,
          });
        },
      },
    ]);
  }, [saveCurrentExercise, completedExercises, bodyPart, memo, stopRest, navigation]);

  // ── Exit session ───────────────────────────────────────────────────────────
  const exitSession = useCallback(() => {
    const hasData = completedExercises.length > 0 || currentSets.length > 0;
    if (hasData) {
      Alert.alert('セッションを終了', 'データは保存されません。本当に終了しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了する', style: 'destructive', onPress: async () => {
            await setCurrentSession(null);
            stopRest();
            navigation.replace('MainTabs');
          },
        },
      ]);
    } else {
      setCurrentSession(null);
      navigation.replace('MainTabs');
    }
  }, [completedExercises.length, currentSets.length, stopRest, navigation]);

  // ── Elapsed format ─────────────────────────────────────────────────────────
  const elapsedMins = Math.floor(elapsed / 60);
  const elapsedSecs = elapsed % 60;
  const elapsedLabel = `${elapsedMins}:${String(elapsedSecs).padStart(2, '0')}`;
  const totalSetsAll = completedExercises.reduce((t, e) => t + e.sets.length, 0) + currentSets.length;
  const accentColor = bodyColors[bodyPart];

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={phase === 'recording' ? confirmBackToSelecting : exitSession} style={styles.headerLeft}>
          <Text style={styles.headerBackText}>
            {phase === 'recording' ? '← 戻る' : '× 終了'}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerBp, { color: accentColor }]}>
            {BODY_PART_LABELS[bodyPart]}
          </Text>
          {/* タイマーとセット数を大きく表示 */}
          <Text style={styles.headerTimer}>{elapsedLabel}</Text>
          {totalSetsAll > 0 && (
            <Text style={styles.headerSets}>{totalSetsAll} セット</Text>
          )}
        </View>

        {phase === 'recording' ? (
          <TouchableOpacity onPress={finishTraining} style={styles.finishBtn}>
            <Text style={styles.finishBtnText}>完了</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={totalSetsAll > 0 ? finishTraining : undefined}
            style={[styles.finishBtn, totalSetsAll === 0 && styles.finishBtnDim]}>
            <Text style={[styles.finishBtnText, totalSetsAll === 0 && styles.finishBtnTextDim]}>完了</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 休憩バナー（非ブロッキング） */}
      {restActive && (
        <RestTimerBanner seconds={restSeconds} total={restTotal} onSkip={stopRest} />
      )}

      {/* Phase: selecting */}
      {phase === 'selecting' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.selectScroll} showsVerticalScrollIndicator={false}>

            {/* Completed summary */}
            {completedExercises.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>記録済み</Text>
                {completedExercises.map((rec) => (
                  <Text key={rec.exerciseId} style={styles.summaryRow}>
                    {rec.exerciseName} — {rec.sets.length}セット
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>種目を選択</Text>

            {exercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={styles.exRow}
                onPress={() => selectExercise(ex)}
                activeOpacity={0.75}>
                <View style={[styles.exDot, { backgroundColor: accentColor }]} />
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Add new */}
            {showAddInput ? (
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  value={newExName}
                  onChangeText={setNewExName}
                  placeholder="種目名を入力"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={addNewExercise}
                  autoFocus
                />
                <TouchableOpacity style={styles.addConfirmBtn} onPress={addNewExercise}>
                  <Text style={styles.addConfirmText}>追加</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowAddInput(false); setNewExName(''); }}>
                  <Text style={styles.addCancelText}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddInput(true)}>
                <Text style={styles.addBtnText}>+ 種目を追加</Text>
              </TouchableOpacity>
            )}

            {/* メモ欄 */}
            <View style={styles.memoCard}>
              <Text style={styles.memoLabel}>メモ</Text>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="今日のトレーニングについてメモ..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Phase: recording */}
      {phase === 'recording' && currentExercise && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.recordScroll} showsVerticalScrollIndicator={false}>

            {/* Exercise title */}
            <View style={styles.exTitleRow}>
              <Image source={anatomyImages[bodyPart]} style={styles.exImg} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                {editingName ? (
                  <TextInput
                    style={styles.exTitleInput}
                    value={editNameInput}
                    onChangeText={setEditNameInput}
                    onBlur={saveExerciseName}
                    onSubmitEditing={saveExerciseName}
                    returnKeyType="done"
                    autoFocus
                  />
                ) : (
                  <View style={styles.exTitleNameRow}>
                    <Text style={styles.exTitleName}>{currentExercise.name}</Text>
                    <TouchableOpacity
                      onPress={() => { setEditingName(true); setEditNameInput(currentExercise.name); }}
                      style={styles.editBtn}>
                      <Text style={styles.editBtnText}>変更</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.exTitleBp, { color: accentColor }]}>
                  {BODY_PART_LABELS[bodyPart]}
                </Text>
              </View>
            </View>

            {/* Previous record */}
            {lastRecord && (
              <View style={styles.prevCard}>
                <Text style={styles.prevLabel}>前回</Text>
                {lastRecord.sets.map((s, i) => (
                  <Text key={i} style={styles.prevSet}>
                    {exerciseType === 'CARDIO'
                      ? `${Math.floor((s.durationSeconds ?? 0) / 60)}分`
                      : exerciseType === 'BODYWEIGHT'
                        ? `${s.reps}回`
                        : `${s.weight}kg × ${s.reps}回`}
                  </Text>
                ))}
              </View>
            )}

            {/* Set list */}
            {currentSets.length > 0 && (
              <View style={styles.setsCard}>
                {currentSets.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={styles.setNum}>SET {i + 1}</Text>
                    <Text style={styles.setVal}>
                      {exerciseType === 'CARDIO'
                        ? `${Math.floor((s.durationSeconds ?? 0) / 60)}分`
                        : exerciseType === 'BODYWEIGHT'
                          ? `${s.reps}回`
                          : `${s.weight}kg × ${s.reps}回`}
                    </Text>
                    <TouchableOpacity onPress={() => removeSet(i)} style={styles.removeBtn}>
                      <Text style={styles.removeText}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Rest presets */}
            <View style={styles.presetRow}>
              <Text style={styles.presetLabel}>休憩</Text>
              {REST_PRESETS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.presetBtn, restTotal === sec && styles.presetBtnActive]}
                  onPress={() => setRestTotal(sec)}>
                  <Text style={[styles.presetText, restTotal === sec && styles.presetTextActive]}>
                    {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input area */}
            <View style={styles.inputCard}>
              {exerciseType === 'CARDIO' ? (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>時間（分）</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={durationInput}
                        onChangeText={setDurationInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>距離（km）</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={distanceInput}
                        onChangeText={setDistanceInput}
                        placeholder="0.0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              ) : exerciseType === 'BODYWEIGHT' ? (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>回数</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={repsInput}
                        onChangeText={setRepsInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.inputUnit}>回</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>重量</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={weightInput}
                        onChangeText={setWeightInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.inputUnit}>kg</Text>
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>回数</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        value={repsInput}
                        onChangeText={setRepsInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.inputUnit}>回</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.addSetBtn} onPress={addSet} activeOpacity={0.85}>
                <Text style={styles.addSetText}>+ セットを追加</Text>
              </TouchableOpacity>
            </View>

            {/* 次の種目へボタン */}
            {currentSets.length > 0 && (
              <TouchableOpacity
                style={styles.nextExBtn}
                onPress={backToSelecting}
                activeOpacity={0.85}>
                <Text style={styles.nextExText}>保存して次の種目へ</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  headerLeft: { width: 80 },
  headerBackText: { fontSize: 14, color: colors.green, fontWeight: '600' },
  headerCenter: { alignItems: 'center' },
  headerBp: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  headerTimer: { fontSize: 28, fontWeight: '900', color: colors.white, marginTop: 2 },
  headerSets: { fontSize: 12, color: colors.green, fontWeight: '700', marginTop: 2 },
  finishBtn: { backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, width: 60, alignItems: 'center' },
  finishBtnDim: { backgroundColor: colors.greenDim, borderWidth: 1, borderColor: colors.greenBorder },
  finishBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  finishBtnTextDim: { color: colors.textMuted },
  // Selecting phase
  selectScroll: { padding: 20, paddingBottom: 60 },
  summaryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 20 },
  summaryTitle: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 8 },
  summaryRow: { fontSize: 13, color: colors.white, marginBottom: 4 },
  sectionLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 12 },
  exRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, gap: 10,
  },
  exDot: { width: 6, height: 6, borderRadius: 3 },
  exName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  exArrow: { fontSize: 20, color: colors.textMuted },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addInput: {
    flex: 1, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.white, fontSize: 14,
  },
  addConfirmBtn: { backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  addConfirmText: { fontSize: 13, fontWeight: '800', color: '#000' },
  addCancelText: { fontSize: 18, color: colors.textMuted, paddingHorizontal: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.inputBorder, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  addBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  // メモ
  memoCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: 16, padding: 16, marginTop: 16,
  },
  memoLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 10 },
  memoInput: {
    color: colors.white, fontSize: 14, lineHeight: 22,
    minHeight: 72, textAlignVertical: 'top',
  },
  // Recording phase
  recordScroll: { padding: 20, paddingBottom: 80 },
  exTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  exImg: { width: 56, height: 56 },
  exTitleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exTitleName: { fontSize: 20, fontWeight: '900', color: colors.white, flex: 1 },
  exTitleInput: { fontSize: 20, fontWeight: '900', color: colors.white, borderBottomWidth: 1, borderBottomColor: colors.green, paddingBottom: 2 },
  editBtn: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  editBtnText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  exTitleBp: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 4 },
  prevCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 12 },
  prevLabel: { fontSize: 9, color: colors.textMuted, letterSpacing: 2, marginBottom: 8 },
  prevSet: { fontSize: 12, color: colors.textFaint, marginBottom: 2 },
  setsCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  setNum: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, width: 48 },
  setVal: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.white },
  removeBtn: { padding: 4 },
  removeText: { fontSize: 18, color: colors.textMuted },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  presetLabel: { fontSize: 10, color: colors.textMuted, marginRight: 2 },
  presetBtn: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  presetBtnActive: { backgroundColor: colors.greenDim, borderColor: colors.green },
  presetText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  presetTextActive: { color: colors.green },
  inputCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingRight: 10 },
  input: { flex: 1, textAlign: 'center', color: colors.white, fontSize: 28, fontWeight: '900', paddingVertical: 12 },
  inputUnit: { fontSize: 12, color: colors.textMuted },
  addSetBtn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  addSetText: { fontSize: 16, fontWeight: '900', color: '#000' },
  nextExBtn: { marginTop: 12, borderWidth: 1, borderColor: colors.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextExText: { fontSize: 15, fontWeight: '700', color: colors.green },
});

const rst = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1A0D',
    borderBottomWidth: 1, borderBottomColor: colors.greenBorder,
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 10, color: colors.green, letterSpacing: 2, fontWeight: '700' },
  time: { fontSize: 24, fontWeight: '900', color: colors.white },
  skipBtn: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  skipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
