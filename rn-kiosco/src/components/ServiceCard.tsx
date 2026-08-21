import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography, overlayGradient } from '../theme';
import Badge from './Badge';

export type ServiceImage = number;

type Props = {
  image: ServiceImage;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
  hero?: boolean;
  delay?: number;
  targetHeight?: number;
};

function ServiceCard({ image, title, subtitle, onPress, badge, hero = false, delay = 0, targetHeight }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }, [enter, delay]);

  const pressIn = () => {
    Animated.spring(press, {
      toValue: 0.97,
      stiffness: 420,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(press, {
      toValue: 1,
      stiffness: 420,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: press }] },
        hero ? styles.heroWrap : styles.wrap,
        targetHeight ? { height: targetHeight } : null,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${subtitle}`}
        style={styles.touch}
      >
        <Image source={image} style={styles.image} resizeMode="cover" />
        <View style={styles.overlay}>
          {overlayGradient.layers.map((l, i) => (
            <View key={i} style={{ flex: l.heightPct, backgroundColor: l.color }} />
          ))}
        </View>
        {badge ? (
          <View style={styles.badgePos}>
            <Badge label={badge} />
          </View>
        ) : null}
        <View style={styles.texts}>
          <Text style={[styles.title, hero && styles.titleHero]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, hero && styles.subtitleHero]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.chevron, hero && styles.chevronHero]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    minHeight: 88,
  },
  heroWrap: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  touch: {
    flex: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  badgePos: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  texts: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: sizes.cardTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  titleHero: {
    fontSize: sizes.heroTitle,
  },
  subtitle: {
    fontFamily: typography.sans,
    fontSize: sizes.cardSubtitle,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  subtitleHero: {
    fontSize: sizes.cardSubtitle,
  },
  chevron: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -20,
    fontSize: 40,
    color: colors.textMuted,
    fontWeight: '300',
  },
  chevronHero: {
    fontSize: 52,
    marginTop: -26,
  },
});

export default ServiceCard;