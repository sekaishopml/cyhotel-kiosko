import { Animated, Easing } from 'react-native';

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function fadeInDown(delay = 0, distance = 20) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration: 450,
    delay,
    easing: EASE,
    useNativeDriver: true,
  }).start();
  return {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };
}

export function fadeIn(delay = 0, duration = 350) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE,
    useNativeDriver: true,
  }).start();
  return { opacity: anim };
}

export function zoomIn(delay = 0, duration = 300) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE,
    useNativeDriver: true,
  }).start();
  return {
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };
}

export function slideUp(delay = 0, distance = 80, duration = 350) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE,
    useNativeDriver: true,
  }).start();
  return {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };
}

export function scaleOnPress(to = 0.95) {
  const anim = new Animated.Value(1);
  const pressIn = () => {
    Animated.spring(anim, {
      toValue: to,
      stiffness: 400,
      damping: 17,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(anim, {
      toValue: 1,
      stiffness: 400,
      damping: 17,
      useNativeDriver: true,
    }).start();
  };
  return {
    style: { transform: [{ scale: anim }] },
    pressIn,
    pressOut,
  };
}