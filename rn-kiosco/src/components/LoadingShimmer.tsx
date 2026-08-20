import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radii } from '../theme';

function LoadingShimmer() {
  return (
    <View style={styles.container}>
      {[0, 1, 2].map(i => (
        <Animated.View key={i} style={styles.block} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
  },
  block: {
    height: 112,
    borderRadius: radii.roomCard,
    backgroundColor: '#EDEDED',
  },
});

export default LoadingShimmer;