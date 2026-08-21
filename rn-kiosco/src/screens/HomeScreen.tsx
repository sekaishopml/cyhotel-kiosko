import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import ServiceCard from '../components/ServiceCard';

type Props = {
  onSelectPlan: (planKey: string) => void;
};

const PLANS = [
  {
    key: 'momento',
    title: 'Momento',
    subtitle: 'Por horas, sin complicaciones',
    featured: true,
  },
  {
    key: 'amanecida',
    title: 'Amanecida',
    subtitle: 'Desde la tarde hasta la mañana',
    featured: false,
  },
  {
    key: 'hospedaje',
    title: 'Hospedaje',
    subtitle: 'Estadía por noches',
    featured: false,
  },
  {
    key: 'suite',
    title: 'Suite Jacuzzi',
    subtitle: 'Noche de lujo',
    featured: false,
  },
];

function HomeScreen({ onSelectPlan }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        {PLANS.map((p, i) => (
          <View key={p.key} style={styles.cell}>
            <ServiceCard
              title={p.title}
              subtitle={p.subtitle}
              featured={p.featured}
              delay={i * 80}
              onPress={() => onSelectPlan(p.key)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  column: {
    flex: 1,
    gap: spacing.gap,
  },
  cell: {
    flex: 1,
  },
});

export default HomeScreen;