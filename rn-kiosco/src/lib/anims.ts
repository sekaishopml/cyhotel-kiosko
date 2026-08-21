import { Animated, Easing } from 'react-native';

// Curvas elegantes para transiciones suaves
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);    // Suave salida
export const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1); // Suave entrada/salida
export const EASE_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1); // Con rebote sutil

// Fade + slide down (entrada elegante)
export function fadeInDown(delay = 0, distance = 24) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration: 500,
    delay,
    easing: EASE_OUT,
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

// Fade simple con timing suave
export function fadeIn(delay = 0, duration = 400) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE_OUT,
    useNativeDriver: true,
  }).start();
  return { opacity: anim };
}

// Zoom + fade (entrada con escala)
export function zoomIn(delay = 0, duration = 350) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE_SPRING,
    useNativeDriver: true,
  }).start();
  return {
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        }),
      },
    ],
  };
}

// Slide up (bottom → top, elegante)
export function slideUp(delay = 0, distance = 60, duration = 400) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: EASE_OUT,
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

// Slide from right (navegación前进)
export function slideFromRight(delay = 0) {
  const anim = new Animated.Value(0);
  Animated.timing(anim, {
    toValue: 1,
    duration: 400,
    delay,
    easing: EASE_OUT,
    useNativeDriver: true,
  }).start();
  return {
    opacity: anim,
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [60, 0],
        }),
      },
    ],
  };
}

// Scale on press (respuesta táctil)
export function scaleOnPress(to = 0.96) {
  const anim = new Animated.Value(1);
  const pressIn = () => {
    Animated.spring(anim, {
      toValue: to,
      stiffness: 350,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(anim, {
      toValue: 1,
      stiffness: 350,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };
  return {
    style: { transform: [{ scale: anim }] },
    pressIn,
    pressOut,
  };
}

// Stagger entrance (entrada escalonada para listas)
export function staggerEntrance(count: number, staggerMs = 80) {
  return Array.from({ length: count }, (_, i) => fadeInDown(i * staggerMs));
}
