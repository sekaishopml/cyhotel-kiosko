import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../theme';

const IMAGES = [
  require('../assets/img/momento.webp'),
  require('../assets/img/amanecida.webp'),
  require('../assets/img/suite.webp'),
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function IdleScreen() {
  const now = useClock();
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }).start();
      setIdx(i => (i + 1) % IMAGES.length);
    }, 7000);
    return () => clearInterval(t);
  }, [fade]);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <View style={styles.screen} pointerEvents="none">
      <Animated.View style={[styles.photoLayer, { opacity: fade }]}>
        <Image source={IMAGES[idx]} style={styles.photo} resizeMode="cover" />
      </Animated.View>
      <View style={styles.overlay}>
        <Text style={styles.wordmark}>Hotel del Valle</Text>
        <Text style={styles.clock}>
          {hh}:{mm}
        </Text>
        <Text style={styles.hint}>Toque la pantalla para comenzar</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandPrimaryDeep,
  },
  photoLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: 54,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  clock: {
    fontFamily: typography.serif,
    fontSize: 86,
    color: colors.brandAccent,
    marginTop: spacing.md,
    letterSpacing: 4,
  },
  hint: {
    fontFamily: typography.sans,
    fontSize: 20,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});

export default IdleScreen;