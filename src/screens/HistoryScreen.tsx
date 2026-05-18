import React, { useCallback, useState } from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { getSessions, getPersonalBests } from '../lib/storage';
import { colors, bodyColors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import { BODY_PART_LABELS, WorkoutSession, PersonalBest } from '../lib/types';
import { TabParamList } from '../lib/navigation';

type Route = RouteProp<TabParamList, 'History'>;

type TabType = 'history' | 'calendar' | 'pbs';

// ── Calendar tab ─────────────────────────────────────────────────────────────
function CalendarTab({ sessions }: { sessions: WorkoutSession[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const trainingDays = new Set(
    sessions
      .filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((s) => new Date(s.date).getDate())
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthTrainingCount = trainingDays.size;

  return (
    <View style={cal.container}>
      <View style={cal.navRow}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Text style={cal.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.monthTitle}>{year}年{month + 1}月</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
          <Text style={cal.navText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={cal.weekRow}>
        {weekDays.map((d, i) => (
          <Text key={i} style={[cal.weekDay, i === 0 && cal.sun, i === 6 && cal.sat]}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, i) => {
          const isTrained = day !== null && trainingDays.has(day);
          const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
          return (
            <View key={i} style={cal.cell}>
              {day !== null && (
                <View style={[cal.dayWrap, isTrained && cal.trainedDay, isToday && !isTrained && cal.today]}>
                  <Text style={[cal.dayText, isTrained && cal.trainedText]}>{day}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text style={cal.summary}>今月のトレーニング: {monthTrainingCount}回</Text>
    </View>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab({ sessions }: { sessions: WorkoutSession[] }) {
  const sorted = [...sessions].reverse();

  if (sorted.length === 0) {
    return (
      <View style={hist.empty}>
        <Text style={hist.emptyText}>まだ記録がありません</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, paddingBottom: 60 }}>
        {sorted.map((session) => {
          const date = new Date(session.date);
          const dateLabel = date.toLocaleDateString('ja-JP', {
            month: 'numeric', day: 'numeric', weekday: 'short',
          });
          const totalSets = session.exercises.reduce((t, e) => t + e.sets.length, 0);
          const dur = `${Math.floor(session.durationSeconds / 60)}分`;
          const accentColor = bodyColors[session.bodyPart];

          return (
            <View key={session.id} style={hist.card}>
              <View style={hist.cardHeader}>
                <Image source={anatomyImages[session.bodyPart]} style={hist.img} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={[hist.bp, { color: accentColor }]}>{BODY_PART_LABELS[session.bodyPart]}</Text>
                  <Text style={hist.date}>{dateLabel} · {dur} · {totalSets}セット</Text>
                </View>
              </View>
              {session.exercises.map((ex) => (
                <View key={ex.exerciseId} style={hist.exRow}>
                  <Text style={hist.exName}>{ex.exerciseName}</Text>
                  <Text style={hist.exSets}>{ex.sets.length}セット</Text>
                  {ex.isNewPB && <View style={hist.pbBadge}><Text style={hist.pbText}>PB</Text></View>}
                </View>
              ))}
              {session.memo ? (
                <View style={hist.memoRow}>
                  <Text style={hist.memoText}>{session.memo}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── PBs tab ───────────────────────────────────────────────────────────────────
function PBsTab() {
  const [pbs, setPbs] = useState<Record<string, PersonalBest>>({});

  useFocusEffect(useCallback(() => {
    getPersonalBests().then(setPbs);
  }, []));

  const pbList = Object.values(pbs).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (pbList.length === 0) {
    return (
      <View style={pbst.empty}>
        <Text style={pbst.emptyText}>まだ記録がありません</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, paddingBottom: 60 }}>
        {pbList.map((pb) => (
          <View key={pb.exerciseId} style={pbst.card}>
            <View style={pbst.cardLeft}>
              <Text style={pbst.name}>{pb.exerciseName}</Text>
              <Text style={pbst.detail}>{pb.weight}kg × {pb.reps}回</Text>
              <Text style={pbst.date}>
                {new Date(pb.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </Text>
            </View>
            <View style={pbst.e1rmWrap}>
              <Text style={pbst.e1rmLabel}>推定1RM</Text>
              <Text style={pbst.e1rm}>{pb.estimated1RM}kg</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const route = useRoute<Route>();
  const initialTab: TabType = route.params?.tab === 'calendar'
    ? 'calendar'
    : route.params?.tab === 'pbs'
      ? 'pbs'
      : 'history';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useFocusEffect(useCallback(() => {
    getSessions().then(setSessions);
  }, []));

  const TABS: { key: TabType; label: string }[] = [
    { key: 'history', label: '履歴' },
    { key: 'calendar', label: 'カレンダー' },
    { key: 'pbs', label: 'PB' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>記録</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'history' && <HistoryTab sessions={sessions} />}
      {activeTab === 'calendar' && <CalendarTab sessions={sessions} />}
      {activeTab === 'pbs' && <PBsTab />}
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: colors.white },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  tabActive: { backgroundColor: colors.greenDim, borderColor: colors.green },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.green },
});

const cal = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8 },
  navText: { fontSize: 24, color: colors.white },
  monthTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  sun: { color: '#f87171' },
  sat: { color: '#60a5fa' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.green },
  trainedDay: { backgroundColor: colors.green },
  dayText: { fontSize: 13, color: colors.white, fontWeight: '500' },
  trainedText: { color: '#000', fontWeight: '900' },
  summary: { marginTop: 16, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});

const hist = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  img: { width: 36, height: 36 },
  bp: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.divider, gap: 6 },
  exName: { flex: 1, fontSize: 13, color: colors.white },
  exSets: { fontSize: 11, color: colors.textMuted },
  pbBadge: { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pbText: { fontSize: 9, fontWeight: '800', color: '#FFD700' },
  memoRow: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 6, paddingTop: 8 },
  memoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});

const pbst = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
  cardLeft: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 4 },
  detail: { fontSize: 13, color: colors.textMuted },
  date: { fontSize: 10, color: colors.textFaint, marginTop: 4 },
  e1rmWrap: { alignItems: 'flex-end' },
  e1rmLabel: { fontSize: 9, color: colors.textMuted, letterSpacing: 1, marginBottom: 2 },
  e1rm: { fontSize: 24, fontWeight: '900', color: colors.green },
});
