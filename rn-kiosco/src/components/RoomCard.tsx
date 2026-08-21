import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, sizes, typography } from '../theme';
import type { RoomType } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = { room: RoomType; selected: boolean; onPress: () => void };

export default function RoomCard({ room, selected, onPress }: Props) {
  const press = scaleOnPress();
  return (
    <Animated.View style={press.style}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={press.pressIn} onPressOut={press.pressOut} style={[s.card, selected ? s.sel : s.unsel]}>
        <Text style={[s.name, selected && s.nameSel]} numberOfLines={2}>{room.label}</Text>
        <View style={s.row}>
          {room.price != null && <Text style={[s.price, selected && s.priceSel]}>${room.price}</Text>}
          {room.free > 0 && (
            <View style={[s.free, selected && s.freeSel]}>
              <Text style={[s.freeTxt, selected && s.freeTxtSel]}>{room.free} libre{room.free > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { height: 100, borderRadius: radii.card, borderWidth: 1.5, paddingHorizontal: 20, justifyContent: 'center' },
  sel: { backgroundColor: colors.brandPrimary, borderColor: colors.brandAccent },
  unsel: { backgroundColor: colors.brandPrimary, borderColor: colors.border },
  name: { fontFamily: typography.serifBold, fontSize: sizes.roomTitle, color: colors.brandCream },
  nameSel: { color: colors.brandCream },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  price: { fontSize: sizes.cta, fontWeight: '700', color: colors.brandAccent },
  priceSel: { color: colors.brandAccent },
  free: { backgroundColor: 'rgba(201,161,90,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  freeSel: { backgroundColor: 'rgba(201,161,90,0.3)' },
  freeTxt: { color: colors.brandAccent, fontSize: sizes.label, fontWeight: '600' },
  freeTxtSel: { color: colors.brandAccent },
});
