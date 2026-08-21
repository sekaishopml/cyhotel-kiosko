import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, stiffness: 120, damping: 14, useNativeDriver: true }),
    ]).start();

    Animated.timing(barWidth, { toValue: 1, duration: 1800, useNativeDriver: false }).start(() => {
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onFinish());
    });
  }, [fade, scale, barWidth, onFinish]);

  return (
    <Animated.View style={[s.root, { opacity: fade }]}>
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <Animated.View style={[s.content, { transform: [{ scale }] }]}>
        <View style={s.logoBox}>
          <Text style={s.logoTxt}>HV</Text>
        </View>
        <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        <View style={s.divider} />
        <Text style={s.sub}>SISTEMA DE RESERVAS</Text>
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
    fontWeight: '700',
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
    width: 40,
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
