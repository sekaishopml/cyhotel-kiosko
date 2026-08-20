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

  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.card, isHero ? styles.cardHero : isSuite ? styles.cardSuite : styles.cardDark]}
      >
        {meta.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{meta.badge}</Text>
          </View>
        )}
        <View style={styles.row}>
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
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.planCard,
    padding: 24,
    overflow: 'hidden',
  },
  cardHero: {
    backgroundColor: colors.verde900,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardDark: {
    backgroundColor: colors.ink,
  },
  cardSuite: {
    backgroundColor: '#0D0D0D',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 16,
    backgroundColor: colors.verde500,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: sizes.badge,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: sizes.planIcon,
    height: sizes.planIcon,
    borderRadius: radii.circle,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  texts: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: sizes.planName,
    fontWeight: '600',
    color: colors.white,
    lineHeight: sizes.planName * 1.15,
  },
  subtitle: {
    fontSize: sizes.planSubtitle,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
});

export default PlanCard;