import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  getWeeklyStats, getLastSession, recordBodyWeight, getLatestBodyWeight,
} from '../lib/storage';
import { colors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import { RootStackParamList } from '../lib/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MESSAGES = [
  '今回も限界を超えろ！',
  '前回の自分を越えよう！',
  '筋肉は裏切らない！',
  '一歩一歩が成長だ！',
  '今日のトレが未来を作る！',
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [weekly, setWeekly] = useState({ count: 0, goal: 3 });
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const [bwInput, setBwInput] = useState('');
  const [prevWeight, setPrevWeight] = useState<number | null>(null);
  const [bwSaved, setBwSaved] = useState(false);

  const load = useCallback(async () => {
    const [w, last, latest] = await Promise.all([
      getWeeklyStats(),
      getLastSession(),
      getLatestBodyWeight(),
    ]);
    setWeekly(w);
    if (last) {
      setLastDate(new Date(last.date).toLocaleDateString('ja-JP', {
        month: 'numeric', day: 'numeric', weekday: 'short',
      }));
    }
    if (latest) {
      setPrevWeight(latest.weight);
      const today = new Date().toISOString().split('T')[0];
      if (latest.date === today) setBwInput(String(latest.weight));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleBwSave = async () => {
    const w = parseFloat(bwInput);
    if (isNaN(w) || w <= 0) return;
    await recordBodyWeight(w);
    setPrevWeight(w);
    setBwSaved(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setBwSaved(false), 2000);
    Keyboard.dismiss();
  };

  const progressPct = Math.min(1, weekly.count / weekly.goal);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appTitle}>トレメモ</Text>
            <Text style={styles.appSubtitle}>前回より伸びたかが一瞬でわかる</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={styles.bubbleWrap}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{message}</Text>
            </View>
          </View>
          <Image source={anatomyImages.hero} style={styles.heroImg} resizeMode="contain" />
        </View>

        {/* Weekly stats */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>今週の達成</Text>
            <Text style={styles.cardLabelRight}>目標 {weekly.goal}回</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsBig}>{weekly.count}</Text>
            <Text style={styles.statsDivider}>/ {weekly.goal}</Text>
            {weekly.count >= weekly.goal && (
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>達成！</Text>
              </View>
            )}
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
          </View>
          {lastDate && <Text style={styles.lastDate}>前回：{lastDate}</Text>}
        </View>

        {/* Body weight */}
        <View style={styles.bwCard}>
          <View style={styles.bwLeft}>
            <View>
              <Text style={styles.bwLabel}>体重</Text>
              {prevWeight && <Text style={styles.bwPrev}>前回: {prevWeight}kg</Text>}
            </View>
          </View>
          <View style={styles.bwRight}>
            <View style={styles.bwInputWrap}>
              <TextInput
                style={styles.bwInput}
                value={bwInput}
                onChangeText={setBwInput}
                placeholder="00.0"
                placeholderTextColor="#333"
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleBwSave}
              />
              <Text style={styles.bwUnit}>kg</Text>
            </View>
            <TouchableOpacity
              style={[styles.bwBtn, bwSaved && styles.bwBtnSaved]}
              onPress={handleBwSave}
              activeOpacity={0.8}>
              <Text style={[styles.bwBtnText, bwSaved && styles.bwBtnTextSaved]}>
                {bwSaved ? '✓' : '記録'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.navigate('Select')}
          activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>今日のトレーニング開始</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  appTitle: { fontSize: 40, fontWeight: '900', color: colors.green, letterSpacing: -1 },
  appSubtitle: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  bubbleWrap: { flex: 1, paddingBottom: 16, paddingRight: 8 },
  bubble: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 16, borderBottomLeftRadius: 2, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', maxWidth: 200 },
  bubbleText: { fontSize: 14, fontWeight: '800', color: colors.white, lineHeight: 20 },
  heroImg: { width: 150, height: 150 },
  // Weekly card
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
  cardLabelRight: { fontSize: 10, color: colors.textFaint },
  statsRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 6 },
  statsBig: { fontSize: 48, fontWeight: '900', color: colors.green, lineHeight: 56 },
  statsDivider: { fontSize: 28, fontWeight: '300', color: colors.textFaint, marginBottom: 4 },
  goalBadge: { marginLeft: 'auto', backgroundColor: colors.greenDim, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  goalBadgeText: { fontSize: 11, fontWeight: '700', color: colors.green },
  progressBg: { height: 8, backgroundColor: '#1A1A1A', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.green },
  lastDate: { fontSize: 10, color: colors.textFaint, marginTop: 8 },
  // Body weight
  bwCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bwLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bwIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  bwIconText: { fontSize: 16 },
  bwLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  bwPrev: { fontSize: 9, color: colors.textFaint, marginTop: 2 },
  bwRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bwInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingRight: 8 },
  bwInput: { width: 56, textAlign: 'center', color: colors.white, fontSize: 14, fontWeight: '700', paddingVertical: 8, paddingHorizontal: 8 },
  bwUnit: { fontSize: 12, color: colors.textMuted },
  bwBtn: { backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  bwBtnSaved: { backgroundColor: colors.greenDim, borderWidth: 1, borderColor: colors.greenBorder },
  bwBtnText: { fontSize: 13, fontWeight: '900', color: '#000' },
  bwBtnTextSaved: { color: colors.green },
  // CTA
  ctaBtn: { backgroundColor: colors.green, borderRadius: 20, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  ctaBtnText: { fontSize: 17, fontWeight: '900', color: '#000' },
  ctaArrow: { fontSize: 17, fontWeight: '900', color: '#000' },
});
