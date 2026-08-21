import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

type Props = {
  onAdminLongPress: () => void;
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function KioskHeader({ onAdminLongPress }: Props) {
  const now = useClock();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>Hotel del Valle</Text>
      <Text style={styles.clock}>{hh}:{mm}</Text>
      <TouchableOpacity
        onLongPress={onAdminLongPress}
        delayLongPress={600}
        hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
      >
        <Text style={styles.gear}>⚙</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.brandPrimary,
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: sizes.wordmark,
    fontWeight: '400',
    color: colors.brandCream,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  clock: {
    fontFamily: typography.sansMedium,
    fontSize: sizes.clock,
    color: colors.brandCream,
    opacity: 0.7,
    letterSpacing: 0.5,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: spacing.md,
  },
  gear: {
    fontSize: 22,
    color: colors.brandCream,
    opacity: 0.6,
    flexShrink: 0,
  },
});

export default KioskHeader;