import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, sizes, spacing, typography } from '../theme';
import { EASE_OUT, EASE_OUT_EXPO, useFill } from '../lib/anims';

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(24)).current;
  const subFade = useRef(new Animated.Value(0)).current;
  const barFill = useFill(1500, 900);
  const exitFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, stiffness: 90, damping: 14, useNativeDriver: true }),
      Animated.timing(logoRotate, { toValue: 1, duration: 900, easing: EASE_OUT_EXPO, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(titleFade, { toValue: 1, duration: 600, delay: 350, easing: EASE_OUT_EXPO, useNativeDriver: true }),
      Animated.timing(titleSlide, { toValue: 0, duration: 600, delay: 350, easing: EASE_OUT_EXPO, useNativeDriver: true }),
    ]).start();

    Animated.timing(subFade, { toValue: 1, duration: 500, delay: 750, easing: EASE_OUT, useNativeDriver: true }).start();

    Animated.timing(exitFade, { toValue: 0, duration: 450, delay: 2500, easing: EASE_OUT, useNativeDriver: true }).start(() => onFinish());
  }, [fade, logoScale, logoRotate, titleFade, titleSlide, subFade, exitFade, onFinish]);

  return (
    <Animated.View style={[s.root, { opacity: exitFade }]}>
      <LinearGradient colors={['#1B2E22', '#11201A', '#0C1712']} style={StyleSheet.absoluteFillObject} />
      <View style={s.watermark}>
        <Text style={s.watermarkTxt}>HV</Text>
      </View>
      <Animated.View style={[s.content, { opacity: fade }]}>
        <Animated.View style={[s.ring, { transform: [{ scale: logoScale }, { rotate: logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }]}>
          <View style={s.emblem}>
            <Text style={s.emblemTxt}>HV</Text>
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleSlide }] }}>
          <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
        </Animated.View>
        <Animated.View style={[s.divider, { opacity: titleFade }]}>
          <View style={s.dividerLine} />
        </Animated.View>
        <Animated.View style={{ opacity: subFade }}>
          <Text style={s.sub}>SISTEMA DE RESERVAS</Text>
        </Animated.View>
      </Animated.View>
      <View style={s.barWrap}>
        <View style={s.barTrack}>
          <Animated.View style={[s.barFill, barFill]} />
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermark: {
    position: 'absolute',
    top: -40,
    left: -30,
    opacity: 0.04,
    pointerEvents: 'none',
  },
  watermarkTxt: {
    fontFamily: typography.display,
    fontSize: 320,
    color: colors.brandCream,
    letterSpacing: -10,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  ring: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emblem: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemTxt: {
    fontFamily: typography.displayBold,
    fontSize: 40,
    color: colors.brandPrimary,
    letterSpacing: 1,
  },
  wordmark: {
    fontFamily: typography.displayBold,
    fontSize: sizes.splashTitle,
    color: colors.brandCream,
    letterSpacing: 4,
    textAlign: 'center',
  },
  divider: {
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  dividerLine: {
    width: 56,
    height: 2,
    backgroundColor: colors.brandAccent,
  },
  sub: {
    fontFamily: typography.uiMedium,
    fontSize: sizes.splashSub,
    color: colors.textLight,
    letterSpacing: 5,
  },
  barWrap: {
    position: 'absolute',
    bottom: 64,
    width: 180,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(244,238,226,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.brandAccent,
    borderRadius: 2,
  },
});
