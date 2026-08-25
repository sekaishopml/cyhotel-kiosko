import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';
import { usePulse } from '../lib/anims';

export default function LoadingScreen() {
  const pulse = usePulse(1500);
  return (
    <View style={s.root}>
      <View style={s.center}>
        <AnimatedRing pulse={pulse} />
        <Text style={s.text}>Cargando…</Text>
      </View>
    </View>
  );
}

function AnimatedRing({ pulse }: { pulse: { opacity: any; transform: any } }) {
  return (
    <View style={s.ringWrap}>
      <Animated.View style={[s.ring, pulse]}>
        <View style={s.emblem}>
          <Text style={s.emblemTxt}>HV</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  ringWrap: {
    marginBottom: spacing.lg,
  },
  ring: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemTxt: {
    fontFamily: typography.displayBold,
    fontSize: 32,
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: sizes.tagline,
    color: colors.textLight,
    letterSpacing: 3,
  },
});
