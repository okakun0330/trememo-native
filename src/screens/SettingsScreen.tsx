import React, { useCallback, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getWeeklyGoal, setWeeklyGoal, getSessions } from '../lib/storage';
import { colors } from '../lib/theme';

export default function SettingsScreen() {
  const [goal, setGoal] = useState(3);
  const [saved, setSaved] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [g, sessions] = await Promise.all([getWeeklyGoal(), getSessions()]);
      setGoal(g);
      setSessionCount(sessions.length);
    })();
  }, []));

  const handleGoalChange = async (val: number) => {
    const clamped = Math.max(1, Math.min(7, val));
    setGoal(clamped);
    await setWeeklyGoal(clamped);
    setSaved(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    Alert.alert(
      'データを全削除',
      'すべてのトレーニング記録・種目・PBが削除されます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する', style: 'destructive',
          onPress: () => Alert.alert('確認', '本当に削除しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            { text: '全削除', style: 'destructive', onPress: async () => {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              await AsyncStorage.clear();
              setSessionCount(0);
              Alert.alert('完了', 'データを削除しました。');
            }},
          ]),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>設定</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Weekly goal */}
        <Text style={styles.sectionLabel}>週間目標</Text>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>週{goal}回</Text>
            {saved && <Text style={styles.savedBadge}>保存 ✓</Text>}
          </View>
          <Text style={styles.cardSub}>1週間のトレーニング目標回数</Text>
          <View style={styles.goalButtons}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.goalBtn, goal === n && styles.goalBtnActive]}
                onPress={() => handleGoalChange(n)}
                activeOpacity={0.8}>
                <Text style={[styles.goalBtnText, goal === n && styles.goalBtnTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>統計</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>総セッション数</Text>
            <Text style={styles.statValue}>{sessionCount}回</Text>
          </View>
        </View>

        {/* App info */}
        <Text style={styles.sectionLabel}>アプリ情報</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 8, paddingTop: 12 }]}>
            <Text style={styles.infoLabel}>アプリ名</Text>
            <Text style={styles.infoValue}>トレメモ</Text>
          </View>
        </View>

        {/* Danger zone */}
        <Text style={[styles.sectionLabel, { color: '#f87171' }]}>データ管理</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
          <Text style={styles.resetText}>全データを削除</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  sectionLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 24, fontWeight: '900', color: colors.green },
  savedBadge: { fontSize: 12, color: colors.green, fontWeight: '700' },
  cardSub: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
  goalButtons: { flexDirection: 'row', gap: 8 },
  goalBtn: { flex: 1, aspectRatio: 1, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalBtnActive: { backgroundColor: colors.greenDim, borderColor: colors.green },
  goalBtnText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  goalBtnTextActive: { color: colors.green },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontSize: 14, color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.white },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, color: colors.white, fontWeight: '600' },
  resetBtn: { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  resetText: { fontSize: 14, fontWeight: '700', color: '#f87171' },
});
