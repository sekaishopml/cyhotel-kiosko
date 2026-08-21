import React, { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { colors, radii, spacing, typography, sizes } from '../theme';
import { getServerBase, getTypes, PLAN_META, type RoomType, type TypesResponse } from '../api';
import RoomCard from '../components/RoomCard';
import ChipRow from '../components/ChipRow';
import Shimmer from '../components/Shimmer';
import { fadeIn, fadeInDown, slideUp } from '../lib/anims';

type Props = {
  planKey: string;
  selectedRoom: string | null;
  selectedExtra: string | null;
  selectedDays: number;
  onSelectRoom: (key: string | null) => void;
  onSelectExtra: (key: string | null) => void;
  onSelectDays: (days: number) => void;
  onContinue: (roomLabel: string, total: number) => void;
  onBack: () => void;
};

export default function RoomScreen({ planKey, selectedRoom, selectedExtra, selectedDays, onSelectRoom, onSelectExtra, onSelectDays, onContinue, onBack }: Props) {
  const [data, setData] = useState<TypesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const base = await getServerBase();
        const res = await getTypes(planKey, base);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planKey, reloadKey]);

  const currentRoom: RoomType | undefined = data?.types.find(t => t.key === selectedRoom);

  const computeTotal = useCallback((): number => {
    if (!currentRoom || currentRoom.price == null) return 0;
    if (planKey === 'hospedaje') return currentRoom.price * selectedDays;
    if (selectedExtra) {
      const extra = currentRoom.extras?.[selectedExtra];
      if (extra) {
        if (selectedExtra === '6h') return extra.price;
        return currentRoom.price + extra.price;
      }
    }
    return currentRoom.price;
  }, [currentRoom, planKey, selectedExtra, selectedDays]);

  const total = computeTotal();
  const retry = () => setReloadKey(k => k + 1);
  const bodyAnim = fadeIn(0);
  const dockAnim = slideUp(0, 80, 350);

  return (
    <View style={s.screen}>
      <View style={s.titleRow}>
        <Pressable onPress={onBack} style={s.backBtn} hitSlop={12} accessibilityLabel="Volver">
          <Text style={s.backIcon}>‹</Text>
        </Pressable>
        <Text style={s.title}>{PLAN_META[planKey]?.name ?? planKey}</Text>
      </View>
      <Animated.View style={[s.body, bodyAnim]}>
        {loading ? <Shimmer /> : error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>No se pudieron cargar las habitaciones.</Text>
            <Pressable onPress={retry} style={s.retryBtn}><Text style={s.retryText}>Reintentar</Text></Pressable>
          </View>
        ) : data ? (
          <>
            <View style={s.grid}>
              {data.types.map((room, i) => (
                <Animated.View key={room.key} style={fadeInDown(i * 70, 16)}>
                  <RoomCard room={room} selected={selectedRoom === room.key} onPress={() => onSelectRoom(selectedRoom === room.key ? null : room.key)} />
                </Animated.View>
              ))}
            </View>
            {currentRoom && (
              <Animated.View style={fadeInDown(0, 16)}>
                <ChipRow planKey={planKey} room={currentRoom} selectedExtra={selectedExtra} selectedDays={selectedDays} onSelectExtra={onSelectExtra} onSelectDays={onSelectDays} />
              </Animated.View>
            )}
          </>
        ) : null}
      </Animated.View>
      {selectedRoom && currentRoom && (
        <Animated.View style={[s.dock, dockAnim]}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>${total}</Text>
          </View>
          <TouchableOpacity onPress={() => onContinue(currentRoom.label, total)} style={s.cta} accessibilityLabel="Continuar">
            <Text style={s.ctaText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.screen, paddingTop: spacing.md, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: sizes.back, lineHeight: 40, color: colors.brandCream, marginTop: -4 },
  title: { fontFamily: typography.serifBold, fontSize: sizes.title, color: colors.brandCream },
  body: { flex: 1 },
  grid: { gap: spacing.gap, paddingHorizontal: spacing.screen },
  errorBox: { padding: spacing.screen, alignItems: 'center' },
  errorText: { color: colors.error, fontSize: sizes.cardSubtitle, marginBottom: spacing.md },
  retryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.brandAccent, fontSize: sizes.cardSubtitle, fontWeight: '600', textDecorationLine: 'underline' },
  dock: { backgroundColor: 'rgba(244,238,226,0.06)', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.screen, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalBox: { alignItems: 'flex-start' },
  totalLabel: { fontSize: sizes.label, textTransform: 'uppercase', letterSpacing: 1, color: colors.textMuted },
  totalValue: { fontFamily: typography.serifBold, fontSize: sizes.totalValue, color: colors.brandCream },
  cta: { backgroundColor: colors.brandAccent, borderRadius: radii.button, paddingHorizontal: 36, paddingVertical: 14 },
  ctaText: { color: colors.brandPrimary, fontSize: sizes.cta, fontWeight: '600', fontFamily: typography.sansMedium },
});
