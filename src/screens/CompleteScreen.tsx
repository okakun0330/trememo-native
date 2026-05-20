import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, ImageBackground, Modal, Platform,
  ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoSharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { getLastSessionSummary } from '../lib/storage';
import { SessionSummary } from '../lib/storage';
import { colors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import { BODY_PART_LABELS, BODY_PART_EN } from '../lib/types';
import { RootStackParamList } from '../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Complete'>;

// ── Story Card (シェア用) ─────────────────────────────────────────────────────
function StoryCard({
  summary, sets, duration, bgUri,
}: {
  summary: SessionSummary | null;
  sets: number;
  duration: number;
  bgUri: string | null;
}) {
  const durationLabel = `${Math.floor(duration / 60)}'${String(duration % 60).padStart(2, '0')}"`;
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
  const bpLabel = summary ? BODY_PART_EN[summary.bodyPart] : '';

  const content = (
    <View style={card.inner}>
      {/* オーバーレイ */}
      <View style={card.overlay} />

      {/* TOP: ロゴ + 日付 */}
      <View style={card.top}>
        <Text style={card.appName}>TOREMEMO</Text>
        <Text style={card.date}>{today}</Text>
      </View>

      {/* CENTER: メインテキスト */}
      <View style={card.center}>
        {bpLabel ? <Text style={card.bpLabel}>{bpLabel}</Text> : null}
        <Text style={card.finishedWorkout}>FINISHED{'\n'}WORKOUT</Text>
      </View>

      {/* BOTTOM: 統計 + 種目リスト */}
      <View style={card.bottom}>
        {/* 種目リスト */}
        {summary && summary.exercises.length > 0 && (
          <View style={card.exList}>
            {summary.exercises.slice(0, 4).map((ex, i) => (
              <View key={i} style={card.exRow}>
                <Text style={card.exName}>{ex.name}</Text>
                <Text style={card.exSets}>{ex.setsLabel}</Text>
                {ex.isNewPB && <Text style={card.pbBadge}>PB</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={card.statsRow}>
          <View style={card.statItem}>
            <Text style={card.statNum}>{sets}</Text>
            <Text style={card.statUnit}>SETS</Text>
          </View>
          <View style={card.statDivider} />
          <View style={card.statItem}>
            <Text style={card.statNum}>{durationLabel}</Text>
            <Text style={card.statUnit}>TIME</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (bgUri) {
    return (
      <ImageBackground source={{ uri: bgUri }} style={card.container} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[card.container, card.darkBg]}>
      {content}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function CompleteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sets, duration } = route.params;
  const insets = useSafeAreaInsets();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [showStory, setShowStory] = useState(false);
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    (async () => {
      const s = await getLastSessionSummary();
      setSummary(s);
    })();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const durationLabel = `${Math.floor(duration / 60)}'${String(duration % 60).padStart(2, '0')}"`;

  // 写真を選ぶ
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets[0]) {
      setBgUri(result.assets[0].uri);
    }
  };

  // シェア画像として保存・共有
  const handleShare = async () => {
    if (!viewShotRef.current) return;
    setSaving(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'トレーニング記録をシェア',
        });
      } else {
        await Share.share({ url: uri });
      }
    } catch (_) {}
    setSaving(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.finishedSmall}>FINISHED</Text>
            <Text style={styles.workoutBig}>WORKOUT</Text>
          </View>
          {summary?.hasPB && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbBadgeText}>NEW RECORD</Text>
            </View>
          )}
        </View>

        {/* ── STATS ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{sets}</Text>
            <Text style={styles.statLabel}>SETS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{durationLabel}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          {summary && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{BODY_PART_EN[summary.bodyPart]}</Text>
                <Text style={styles.statLabel}>BODY PART</Text>
              </View>
            </>
          )}
        </View>

        {/* ── EXERCISE LIST ── */}
        {summary && summary.exercises.length > 0 && (
          <View style={styles.exSection}>
            {summary.exercises.map((ex, i) => (
              <View key={i} style={styles.exRow}>
                <View style={styles.exLeft}>
                  <View style={styles.exIndex}>
                    <Text style={styles.exIndexText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.exName}>{ex.name}</Text>
                </View>
                <View style={styles.exRight}>
                  <Text style={styles.exSets}>{ex.setsLabel}</Text>
                  {ex.isNewPB && <View style={styles.exPbBadge}><Text style={styles.exPbText}>PB</Text></View>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── ACTIONS ── */}
        <View style={styles.actions}>
          {/* シェア */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => setShowStory(true)}
            activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>Share Story</Text>
          </TouchableOpacity>

          {/* ホームに戻る */}
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => navigation.replace('MainTabs')}
            activeOpacity={0.85}>
            <Text style={styles.homeBtnText}>ホームに戻る</Text>
          </TouchableOpacity>

          {/* 続けてトレーニング */}
          <TouchableOpacity
            style={styles.againBtn}
            onPress={() => navigation.replace('Select')}
            activeOpacity={0.85}>
            <Text style={styles.againBtnText}>続けてトレーニング</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>

      {/* ── STORY MODAL ── */}
      <Modal
        visible={showStory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStory(false)}>
        <View style={modal.container}>

          {/* ヘッダー */}
          <View style={modal.header}>
            <TouchableOpacity onPress={() => setShowStory(false)}>
              <Text style={modal.closeText}>× 閉じる</Text>
            </TouchableOpacity>
            <Text style={modal.title}>Story Card</Text>
            <TouchableOpacity onPress={pickPhoto}>
              <Text style={modal.photoText}>写真を選ぶ</Text>
            </TouchableOpacity>
          </View>

          {/* プレビュー */}
          <ScrollView contentContainerStyle={modal.scroll} showsVerticalScrollIndicator={false}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1.0 }}
              style={modal.shotWrap}>
              <StoryCard
                summary={summary}
                sets={sets}
                duration={duration}
                bgUri={bgUri}
              />
            </ViewShot>

            <Text style={modal.hint}>
              {bgUri ? '写真が背景に設定されています' : '「写真を選ぶ」で背景を設定できます'}
            </Text>
          </ScrollView>

          {/* シェアボタン */}
          <View style={modal.footer}>
            <TouchableOpacity
              style={[modal.shareBtn, saving && modal.shareBtnDim]}
              onPress={handleShare}
              disabled={saving}
              activeOpacity={0.85}>
              <Text style={modal.shareBtnText}>
                {saving ? '処理中...' : '画像をシェア'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </Modal>
    </View>
  );
}

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  content: { flex: 1, justifyContent: 'space-between', paddingTop: 24 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  finishedSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.green,
    letterSpacing: 5,
  },
  workoutBig: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -1,
    lineHeight: 56,
  },
  pbBadge: {
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  pbBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFD700', letterSpacing: 2 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  statLabel: { fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#1F1F1F' },

  // Exercise list
  exSection: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  exLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  exIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exIndexText: { fontSize: 10, color: '#555', fontWeight: '700' },
  exName: { fontSize: 14, fontWeight: '600', color: colors.white, flex: 1 },
  exRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exSets: { fontSize: 12, color: '#555' },
  exPbBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  exPbText: { fontSize: 8, fontWeight: '800', color: '#FFD700' },

  // Actions
  actions: { gap: 10 },
  shareBtn: {
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  homeBtn: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  againBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  againBtnText: { fontSize: 13, color: '#444', fontWeight: '600' },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  closeText: { fontSize: 14, color: '#555', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.white },
  photoText: { fontSize: 14, color: colors.green, fontWeight: '700' },
  scroll: { alignItems: 'center', paddingVertical: 24 },
  shotWrap: {
    width: 300,
    height: 533, // 9:16
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  hint: {
    fontSize: 12,
    color: '#555',
    marginTop: 14,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  shareBtn: {
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  shareBtnDim: { opacity: 0.5 },
  shareBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
});

// ── Story Card styles ─────────────────────────────────────────────────────────
const card = StyleSheet.create({
  container: { width: 300, height: 533 },
  darkBg: { backgroundColor: '#111' },
  inner: { flex: 1, padding: 22, justifyContent: 'space-between' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  // Top
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  appName: {
    fontSize: 10,
    fontWeight: '300',
    color: '#C8FF00',
    letterSpacing: 5,
  },
  date: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
  },
  // Center
  center: { alignItems: 'flex-start', zIndex: 1 },
  bpLabel: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 4,
    marginBottom: 8,
  },
  finishedWorkout: {
    fontSize: 30,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 3,
    lineHeight: 38,
  },
  // Bottom
  bottom: { zIndex: 1 },
  exList: { marginBottom: 16, gap: 5 },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exName: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.75)',
    flex: 1,
  },
  exSets: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 8,
  },
  pbBadge: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: 6,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: {
    fontSize: 16,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 1,
  },
  statUnit: {
    fontSize: 8,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3,
    marginTop: 3,
  },
  statDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.2)' },
});
