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
      <Text style={s.wordmark}>Hotel del Valle</Text>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.brandPrimary,
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: sizes.wordmark,
    color: colors.brandCream,
    flexShrink: 1,
  },
  clock: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.clock,
    color: colors.brandCream,
    opacity: 0.6,
    flex: 1,
    textAlign: 'center',
  },
  gear: {
    fontSize: 22,
    color: colors.brandCream,
    opacity: 0.5,
    flexShrink: 0,
  },
});
