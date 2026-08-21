import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import ServiceCard from '../components/ServiceCard';

const IMAGES = {
  momento: require('../assets/img/momento.webp'),
  amanecida: require('../assets/img/amanecida.webp'),
  hospedaje: require('../assets/img/hospedaje.webp'),
  suite: require('../assets/img/suite.webp'),
};

type Props = {
  onSelectPlan: (planKey: string) => void;
};

const PLANS = [
  {
    key: 'momento',
    title: 'Momento',
    subtitle: 'Por horas, sin complicaciones',
    image: IMAGES.momento,
    badge: 'Lo más pedido',
  },
  {
    key: 'amanecida',
    title: 'Amanecida',
    subtitle: 'Desde la tarde hasta la mañana',
    image: IMAGES.amanecida,
  },
  {
    key: 'hospedaje',
    title: 'Hospedaje',
    subtitle: 'Estadía por noches',
    image: IMAGES.hospedaje,
  },
  {
    key: 'suite',
    title: 'Suite Jacuzzi',
    subtitle: 'Noche de lujo',
    image: IMAGES.suite,
  },
];

function HomeScreen({ onSelectPlan }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        {PLANS.map((p, i) => (
          <View key={p.key} style={styles.cell}>
            <ServiceCard
              image={p.image}
              title={p.title}
              subtitle={p.subtitle}
              badge={p.badge}
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
    backgroundColor: colors.brandPrimaryDeep,
    padding: spacing.md,
  },
  column: {
    flex: 1,
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
});

export default HomeScreen;
