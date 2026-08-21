import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { EASE_IN_OUT } from '../lib/anims';

function Block({ h, delay }: { h: number; delay: number }) {
  const x = useRef(new Animated.Value(-150)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 150, duration: 1600, delay, easing: EASE_IN_OUT, useNativeDriver: true }),
        Animated.timing(x, { toValue: -150, duration: 1600, easing: EASE_IN_OUT, useNativeDriver: true }),
      ])
    );
    l.start();
    return () => l.stop();
  }, [x, delay]);
  return (
    <View style={[s.block, { height: h }]}>
      <Animated.View style={[s.mask, { transform: [{ translateX: x }] }]} />
    </View>
  );
}

export default function Shimmer() {
  return (
    <View style={s.root}>
      <Block h={88} delay={0} />
      <Block h={88} delay={150} />
      <Block h={88} delay={300} />
      <Block h={88} delay={450} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, gap: spacing.gap },
  block: {
    borderRadius: radii.card,
    backgroundColor: 'rgba(27,46,34,0.05)',
    overflow: 'hidden',
  },
  mask: {
    width: 100,
    height: '100%',
    backgroundColor: 'rgba(160,125,58,0.12)',
  },
});
