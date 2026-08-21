import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

type Props = { onAdminLongPress: () => void };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function KioskHeader({ onAdminLongPress }: Props) {
  const now = useClock();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <View style={s.root}>
      <View style={s.left}>
        <Text style={s.wordmark}>HOTEL DEL VALLE</Text>
      </View>
      <Text style={s.clock}>{hh}:{mm}</Text>
      <TouchableOpacity
        onLongPress={onAdminLongPress}
        delayLongPress={600}
        hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
        accessibilityLabel="Ajustes"
      >
        <Text style={s.gear}>⚙</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flexShrink: 1 },
  wordmark: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.wordmark,
    color: colors.brandPrimary,
    letterSpacing: 2,
  },
  clock: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.clock,
    color: colors.brandPrimary,
    opacity: 0.45,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 1,
  },
  gear: {
    fontSize: 20,
    color: colors.brandPrimary,
    opacity: 0.35,
    flexShrink: 0,
  },
});
