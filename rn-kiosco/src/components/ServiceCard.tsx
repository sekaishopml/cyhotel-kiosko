import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radii, sizes, spacing, typography } from '../theme';
import { EASE_OUT } from '../lib/anims';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
  featured?: boolean;
  dark?: boolean;
  accent?: boolean;
  delay?: number;
};

export default function ServiceCard({ title, subtitle, onPress, featured, dark, accent, delay = 0 }: Props) {
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
  const subTxtColor = isAccent ? 'rgba(244,238,226,0.7)' : 'rgba(244,238,226,0.5)';

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
    ]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={s.touch} accessibilityLabel={`${title}: ${subtitle}`}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.gradient}
        >
          <Text style={[s.title, { color: txtColor }]} numberOfLines={1}>{title.toUpperCase()}</Text>
          <Text style={[s.subtitle, { color: subTxtColor }]} numberOfLines={1}>{subtitle}</Text>
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
  touch: {
    borderRadius: radii.card,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 6 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
    }),
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 38,
    borderRadius: radii.card,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: sizes.cardTitle,
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.cardSubtitle,
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
