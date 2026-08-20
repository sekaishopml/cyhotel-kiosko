import React, { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { getServerBase, getTypes, PLAN_META, type RoomType, type TypesResponse } from '../api';
import RoomCard from '../components/RoomCard';
import ChipRow from '../components/ChipRow';
import LoadingShimmer from '../components/LoadingShimmer';
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

function RoomScreen({
  planKey,
  selectedRoom,
  selectedExtra,
  selectedDays,
  onSelectRoom,
  onSelectExtra,
  onSelectDays,
  onContinue,
  onBack,
}: Props) {
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
    return () => {
      cancelled = true;
    };
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
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12} accessibilityLabel="Volver">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {PLAN_META[planKey]?.name ?? planKey}
        </Text>
      </View>

      <Animated.View style={[styles.body, bodyAnim]}>
        {loading ? (
          <LoadingShimmer />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>No se pudieron cargar las habitaciones.</Text>
            <Pressable onPress={retry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            <View style={styles.grid}>
              {data.types.map((room, i) => {
                const anim = fadeInDown(i * 70, 16);
                return (
                  <Animated.View key={room.key} style={anim}>
                    <RoomCard
                      room={room}
                      selected={selectedRoom === room.key}
                      onPress={() => onSelectRoom(selectedRoom === room.key ? null : room.key)}
                    />
                  </Animated.View>
                );
              })}
            </View>
            {currentRoom && (
              <Animated.View style={fadeInDown(0, 16)}>
                <ChipRow
                  planKey={planKey}
                  room={currentRoom}
                  selectedExtra={selectedExtra}
                  selectedDays={selectedDays}
                  onSelectExtra={onSelectExtra}
                  onSelectDays={onSelectDays}
                />
              </Animated.View>
            )}
          </>
        ) : null}
      </Animated.View>

      {selectedRoom && currentRoom && (
        <Animated.View style={[styles.dock, dockAnim]}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onContinue(currentRoom.label, total)}
            style={styles.cta}
            accessibilityLabel="Continuar"
          >
            <Text style={styles.ctaText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gap,
    paddingHorizontal: spacing.screen,
  },
  errorBox: {
    padding: spacing.screen,
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    color: colors.verde600,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dock: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,58,42,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalBox: {
    alignItems: 'flex-start',
  },
  totalLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(27,74,53,0.6)',
  },
  totalValue: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.verde900,
  },
  cta: {
    backgroundColor: colors.verde900,
    borderRadius: radii.cta,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  ctaText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default RoomScreen;