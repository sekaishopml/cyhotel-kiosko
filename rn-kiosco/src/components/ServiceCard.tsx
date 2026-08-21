import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

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
    Animated.timing(enter, { toValue: 1, duration: 350, delay, useNativeDriver: true }).start();
  }, [enter, delay]);

  const onIn = () => Animated.spring(press, { toValue: 0.96, stiffness: 350, damping: 16, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, stiffness: 350, damping: 16, useNativeDriver: true }).start();

  const bgColor = accent ? colors.brandAccent : colors.brandPrimary;
  const txtColor = accent ? colors.brandPrimary : colors.brandCream;

  return (
    <Animated.View style={[{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: press }] }, s.wrap, { backgroundColor: bgColor }, featured && s.featured]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={s.touch} accessibilityLabel={`${title}: ${subtitle}`}>
        <Text style={[s.title, { color: txtColor }]} numberOfLines={1}>{title.toUpperCase()}</Text>
        <Text style={[s.subtitle, { color: accent ? 'rgba(27,46,34,0.5)' : 'rgba(244,238,226,0.6)' }]} numberOfLines={1}>{subtitle}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: radii.card,
  },
  featured: {
    borderWidth: 2,
    borderColor: colors.brandAccent,
  },
  touch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 34,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: 34,
    letterSpacing: 2,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansMedium,
    fontSize: 17,
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
