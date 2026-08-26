import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radii, spacing, typography } from '../theme';
import { EASE_OUT } from '../lib/anims';
import FitText from './FitText';

type Props = {
  title: string;
  onPress: () => void;
  featured?: boolean;
  dark?: boolean;
  accent?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ServiceCard({ title, onPress, featured, dark, accent, delay = 0, style }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 500, delay, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [enter, delay]);

  const onIn = () => {
    Animated.spring(press, { toValue: 0.96, stiffness: 400, damping: 22, useNativeDriver: true }).start();
  };

  const onOut = () => {
    Animated.spring(press, { toValue: 1, stiffness: 300, damping: 18, useNativeDriver: true }).start();
  };

  const isAccent = accent;
  const isDark = dark;

  const gradientColors = isAccent
    ? ['#B89540', '#8C6F2A']
    : isDark
    ? ['#1A1A1A', '#0D0D0D']
    : ['#1F3A2C', colors.brandPrimary];

  const txtColor = colors.brandCream;

  return (
    <Animated.View style={[
      {
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
          { scale: press },
        ],
      },
      featured && s.featured,
      style,
    ]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={s.touch} accessibilityLabel={title}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.gradient}
        >
          <FitText text={title} style={[s.title, { color: txtColor }]} fill={0.92} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  featured: {
    borderWidth: 2,
    borderColor: colors.brandAccent,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
  },
  touch: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 6 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
    }),
  },
  title: {
    fontFamily: typography.serifBold,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
