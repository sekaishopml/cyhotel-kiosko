import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radii, sizes, typography } from '../theme';

type Props = {
  label: string;
  animated?: boolean;
};

function Badge({ label, animated = true }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, scale]);

  return (
    <Animated.View style={[styles.pill, { transform: [{ scale }] }]}>
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  text: {
    color: colors.brandPrimaryDeep,
    fontSize: sizes.microLabel,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: typography.sans,
  },
});

export default Badge;