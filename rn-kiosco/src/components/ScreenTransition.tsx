import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { EASE_OUT_EXPO } from '../lib/anims';

type Props = {
  screenKey: string;
  direction?: 'forward' | 'back';
  children: React.ReactNode;
};

export default function ScreenTransition({ screenKey, direction = 'forward', children }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(direction === 'back' ? -40 : 40)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(direction === 'back' ? -40 : 40);
    scale.setValue(0.985);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, easing: EASE_OUT_EXPO, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 420, easing: EASE_OUT_EXPO, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 420, easing: EASE_OUT_EXPO, useNativeDriver: true }),
    ]).start();
  }, [screenKey, direction, fade, slide, scale]);

  return (
    <Animated.View style={[s.stage, { opacity: fade, transform: [{ translateX: slide }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stage: {
    flex: 1,
  },
});
