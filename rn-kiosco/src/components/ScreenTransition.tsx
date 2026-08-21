import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
  screenKey: string;
  children: React.ReactNode;
  direction?: 'left' | 'right';
};

export default function ScreenTransition({ screenKey, children, direction = 'left' }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(direction === 'left' ? 40 : -40)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(direction === 'left' ? 40 : -40);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [screenKey, fade, slide, direction]);

  return (
    <Animated.View style={[s.stage, { opacity: fade, transform: [{ translateX: slide }] }]}>
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stage: {
    flex: 1,
  },
});
