import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { PLAN_ORDER } from '../api';
import PlanCard from '../components/PlanCard';
import { fadeInDown } from '../lib/anims';

type Props = {
  onSelectPlan: (planKey: string) => void;
  serverLabel?: string;
  onServerPress?: () => void;
};

function PlanScreen({ onSelectPlan }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.grid}>
        {PLAN_ORDER.map((key, i) => {
          const anim = fadeInDown(i * 80, 24);
          return (
            <Animated.View key={key} style={[styles.cell, anim]}>
              <PlanCard planKey={key} onPress={() => onSelectPlan(key)} />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.screen,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'stretch',
    marginHorizontal: -spacing.gap / 2,
  },
  cell: {
    width: '50%',
    paddingHorizontal: spacing.gap / 2,
    paddingVertical: spacing.gap / 2,
  },
});

export default PlanScreen;