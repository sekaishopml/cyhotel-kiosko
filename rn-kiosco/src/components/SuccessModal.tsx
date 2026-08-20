import React, { useEffect, useRef } from 'react';
import { Animated, Modal as RNModal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, typography } from '../theme';
import type { Order } from '../api';
import { zoomIn } from '../lib/anims';

type Props = {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
};

function SuccessModal({ visible, order, onClose }: Props) {
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      zoom.setValue(0);
      Animated.timing(zoom, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, zoom]);

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: zoom, transform: [{ scale: zoom }] }]}>
          <View style={styles.checkCircle}>
            <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.title}>¡Reserva confirmada!</Text>
          <Text style={styles.subtitle}>Tu habitación está lista</Text>

          {order && (
            <View style={styles.infoCard}>
              <InfoRow label="Reserva" value={`#${order.id}`} />
              <InfoRow label="Habitación" value={`${order.room_label} · N° ${order.room_number}`} />
              <InfoRow label="Ingreso" value={order.check_in_fmt} />
              <InfoRow label="Salida" value={order.check_out_fmt} />
              <InfoRow label="Total" value={`$${order.amount}`} last />
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Cerrar">
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </RNModal>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16,40,29,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.modal,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  check: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '700',
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 24,
    fontWeight: '600',
    color: colors.brandPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(27,74,53,0.6)',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,58,42,0.08)',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brandPrimary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
  },
  closeBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radii.cta,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  closeBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SuccessModal;