import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

type Props = { onWake?: () => void };

export default function IdleScreen({ onWake }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { fade.setValue(0); loop.stop(); };
  }, [fade, pulse]);

  const touch = () => {
    Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onWake?.());
  };

  return (
    <Animated.View style={[s.root, { opacity: fade }]} onTouchStart={touch}>
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <Animated.View style={[s.content, { transform: [{ scale: pulse }] }]}>
        <View style={s.logoBox}>
          <Text style={s.logoTxt}>HV</Text>
        </View>
        <Text style={s.label}>BIENVENIDO</Text>
        <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        <View style={s.divider} />
        <Text style={s.hint}>TOCA PARA COMENZAR</Text>
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
    width: 40,
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
