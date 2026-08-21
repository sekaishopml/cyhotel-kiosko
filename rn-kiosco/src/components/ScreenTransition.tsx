import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { EASE_OUT } from '../lib/anims';

type Props = {
  screenKey: string;
  children: React.ReactNode;
};

export default function ScreenTransition({ screenKey, children }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(30);
    scale.setValue(0.98);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 400, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
  }, [screenKey, fade, slide, scale]);

  return (
    <Animated.View style={[s.stage, { opacity: fade, transform: [{ translateY: slide }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stage: {
    flex: 1,
  },
});
