import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { getLastSessionSummary } from '../lib/storage';
import { SessionSummary } from '../lib/storage';
import { colors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import { BODY_PART_LABELS } from '../lib/types';
import { RootStackParamList } from '../lib/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Complete'>;

export default function CompleteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sets, duration } = route.params;

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    (async () => {
      const s = await getLastSessionSummary();
      setSummary(s);
    })();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const durationLabel = `${Math.floor(duration / 60)}分${duration % 60 > 0 ? `${duration % 60}秒` : ''}`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

          {/* Anatomy image */}
          {summary && (
            <Image
              source={anatomyImages[summary.bodyPart]}
              style={styles.heroImg}
              resizeMode="contain"
            />
          )}

          {/* NEW RECORD badge */}
          {summary?.hasPB && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbBadgeText}>NEW RECORD</Text>
            </View>
          )}

          {/* Congrats text */}
          <Text style={styles.completeTitle}>お疲れ様！</Text>
          {summary && (
            <Text style={styles.bpLabel}>{BODY_PART_LABELS[summary.bodyPart]}のトレーニング完了</Text>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{sets}</Text>
              <Text style={styles.statUnit}>セット</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{durationLabel}</Text>
              <Text style={styles.statUnit}>トレーニング時間</Text>
            </View>
          </View>
        </Animated.View>

        {/* Exercise list */}
        {summary && summary.exercises.length > 0 && (
          <View style={styles.exSection}>
            <Text style={styles.exSectionLabel}>今日の記録</Text>
            {summary.exercises.map((ex, i) => (
              <View key={i} style={styles.exCard}>
                <View style={styles.exCardLeft}>
                  <View style={styles.exIconWrap}>
                    <Image
                      source={anatomyImages[ex.bodyPart]}
                      style={styles.exIcon}
                      resizeMode="contain"
                    />
                  </View>
                  <View>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exSets}>{ex.setsLabel}</Text>
                  </View>
                </View>
                {ex.isNewPB && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Back to home */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.replace('MainTabs')}
          activeOpacity={0.85}>
          <Text style={styles.homeBtnText}>ホームに戻る</Text>
        </TouchableOpacity>

        {/* Another session */}
        <TouchableOpacity
          style={styles.againBtn}
          onPress={() => navigation.replace('Select')}
          activeOpacity={0.85}>
          <Text style={styles.againBtnText}>続けてトレーニング</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 60, alignItems: 'center' },
  heroSection: { alignItems: 'center', marginBottom: 32, width: '100%' },
  heroImg: { width: 160, height: 160, marginBottom: 12 },
  pbBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12,
  },
  pbBadgeText: { fontSize: 13, fontWeight: '800', color: '#FFD700', letterSpacing: 1 },
  completeTitle: { fontSize: 40, fontWeight: '900', color: colors.white, marginBottom: 4 },
  bpLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 24 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20,
    width: '100%', justifyContent: 'center', gap: 0,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 36, fontWeight: '900', color: colors.green },
  statUnit: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.cardBorder },
  exSection: { width: '100%', marginBottom: 24 },
  exSectionLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 12 },
  exCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  exCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  exIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  exIcon: { width: 28, height: 28 },
  exName: { fontSize: 14, fontWeight: '700', color: colors.white },
  exSets: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  newBadge: { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFD700', letterSpacing: 1 },
  homeBtn: {
    backgroundColor: colors.green, borderRadius: 18, paddingVertical: 18,
    width: '100%', alignItems: 'center', marginBottom: 10,
  },
  homeBtnText: { fontSize: 16, fontWeight: '900', color: '#000' },
  againBtn: {
    borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 18,
    paddingVertical: 16, width: '100%', alignItems: 'center',
  },
  againBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
