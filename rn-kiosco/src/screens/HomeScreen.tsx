import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';
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
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <View style={s.top}>
        <Text style={s.label}>ELEGÍ TU PLAN</Text>
        <Text style={s.heading}>¿Qué necesitás hoy?</Text>
      </View>
      <View style={s.grid}>
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
    paddingVertical: spacing.lg,
  },
  watermark: {
    position: 'absolute',
    bottom: 40,
    right: -10,
    opacity: 0.04,
    pointerEvents: 'none',
  },
  watermarkTxt: {
    fontFamily: typography.serifBold,
    fontSize: 180,
    color: colors.brandPrimary,
    fontWeight: '700',
    letterSpacing: -8,
  },
  top: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.label,
    color: colors.brandAccent,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heading: {
    fontFamily: typography.serifBold,
    fontSize: 26,
    color: colors.brandPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  grid: {
    gap: spacing.md,
    flex: 1,
  },
  cell: {
    flex: 1,
  },
});
