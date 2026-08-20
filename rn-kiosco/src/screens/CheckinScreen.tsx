import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View, Pressable } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { createOrder, PLAN_META, type Order } from '../api';
import SuccessModal from '../components/SuccessModal';
import { fadeInDown } from '../lib/anims';

type Props = {
  planKey: string;
  roomLabel: string;
  roomKey: string;
  durationLabel: string | null;
  days: number | null;
  total: number;
  onBack: () => void;
  onSuccess: () => void;
};

function CheckinScreen({
  planKey,
  roomLabel,
  roomKey,
  durationLabel,
  days,
  total,
  onBack,
  onSuccess,
}: Props) {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canSubmit = name.trim().length > 0 && !loading;
  const bodyAnim = fadeInDown(0);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        product: planKey,
        room_type: roomKey,
        guest_name: name.trim(),
        client_ref: `kiosco-${Date.now()}`,
      };
      if (document.trim()) payload.id_document = document.trim();
      if (durationLabel && planKey !== 'hospedaje') payload.extra = durationLabel;
      if (planKey === 'hospedaje') payload.days = days ?? 1;

      const result = await createOrder(payload as never);
      setOrder(result);
      setShowModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la reserva. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setOrder(null);
    onSuccess();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12} accessibilityLabel="Volver">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Confirmación</Text>
      </View>

      <Animated.View style={[styles.body, bodyAnim]}>
        <View style={styles.summaryCard}>
          <SummaryRow label="Plan" value={PLAN_META[planKey]?.name ?? planKey} />
          <SummaryRow label="Habitación" value={roomLabel} />
          {durationLabel && planKey !== 'hospedaje' && <SummaryRow label="Duración" value={durationLabel} />}
          {planKey === 'hospedaje' && <SummaryRow label="Noches" value={`${days ?? 1}`} />}
          <SummaryRow label="Total" value={`$${total}`} last />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            placeholderTextColor="rgba(16,40,29,0.3)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={[styles.label, styles.labelGap]}>Documento (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="DNI o pasaporte"
            placeholderTextColor="rgba(16,40,29,0.3)"
            value={document}
            onChangeText={setDocument}
          />

          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </Animated.View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          accessibilityLabel="Confirmar reserva"
        >
          <Text style={styles.ctaText}>{loading ? 'Confirmando…' : 'Confirmar Reserva'}</Text>
        </TouchableOpacity>
      </View>

      <SuccessModal visible={showModal} order={order} onClose={closeModal} />
    </View>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryRowBorder]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 40,
    lineHeight: 42,
    color: colors.verde600,
    marginTop: -4,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    color: colors.verde900,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingBottom: 16,
  },
  summaryCard: {
    backgroundColor: colors.crema,
    borderRadius: radii.roomCard,
    padding: 20,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,58,42,0.08)',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.verde900,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.ink,
  },
  form: {},
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.verde900,
    marginBottom: 8,
  },
  labelGap: {
    marginTop: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(20,58,42,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,58,42,0.1)',
    backgroundColor: colors.white,
  },
  cta: {
    backgroundColor: colors.verde900,
    borderRadius: radii.cta,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CheckinScreen;