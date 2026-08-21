import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import ServiceCard from '../components/ServiceCard';

type Props = { onSelectPlan: (key: string) => void };

const PLANS = [
  { key: 'momento', title: 'Momento', subtitle: 'Por horas, sin complicaciones', featured: true },
  { key: 'amanecida', title: 'Amanecida', subtitle: 'Desde la tarde hasta la mañana' },
  { key: 'hospedaje', title: 'Hospedaje', subtitle: 'Estadía por noches' },
  { key: 'suite', title: 'Suite Jacuzzi', subtitle: 'Noche de lujo' },
];

export default function HomeScreen({ onSelectPlan }: Props) {
  return (
    <View style={s.root}>
      <View style={s.col}>
        {PLANS.map((p, i) => (
          <View key={p.key} style={s.cell}>
            <ServiceCard title={p.title} subtitle={p.subtitle} featured={p.featured} delay={i * 80} onPress={() => onSelectPlan(p.key)} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.screen,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  col: { flex: 1, gap: spacing.gap },
  cell: { flex: 1 },
});
