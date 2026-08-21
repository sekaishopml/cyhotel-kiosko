import React, { useEffect, useRef } from 'react';
import { Animated, Modal as RNModal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';
import { EASE_OUT } from '../lib/anims';
import type { Order } from '../api';

type Props = { visible: boolean; order: Order | null; onClose: () => void };

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function SuccessModal({ visible, order, onClose }: Props) {
  const overlayFade = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      overlayFade.setValue(0);
      cardScale.setValue(0.85);
      cardFade.setValue(0);
      checkScale.setValue(0);

      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, stiffness: 100, damping: 14, delay: 100, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 350, delay: 100, easing: EASE_OUT, useNativeDriver: true }),
      ]).start();

      Animated.spring(checkScale, { toValue: 1, stiffness: 120, damping: 10, delay: 300, useNativeDriver: true }).start();
    }
  }, [visible, overlayFade, cardScale, cardFade, checkScale]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(overlayFade, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.9, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Animated.View style={[s.overlay, { opacity: overlayFade }]}>
        <Animated.View style={[s.card, { opacity: cardFade, transform: [{ scale: cardScale }] }]}>
          <Animated.View style={[s.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Text style={s.check}>✓</Text>
          </Animated.View>
          <Text style={s.title}>¡RESERVA CONFIRMADA!</Text>
          <Text style={s.subtitle}>Tu habitación está lista</Text>
          {order && (
            <View style={s.info}>
              <InfoRow label="Reserva" value={`#${order.id}`} />
              <InfoRow label="Habitación" value={`${order.room_label} · N° ${order.room_number}`} />
              <InfoRow label="Ingreso" value={order.check_in_fmt} />
              <InfoRow label="Salida" value={order.check_out_fmt} />
              <InfoRow label="Total" value={`$${order.amount}`} last />
            </View>
          )}
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} accessibilityLabel="Cerrar">
            <Text style={s.closeTxt}>CERRAR</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlayDark, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radii.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,238,226,0.08)',
    ...Platform.select({
      android: { elevation: 16 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
    }),
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  check: { color: colors.brandPrimary, fontSize: 30, fontWeight: '700' },
  title: {
    fontFamily: typography.serifBold,
    fontSize: sizes.title,
    color: colors.brandCream,
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: sizes.cardSubtitle,
    color: colors.textLight,
    marginBottom: spacing.lg,
    fontFamily: typography.sansMedium,
  },
  info: {
    backgroundColor: 'rgba(244,238,226,0.05)',
    borderRadius: radii.card,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(244,238,226,0.06)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(244,238,226,0.06)' },
  rowLabel: { fontSize: sizes.cardSubtitle, fontWeight: '600', color: colors.brandCream, fontFamily: typography.sansMedium },
  rowValue: { fontSize: sizes.cardSubtitle, color: colors.textLight, fontFamily: typography.sansMedium },
  closeBtn: {
    backgroundColor: colors.brandAccent,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  closeTxt: {
    color: colors.brandPrimary,
    fontSize: sizes.cta,
    fontWeight: '600',
    fontFamily: typography.sansMedium,
    letterSpacing: 1,
  },
});
