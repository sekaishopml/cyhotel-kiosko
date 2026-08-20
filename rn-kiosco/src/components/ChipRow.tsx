import React from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, typography } from '../theme';
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

function ChipRow({ planKey, room, selectedExtra, selectedDays, onSelectExtra, onSelectDays }: Props) {
  if (planKey === 'hospedaje') {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Cantidad de noches</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map(days => {
            const total = (room.price ?? 0) * days;
            const selected = selectedDays === days;
            return (
              <Chip
                key={days}
                label={`${days} noche${days > 1 ? 's' : ''} · $${total}`}
                selected={selected}
                onPress={() => onSelectDays(days)}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const extras = Object.entries(room.extras ?? {});
  if (extras.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Duración</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {extras.map(([key, extra]) => (
          <Chip
            key={key}
            label={`${extra.label} · $${extra.price}`}
            selected={selectedExtra === key}
            onPress={() => onSelectExtra(selectedExtra === key ? null : key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const press = scaleOnPress();

  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.chip, selected && styles.chipSelected]}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brandPrimary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(20,58,42,0.2)',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chipSelected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.white,
  },
});

export default ChipRow;