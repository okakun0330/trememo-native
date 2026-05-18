import React from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { BodyPart, BODY_PART_EN, BODY_PART_LABELS } from '../lib/types';
import { colors, bodyColors } from '../lib/theme';
import { anatomyImages } from '../lib/images';
import { RootStackParamList } from '../lib/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BODY_PARTS: BodyPart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs', 'cardio'];

export default function SelectScreen() {
  const navigation = useNavigation<Nav>();

  const handleSelect = async (bp: BodyPart) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Session', { bodyPart: bp });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← ホーム</Text>
        </TouchableOpacity>
        <Text style={styles.title}>部位を選択</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {BODY_PARTS.map((bp, i) => {
          const isLast = i === BODY_PARTS.length - 1;
          const isOdd = BODY_PARTS.length % 2 !== 0;
          return (
            <TouchableOpacity
              key={bp}
              style={[
                styles.card,
                { borderColor: bodyColors[bp] + '44' },
                isLast && isOdd && styles.cardFull,
              ]}
              onPress={() => handleSelect(bp)}
              activeOpacity={0.75}>
              <Image source={anatomyImages[bp]} style={styles.img} resizeMode="contain" />
              <View style={[styles.dot, { backgroundColor: bodyColors[bp] }]} />
              <Text style={styles.label}>{BODY_PART_LABELS[bp]}</Text>
              <Text style={styles.labelEn}>{BODY_PART_EN[bp]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: colors.green, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: colors.white },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingTop: 16, paddingBottom: 40, gap: 12,
    justifyContent: 'center',
  },
  card: {
    width: '46%', backgroundColor: colors.card,
    borderWidth: 1, borderRadius: 20,
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12,
    gap: 8,
  },
  cardFull: { width: '96%' },
  img: { width: 80, height: 80 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  label: { fontSize: 18, fontWeight: '900', color: colors.white },
  labelEn: { fontSize: 10, color: colors.textMuted, letterSpacing: 2, fontWeight: '600' },
});
