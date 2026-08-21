import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

function Block({ h }: { h: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [x]);
  return (
    <View style={[s.block, { height: h }]}>
      <Animated.View style={[s.mask, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-320, 320] }) }] }]} />
    </View>
  );
}

export default function Shimmer() {
  return (
    <View style={s.root}>
      <Block h={96} />
      <Block h={96} />
      <Block h={96} />
      <Block h={96} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, gap: spacing.gap },
  block: { borderRadius: radii.card, backgroundColor: colors.border, overflow: 'hidden' },
  mask: { width: 140, height: '100%', backgroundColor: 'rgba(201,161,90,0.15)' },
});
