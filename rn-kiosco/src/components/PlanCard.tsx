import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../theme';
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
        <View style={styles.iconCircle}>
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
            <Text style={styles.badgeText}>{meta.badge}</Text>
          </View>
        )}

        <Text style={styles.arrow}>→</Text>
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
    gap: 20,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.circle,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '600',
    color: colors.white,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.terracota,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  arrow: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.85)',
  },
});

export default PlanCard;