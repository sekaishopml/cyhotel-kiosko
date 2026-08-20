import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, sizes, radii } from '../theme';
import { PLAN_META } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = {
  planKey: string;
  onPress: () => void;
};

function PlanCard({ planKey, onPress }: Props) {
  const meta = PLAN_META[planKey];
  const press = scaleOnPress();

  const isHero = meta.hero;
  const isSuite = planKey === 'suite';
  const isDawn = planKey === 'amanecida';

  const bg = isHero ? colors.verde900 : isSuite ? '#0B0B0B' : isDawn ? colors.verde700 : colors.verde600;

  return (
    <Animated.View style={[styles.wrap, press.style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.card, { backgroundColor: bg }]}
      >
        {meta.badge && (
          <View style={[styles.badge, isDawn && styles.badgeDawn]}>
            <Text style={styles.badgeText}>{meta.badge}</Text>
          </View>
        )}

        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{meta.icon}</Text>
          </View>
        </View>

        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {meta.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {meta.subtitle}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Text style={styles.cta}>Elegir</Text>
          <Text style={styles.arrow}>→</Text>
        </View>
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
    padding: 26,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 18,
    right: 18,
    backgroundColor: colors.terracota,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDawn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  badgeText: {
    color: colors.white,
    fontSize: sizes.badge,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconRing: {
    width: sizes.planIcon + 16,
    height: sizes.planIcon + 16,
    borderRadius: radii.circle,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  iconCircle: {
    width: sizes.planIcon,
    height: sizes.planIcon,
    borderRadius: radii.circle,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 30,
  },
  texts: {
    marginTop: 20,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: sizes.planName,
    fontWeight: '600',
    color: colors.white,
    lineHeight: sizes.planName * 1.1,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cta: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.9)',
  },
  arrow: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.85)',
  },
});

export default PlanCard;