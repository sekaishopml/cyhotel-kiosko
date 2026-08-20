import React from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { PLAN_ORDER } from '../api';
import PlanCard from '../components/PlanCard';
import { fadeInDown } from '../lib/anims';

type Props = {
  onSelectPlan: (planKey: string) => void;
  serverLabel?: string;
  onServerPress?: () => void;
};

function PlanScreen({ onSelectPlan, serverLabel, onServerPress }: Props) {
  const titleAnim = fadeInDown(0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Animated.Text style={[styles.title, titleAnim]}>
        Elegí tu plan
      </Animated.Text>
      <View style={styles.list}>
        {PLAN_ORDER.map((key, i) => {
          const anim = fadeInDown(i * 90);
          return (
            <Animated.View key={key} style={anim}>
              <PlanCard planKey={key} onPress={() => onSelectPlan(key)} />
            </Animated.View>
          );
        })}
      </View>
      {serverLabel && (
        <TouchableOpacity onPress={onServerPress} style={styles.serverRow} accessibilityLabel="Configurar servidor">
          <Text style={styles.serverText}>Servidor: {serverLabel}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.footer}>Recepción 24 h · WiFi gratuito · Bebidas y piqueos</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: 32,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '600',
    color: colors.verde900,
    marginBottom: 24,
  },
  list: {
    gap: 16,
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(18,40,29,0.55)',
  },
  serverRow: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  serverText: {
    color: colors.verde600,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PlanScreen;