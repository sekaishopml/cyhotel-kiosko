import React from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, typography, sizes, spacing } from '../theme';
import type { RoomType } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = {
  planKey: string;
  room: RoomType;
  selectedExtra: string | null;
  selectedDays: number;
  onSelectExtra: (key: string | null) => void;
  onSelectDays: (days: number) => void;
};

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const press = scaleOnPress();
  return (
    <Animated.View style={[press.style, s.chipWrap]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={press.pressIn} onPressOut={press.pressOut} style={[s.chip, selected && s.chipSel]}>
        <Text style={[s.chipTxt, selected && s.chipTxtSel]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChipRow({ planKey, room, selectedExtra, selectedDays, onSelectExtra, onSelectDays }: Props) {
  if (planKey === 'hospedaje') {
    return (
      <View style={s.wrap}>
        <Text style={s.label}>NOCHES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map(d => (
            <Chip key={d} label={`${d} noche${d > 1 ? 's' : ''} · $${(room.price ?? 0) * d}`} selected={selectedDays === d} onPress={() => onSelectDays(d)} />
          ))}
        </ScrollView>
      </View>
    );
  }
  const extras = Object.entries(room.extras ?? {});
  if (extras.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.label}>DURACIÓN</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {extras.map(([k, e]) => (
          <Chip key={k} label={`${e.label} · $${e.price}`} selected={selectedExtra === k} onPress={() => onSelectExtra(selectedExtra === k ? null : k)} />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: spacing.md, paddingHorizontal: spacing.screen },
  label: {
    fontSize: sizes.label,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    letterSpacing: 1.5,
    fontFamily: typography.sansMedium,
  },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  chipWrap: {
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
    }),
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radii.chip,
    paddingHorizontal: 22,
    paddingVertical: 16,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSel: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipTxt: {
    fontSize: sizes.cardSubtitle,
    fontWeight: '600',
    color: colors.brandPrimary,
    fontFamily: typography.sansMedium,
  },
  chipTxtSel: {
    color: colors.brandCream,
  },
});
