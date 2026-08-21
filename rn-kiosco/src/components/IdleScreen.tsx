import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

type Props = {
  onWake?: () => void;
};

function IdleScreen({ onWake }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    return () => {
      fade.setValue(0);
    };
  }, [fade]);

  const handleTouch = () => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onWake?.();
    });
  };

  return (
    <Animated.View
      style={[
        styles.screen,
        { opacity: fade },
      ]}
      onTouchStart={handleTouch}
      pointerEvents="box-none"
    >
      <View style={styles.content}>
        <Text style={styles.welcomeLabel}>BIENVENIDO</Text>
        <Text style={styles.wordmark}>Hotel del Valle</Text>
        <View style={styles.divider} />
        <Text style={styles.hint}>Toca en cualquier lugar para comenzar</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  welcomeLabel: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.label,
    color: colors.brandAccent,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: sizes.idleTitle,
    fontWeight: '400',
    color: colors.brandCream,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.brandAccent,
    marginBottom: spacing.xl,
  },
  hint: {
    fontFamily: typography.sans,
    fontSize: sizes.idleHint,
    color: colors.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

export default IdleScreen;