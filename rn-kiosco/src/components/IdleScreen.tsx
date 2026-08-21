import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';
import { EASE_OUT } from '../lib/anims';

type Props = { onWake?: () => void };

export default function IdleScreen({ onWake }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(16)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const hintFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.spring(logoScale, { toValue: 1, stiffness: 80, damping: 12, delay: 200, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(titleFade, { toValue: 1, duration: 500, delay: 400, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 500, delay: 400, easing: EASE_OUT, useNativeDriver: true }),
    ]).start();
    Animated.timing(dividerWidth, { toValue: 1, duration: 400, delay: 700, easing: EASE_OUT, useNativeDriver: false }).start();
    Animated.timing(hintFade, { toValue: 1, duration: 400, delay: 900, easing: EASE_OUT, useNativeDriver: true }).start();
    return () => { fade.setValue(0); };
  }, [fade, logoScale, titleFade, titleSlide, dividerWidth, hintFade]);

  const touch = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 300, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 0.9, duration: 300, easing: EASE_OUT, useNativeDriver: true }),
    ]).start(() => onWake?.());
  };

  return (
    <Animated.View style={[s.root, { opacity: fade }]} onTouchStart={touch}>
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <Animated.View style={[s.content, { transform: [{ scale: logoScale }] }]}>
        <View style={s.logoBox}>
          <Text style={s.logoTxt}>HV</Text>
        </View>
        <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleSlide }] }}>
          <Text style={s.label}>BIENVENIDO</Text>
          <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        </Animated.View>
        <Animated.View style={[s.divider, { width: dividerWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }]} />
        <Animated.View style={{ opacity: hintFade }}>
          <Text style={s.hint}>TOCA PARA COMENZAR</Text>
        </Animated.View>
      </Animated.View>
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
    paddingHorizontal: spacing.xl,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoTxt: {
    fontFamily: typography.serifBold,
    fontSize: 24,
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.label,
    color: colors.brandAccent,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  wordmark: {
    fontFamily: typography.serifBold,
    fontSize: sizes.idleTitle,
    color: colors.brandCream,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  divider: {
    height: 2,
    backgroundColor: colors.brandAccent,
    marginBottom: spacing.xl,
  },
  hint: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.idleHint,
    color: 'rgba(244,238,226,0.4)',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
