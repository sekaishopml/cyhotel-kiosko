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
      <View style={styles.brand}>
        <Text style={styles.wordmark}>Hotel del Valle</Text>
        <Text style={styles.tagline}>Estancia boutique</Text>
      </View>

      <View style={styles.clock}>
        <Text style={styles.clockText}>
          {hh}:{mm}
        </Text>
      </View>

      <TouchableOpacity
        onLongPress={onAdminLongPress}
        delayLongPress={600}
        hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
        style={styles.gearBtn}
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
    justifyContent: 'space-between',
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brand: {
    flexDirection: 'column',
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: sizes.wordmark,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  tagline: {
    fontFamily: typography.sans,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.brandAccent,
    marginTop: 2,
  },
  clock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  clockText: {
    fontFamily: typography.serif,
    fontSize: sizes.clock,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  gearBtn: {
    padding: spacing.sm,
    borderRadius: radii.button,
  },
  gear: {
    fontSize: 22,
    color: colors.textMuted,
  },
});

export default KioskHeader;