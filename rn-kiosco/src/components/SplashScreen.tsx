import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { EASE_OUT, EASE_SPRING } from '../lib/anims';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const subFade = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fase 1: Logo aparece con spring
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, stiffness: 100, damping: 12, useNativeDriver: true }),
    ]).start();

    // Fase 2: Título aparece (después de 300ms)
    Animated.parallel([
      Animated.timing(titleFade, { toValue: 1, duration: 500, delay: 300, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 500, delay: 300, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();

    // Fase 3: Divisor se expande (después de 600ms)
    Animated.timing(dividerWidth, { toValue: 1, duration: 400, delay: 600, easing: EASE_OUT, useNativeDriver: false }).start();

    // Fase 4: Subtítulo aparece (después de 800ms)
    Animated.timing(subFade, { toValue: 1, duration: 400, delay: 800, easing: EASE_OUT, useNativeDriver: true }).start();

    // Fase 5: Barra de progreso (después de 1000ms)
    Animated.timing(barWidth, { toValue: 1, duration: 1500, delay: 1000, easing: EASE_OUT, useNativeDriver: false }).start(() => {
      // Fase 6: Salida suave
      Animated.timing(exitFade, { toValue: 0, duration: 400, easing: EASE_OUT, useNativeDriver: true }).start(() => onFinish());
    });
  }, [fade, logoScale, titleFade, titleSlide, dividerWidth, subFade, barWidth, exitFade, onFinish]);

  return (
    <Animated.View style={[s.root, { opacity: exitFade }]}>
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <Animated.View style={[s.content, { opacity: fade }]}>
        <Animated.View style={[s.logoBox, { transform: [{ scale: logoScale }] }]}>
          <Text style={s.logoTxt}>HV</Text>
        </Animated.View>
        <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleSlide }] }}>
          <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        </Animated.View>
        <Animated.View style={[s.divider, { width: dividerWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }]} />
        <Animated.View style={{ opacity: subFade }}>
          <Text style={s.sub}>SISTEMA DE RESERVAS</Text>
        </Animated.View>
      </Animated.View>
      <View style={s.barWrap}>
        <Animated.View style={[s.bar, { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermark: {
    position: 'absolute',
    bottom: 50,
    right: -10,
    opacity: 0.05,
    pointerEvents: 'none',
  },
  watermarkTxt: {
    fontFamily: typography.serifBold,
    fontSize: 200,
    color: colors.brandCream,
    letterSpacing: -8,
  },
  content: {
    alignItems: 'center',
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoTxt: {
    fontFamily: typography.serifBold,
    fontSize: 28,
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  wordmark: {
    fontFamily: typography.serifBold,
    fontSize: 26,
    color: colors.brandCream,
    letterSpacing: 3,
    textAlign: 'center',
  },
  divider: {
    height: 2,
    backgroundColor: colors.brandAccent,
    marginVertical: spacing.lg,
  },
  sub: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.textLight,
    letterSpacing: 3,
  },
  barWrap: {
    position: 'absolute',
    bottom: 60,
    width: 120,
    height: 2,
    backgroundColor: 'rgba(244,238,226,0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: colors.brandAccent,
    borderRadius: 1,
  },
});
