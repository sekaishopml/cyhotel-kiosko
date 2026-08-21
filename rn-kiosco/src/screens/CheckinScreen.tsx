import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View, Pressable } from 'react-native';
import { colors, radii, spacing, typography, sizes } from '../theme';
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

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.sumRow, !last && s.sumRowBorder]}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

export default function CheckinScreen({ planKey, roomLabel, roomKey, durationLabel, days, total, onBack, onSuccess }: Props) {
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

  const closeModal = () => { setShowModal(false); setOrder(null); onSuccess(); };

  return (
    <View style={s.screen}>
      <View style={s.titleRow}>
        <Pressable onPress={onBack} style={s.backBtn} hitSlop={12} accessibilityLabel="Volver">
          <Text style={s.backIcon}>‹</Text>
        </Pressable>
        <Text style={s.title}>Confirmación</Text>
      </View>
      <Animated.View style={[s.body, bodyAnim]}>
        <View style={s.summary}>
          <SummaryRow label="Plan" value={PLAN_META[planKey]?.name ?? planKey} />
          <SummaryRow label="Habitación" value={roomLabel} />
          {durationLabel && planKey !== 'hospedaje' && <SummaryRow label="Duración" value={durationLabel} />}
          {planKey === 'hospedaje' && <SummaryRow label="Noches" value={`${days ?? 1}`} />}
          <SummaryRow label="Total" value={`$${total}`} last />
        </View>
        <View style={s.form}>
          <Text style={s.label}>Nombre completo *</Text>
          <TextInput style={s.input} placeholder="Tu nombre" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
          <Text style={[s.label, { marginTop: spacing.lg }]}>Documento (opcional)</Text>
          <TextInput style={s.input} placeholder="DNI o pasaporte" placeholderTextColor={colors.textMuted} value={document} onChangeText={setDocument} />
          {error && <Text style={s.error}>{error}</Text>}
        </View>
      </Animated.View>
      <View style={s.bar}>
        <TouchableOpacity onPress={submit} disabled={!canSubmit} style={[s.cta, !canSubmit && s.ctaDis]} accessibilityLabel="Confirmar reserva">
          <Text style={s.ctaText}>{loading ? 'Confirmando…' : 'Confirmar Reserva'}</Text>
        </TouchableOpacity>
      </View>
      <SuccessModal visible={showModal} order={order} onClose={closeModal} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: sizes.back, lineHeight: 40, color: colors.brandCream, marginTop: -4 },
  title: { fontFamily: typography.serifBold, fontSize: sizes.title, color: colors.brandCream },
  body: { flex: 1, paddingHorizontal: spacing.screen, paddingBottom: spacing.md },
  summary: { backgroundColor: 'rgba(244,238,226,0.06)', borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  sumRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sumLabel: { fontSize: sizes.cardSubtitle, fontWeight: '600', color: colors.brandCream },
  sumValue: { fontSize: sizes.cardSubtitle, color: colors.textMuted },
  form: {},
  label: { fontSize: sizes.cardSubtitle, fontWeight: '600', color: colors.brandCream, marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.button, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: sizes.input, color: colors.brandCream, backgroundColor: 'rgba(244,238,226,0.06)' },
  error: { color: colors.error, fontSize: sizes.cardSubtitle, marginTop: spacing.md, textAlign: 'center' },
  bar: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(244,238,226,0.03)' },
  cta: { backgroundColor: colors.brandAccent, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center' },
  ctaDis: { opacity: 0.4 },
  ctaText: { color: colors.brandPrimary, fontSize: sizes.cta, fontWeight: '600', fontFamily: typography.sansMedium },
});
