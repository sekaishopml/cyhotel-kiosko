import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';
import ServiceCard from '../components/ServiceCard';

type Props = { onSelectPlan: (key: string) => void };

const PLANS = [
  { key: 'momento', title: 'Momento', subtitle: 'Por horas, sin complicaciones', accent: true, featured: true },
  { key: 'amanecida', title: 'Amanecida', subtitle: 'Desde la tarde hasta la mañana' },
  { key: 'hospedaje', title: 'Hospedaje', subtitle: 'Estadía por noches' },
  { key: 'suite', title: 'Suite Jacuzzi', subtitle: 'Noche de lujo', dark: true },
];

export default function HomeScreen({ onSelectPlan }: Props) {
  return (
    <View style={s.root}>
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <View style={s.top}>
        <Text style={s.heading}>¿Qué necesitás hoy?</Text>
      </View>
      <View style={s.grid}>
        {PLANS.map((p, i) => (
          <ServiceCard key={p.key} title={p.title} subtitle={p.subtitle} featured={p.featured} accent={p.accent} dark={p.dark} delay={i * 100} onPress={() => onSelectPlan(p.key)} />
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
  watermark: {
    position: 'absolute',
    bottom: 40,
    right: -10,
    opacity: 0.03,
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
    marginBottom: spacing.md,
  },
  heading: {
    fontFamily: typography.serifBold,
    fontSize: 40,
    lineHeight: 46,
    color: colors.brandPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  grid: {
    flex: 1,
    gap: spacing.gap,
  },
});
