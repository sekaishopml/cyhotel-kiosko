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
    <View style={styles.header}>
      <Text style={styles.wordmark}>Hotel del Valle</Text>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: sizes.wordmark,
    fontWeight: '600',
    color: colors.brandPrimary,
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  clock: {
    fontFamily: typography.sans,
    fontSize: sizes.clock,
    color: colors.brandPrimary,
    opacity: 0.5,
    letterSpacing: 2,
    marginLeft: 'auto',
    marginRight: spacing.md,
  },
  gear: {
    fontSize: 22,
    color: colors.brandPrimary,
    opacity: 0.4,
  },
});

export default KioskHeader;
