import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';

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
      <Text style={styles.brand}>Hotel del Valle</Text>

      <Text style={styles.clock}>
        {hh}:{mm}
      </Text>

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
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: {
    fontFamily: typography.serif,
    fontSize: sizes.wordmark,
    fontWeight: '700',
    color: colors.brandPrimary,
    letterSpacing: 0.5,
  },
  clock: {
    fontFamily: typography.sans,
    fontSize: sizes.clock,
    fontWeight: '700',
    color: colors.brandPrimary,
    letterSpacing: 1,
    marginHorizontal: spacing.sm,
  },
  gear: {
    fontSize: 24,
    color: colors.brandPrimary,
    opacity: 0.6,
  },
});

export default KioskHeader;