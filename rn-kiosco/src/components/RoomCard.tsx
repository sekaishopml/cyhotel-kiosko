import React from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, sizes, radii, typography } from '../theme';
import type { RoomType } from '../api';
import { scaleOnPress } from '../lib/anims';

type Props = {
  room: RoomType;
  selected: boolean;
  onPress: () => void;
};

function RoomCard({ room, selected, onPress }: Props) {
  const press = scaleOnPress();

  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.card, selected ? styles.selected : styles.unselected]}
      >
        <Image
          source={{ uri: room.photo.startsWith('http') ? room.photo : undefined }}
          style={styles.photo}
          resizeMode="cover"
        />
        <View style={styles.body}>
          <Text
            style={[styles.name, selected && styles.nameSelected]}
            numberOfLines={2}
          >
            {room.label}
          </Text>
          <View style={styles.priceRow}>
            {room.price != null && (
              <Text style={[styles.price, selected && styles.priceSelected]}>
                ${room.price}
              </Text>
            )}
            {room.free > 0 && (
              <View style={[styles.freeBadge, selected && styles.freeBadgeSelected]}>
                <Text style={[styles.freeText, selected && styles.freeTextSelected]}>
                  {room.free} libre{room.free > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: sizes.roomCardHeight,
    borderRadius: radii.roomCard,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  selected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(20,58,42,0.1)',
  },
  photo: {
    width: sizes.roomPhoto,
    height: '100%',
    backgroundColor: colors.brandPrimaryLight,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  name: {
    fontFamily: typography.serif,
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  nameSelected: {
    color: colors.white,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.brandPrimaryLight,
  },
  priceSelected: {
    color: colors.white,
  },
  freeBadge: {
    backgroundColor: colors.brandAccent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  freeBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  freeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  freeTextSelected: {
    color: colors.white,
  },
});

export default RoomCard;