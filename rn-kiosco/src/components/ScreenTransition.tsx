import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
  screenKey: string;
  children: React.ReactNode;
};

function ScreenTransition({ screenKey, children }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [screenKey, fade]);

  return <Animated.View style={[styles.stage, { opacity: fade }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
});

export default ScreenTransition;