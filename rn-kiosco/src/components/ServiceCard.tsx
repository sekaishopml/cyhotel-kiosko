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
    Animated.timing(enter, { toValue: 1, duration: 350, delay, useNativeDriver: true }).start();
  }, [enter, delay]);

  const onIn = () => Animated.spring(press, { toValue: 0.96, stiffness: 350, damping: 16, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, stiffness: 350, damping: 16, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: press }] }, s.wrap, featured && s.featured]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={s.touch} accessibilityLabel={`${title}: ${subtitle}`}>
        <View style={s.content}>
          <Text style={[s.title, featured && s.titleFeatured]} numberOfLines={1}>{title.toUpperCase()}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Text style={[styles.chevron]} numberOfLines={1}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 34,
    color: 'rgba(244,238,226,0.35)',
    fontFamily: typography.serif,
  },
});

const s = StyleSheet.create({
  wrap: {
    borderRadius: radii.card,
    backgroundColor: colors.brandPrimary,
    overflow: 'hidden',
  },
  featured: {
    backgroundColor: colors.brandPrimary,
    borderWidth: 2,
    borderColor: colors.brandAccent,
  },
  touch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
  },
  content: {
    flex: 1,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: 28,
    color: colors.brandCream,
    letterSpacing: 2,
    fontWeight: '700',
  },
  titleFeatured: {
    fontSize: 29,
  },
  subtitle: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: 'rgba(244,238,226,0.55)',
    marginTop: 5,
    letterSpacing: 0.5,
  },
});
