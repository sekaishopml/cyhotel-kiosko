import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radii } from '../theme';

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
      <ShimmerBlock height={88} />
      <ShimmerBlock height={88} />
      <ShimmerBlock height={88} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  block: {
    borderRadius: radii.card,
    backgroundColor: 'rgba(244,238,226,0.12)',
    overflow: 'hidden',
  },
  mask: {
    width: 140,
    height: '100%',
    backgroundColor: 'rgba(244,238,226,0.16)',
  },
});

export default Shimmer;