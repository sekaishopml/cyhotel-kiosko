import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
  featured?: boolean;
  delay?: number;
};

export default function ServiceCard({ title, subtitle, onPress, featured, delay = 0 }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: true,
    }).start();
  }, [enter, delay]);

  const onIn = () => Animated.spring(press, { toValue: 0.97, stiffness: 400, damping: 17, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, stiffness: 400, damping: 17, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: press }] }, s.wrap, featured && s.featured]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={s.touch} accessibilityLabel={`${title}: ${subtitle}`}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>
        {featured ? <Text style={s.badge}>Lo más pedido</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radii.card,
    backgroundColor: colors.brandPrimary,
    overflow: 'hidden',
    minHeight: 96,
  },
  featured: {
    borderWidth: 2,
    borderColor: colors.brandAccent,
  },
  touch: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: sizes.cardTitle,
    color: colors.brandCream,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: typography.sans,
    fontSize: sizes.cardSubtitle,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 19,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    fontFamily: typography.sansMedium,
    fontSize: sizes.label,
    color: colors.brandAccent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
