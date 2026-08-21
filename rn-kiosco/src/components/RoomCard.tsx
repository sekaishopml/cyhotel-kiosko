import React from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { RoomType } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = { room: RoomType; selected: boolean; onPress: () => void };

export default function RoomCard({ room, selected, onPress }: Props) {
  const press = scaleOnPress();
  return (
    <Animated.View style={[press.style, s.wrap]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={press.pressIn} onPressOut={press.pressOut} style={[s.card, selected ? s.sel : s.unsel]}>
        <View style={s.top}>
          <Text style={[s.name, selected && s.nameSel]} numberOfLines={1}>{room.label}</Text>
          {room.free > 0 && (
            <View style={[s.badge, selected && s.badgeSel]}>
              <Text style={[s.badgeTxt, selected && s.badgeTxtSel]}>{room.free} libre{room.free > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        {room.price != null && (
          <Text style={[s.price, selected && s.priceSel]}>${room.price}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    ...Platform.select({
      android: { elevation: 3 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
    }),
  },
  card: {
    height: 80,
    borderRadius: radii.card,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  sel: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandAccent,
  },
  unsel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: typography.serifBold,
    fontSize: sizes.roomTitle,
    color: colors.brandPrimary,
    flex: 1,
  },
  nameSel: {
    color: colors.brandCream,
  },
  badge: {
    backgroundColor: 'rgba(201,161,90,0.15)',
    borderRadius: radii.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeSel: {
    backgroundColor: 'rgba(201,161,90,0.25)',
  },
  badgeTxt: {
    color: colors.brandAccent,
    fontSize: sizes.label,
    fontWeight: '600',
    fontFamily: typography.sansMedium,
  },
  badgeTxtSel: {
    color: colors.brandAccent,
  },
  price: {
    fontSize: sizes.cta,
    fontWeight: '700',
    color: colors.brandAccent,
    fontFamily: typography.sansMedium,
    marginTop: 2,
  },
  priceSel: {
    color: colors.brandAccent,
  },
});
