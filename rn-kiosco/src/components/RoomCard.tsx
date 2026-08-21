import React from 'react';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { RoomType } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = { room: RoomType; selected: boolean; onPress: () => void; wide?: boolean };

export default function RoomCard({ room, selected, onPress, wide }: Props) {
  const press = scaleOnPress();
  const photoUri = room.photo ? { uri: room.photo } : null;

  return (
    <Animated.View style={[press.style, wide && s.wide]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={press.pressIn} onPressOut={press.pressOut} style={[s.card, selected ? s.sel : s.unsel, wide && s.cardWide]}>
        {photoUri && <Image source={photoUri} style={s.bgImage} blurRadius={6} resizeMode="cover" />}
        <View style={[s.overlay, selected && s.overlaySel]} />
        <View style={s.content}>
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
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wide: {
    flex: 1,
  },
  card: {
    height: 110,
    borderRadius: radii.card,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cardWide: {
    height: 130,
  },
  sel: {
    borderColor: colors.brandAccent,
  },
  unsel: {
    borderColor: 'rgba(27,46,34,0.08)',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27,46,34,0.5)',
  },
  overlaySel: {
    backgroundColor: 'rgba(27,46,34,0.35)',
  },
  content: {
    padding: spacing.md,
    zIndex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: typography.serifBold,
    fontSize: sizes.roomTitle,
    color: colors.brandCream,
    flex: 1,
  },
  nameSel: {
    color: colors.brandCream,
  },
  badge: {
    backgroundColor: 'rgba(201,161,90,0.3)',
    borderRadius: radii.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeSel: {
    backgroundColor: 'rgba(201,161,90,0.45)',
  },
  badgeTxt: {
    color: colors.brandCream,
    fontSize: sizes.label,
    fontWeight: '600',
    fontFamily: typography.sansMedium,
  },
  badgeTxtSel: {
    color: colors.brandCream,
  },
  price: {
    fontSize: sizes.cta,
    fontWeight: '700',
    color: colors.brandAccent,
    fontFamily: typography.sansMedium,
    marginTop: 4,
  },
  priceSel: {
    color: colors.brandAccent,
  },
});
