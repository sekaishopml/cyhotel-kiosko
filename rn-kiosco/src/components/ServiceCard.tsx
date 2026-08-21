import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
  featured?: boolean;
  delay?: number;
};

function ServiceCard({ title, subtitle, onPress, featured = false, delay = 0 }: Props) {
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
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: press },
          ],
        },
        styles.wrap,
        featured && styles.featured,
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
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        {featured ? (
          <Text style={styles.featuredLabel}>Lo más pedido</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radii.card,
    backgroundColor: colors.brandPrimary,
    overflow: 'hidden',
    minHeight: 88,
  },
  featured: {
    borderWidth: 2,
    borderColor: colors.brandAccent,
  },
  touch: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 4,
  },
  content: {
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.serif,
    fontSize: sizes.cardTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: typography.sans,
    fontSize: sizes.cardSubtitle,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  featuredLabel: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    fontFamily: typography.sans,
    fontSize: sizes.microLabel,
    color: colors.brandAccent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

export default ServiceCard;
