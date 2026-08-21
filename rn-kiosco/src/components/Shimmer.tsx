import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

function ShimmerBlock({ height }: { height: number }) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <View style={[styles.block, { height }]}>
      <Animated.View
        style={[
          styles.mask,
          {
            transform: [
              {
                translateX: x.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-320, 320],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function Shimmer() {
  return (
    <View style={styles.container}>
      <ShimmerBlock height={120} />
      <ShimmerBlock height={96} />
      <ShimmerBlock height={96} />
      <ShimmerBlock height={96} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    gap: spacing.gap,
  },
  block: {
    borderRadius: radii.card,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  mask: {
    width: 140,
    height: '100%',
    backgroundColor: colors.brandAccent,
  },
});

export default Shimmer;