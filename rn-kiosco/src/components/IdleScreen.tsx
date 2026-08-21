import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

type Props = { onWake?: () => void };

export default function IdleScreen({ onWake }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => { fade.setValue(0); };
  }, [fade]);

  const touch = () => {
    Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onWake?.());
  };

  return (
    <Animated.View style={[s.root, { opacity: fade }]} onTouchStart={touch}>
      <View style={s.content}>
        <Text style={s.label}>BIENVENIDO</Text>
        <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        <View style={s.divider} />
        <Text style={s.hint}>TOCA EN CUALQUIER LUGAR PARA COMENZAR</Text>
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
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.label,
    color: colors.brandAccent,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
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
    width: 48,
    height: 2,
    backgroundColor: colors.brandAccent,
    marginBottom: spacing.xl,
  },
  hint: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.idleHint,
    color: 'rgba(244,238,226,0.5)',
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
