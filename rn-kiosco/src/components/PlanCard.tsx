import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, sizes, radii, shadows } from '../theme';
import { PLAN_META } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = {
  planKey: string;
  onPress: () => void;
};

function PlanCard({ planKey, onPress }: Props) {
  const meta = PLAN_META[planKey];
  const press = scaleOnPress(0.97);

  const isHero = meta.hero;
  const isSuite = planKey === 'suite';
  const isDawn = planKey === 'amanecida';

  const bg = isHero ? colors.primary : isSuite ? '#0B0B0B' : isDawn ? colors.verde700 : colors.verde600;

  return (
    <Animated.View style={[styles.wrap, press.style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.card, { backgroundColor: bg }, shadows.card]}
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar plan ${meta.name}: ${meta.subtitle}`}
        accessibilityHint="Presiona para continuar"
      >
        <View style={[styles.iconCircle, { borderColor: colors.inkMuted }]}>
          <Text style={styles.icon}>{meta.icon}</Text>
        </View>

        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {meta.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {meta.subtitle}
          </Text>
        </View>

        {meta.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Lo más pedido</Text>
          </View>
        )}

        <Text style={[styles.arrow, { color: colors.inkMuted }]}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    flex: 1,
    borderRadius: radii.planCard,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    overflow: 'hidden',
  },
  iconCircle: {
    width: sizes.ring,
    height: sizes.ring,
    borderRadius: radii.circle,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: sizes.planIcon - 20,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: sizes.planName,
    fontWeight: '600',
    letterSpacing: 0.8,
    lineHeight: 26,
    color: colors.onPrimary,
  },
  subtitle: {
    fontSize: sizes.subtitle,
    fontWeight: '400',
    letterSpacing: 0.8,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radii.badge,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: sizes.micro,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  arrow: {
    fontSize: sizes.arrow - 12,
    fontWeight: '600',
  },
});

export default PlanCard;