import React, { useEffect, useRef } from 'react';
import { Animated, Modal as RNModal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ReactNativeHapticFeedback } from 'react-native-haptic-feedback';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { Order } from '../api';

type Props = { visible: boolean; order: Order | null; onClose: () => void };

const hapticOpts = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function SuccessModal({ visible, order, onClose }: Props) {
  const zoom = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      zoom.setValue(0);
      Animated.timing(zoom, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOpts);
    }
  }, [visible, zoom]);

  const handleClose = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOpts);
    onClose();
  };

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { opacity: zoom, transform: [{ scale: zoom }] }]}>
          <View style={s.checkCircle}>
            <Icon name="check" size={32} color={colors.brandPrimary} />
          </View>
          <Text style={s.title}>¡Reserva confirmada!</Text>
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
      </View>
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
    borderColor: colors.border,
    ...Platform.select({
      android: { elevation: 12 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
    }),
  },
  checkCircle: { width: 64, height: 64, borderRadius: 999, backgroundColor: colors.brandAccent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: typography.serifBold, fontSize: sizes.title, color: colors.brandCream, marginBottom: 4, letterSpacing: 1 },
  subtitle: { fontSize: sizes.cardSubtitle, color: 'rgba(244,238,226,0.55)', marginBottom: spacing.lg, fontFamily: typography.sansMedium },
  info: { backgroundColor: 'rgba(244,238,226,0.06)', borderRadius: radii.card, padding: spacing.md, width: '100%', marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: sizes.cardSubtitle, fontWeight: '600', color: colors.brandCream, fontFamily: typography.sansMedium },
  rowValue: { fontSize: sizes.cardSubtitle, color: 'rgba(244,238,226,0.55)', fontFamily: typography.sansMedium },
  closeBtn: { backgroundColor: colors.brandAccent, borderRadius: radii.button, paddingVertical: 14, paddingHorizontal: 48 },
  closeTxt: { color: colors.brandPrimary, fontSize: sizes.cta, fontWeight: '600', fontFamily: typography.sansMedium, letterSpacing: 1 },
});
