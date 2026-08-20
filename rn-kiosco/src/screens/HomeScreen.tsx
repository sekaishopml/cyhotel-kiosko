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
    hero: true,
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
  const hero = PLANS[0];
  const rest = PLANS.slice(1);

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <View style={styles.hero}>
          <ServiceCard
            image={hero.image}
            title={hero.title}
            subtitle={hero.subtitle}
            badge={hero.badge}
            hero
            delay={0}
            onPress={() => onSelectPlan(hero.key)}
          />
        </View>

        <View style={styles.column}>
          {rest.map((p, i) => (
            <View key={p.key} style={styles.cell}>
              <ServiceCard
                image={p.image}
                title={p.title}
                subtitle={p.subtitle}
                delay={80 * (i + 1)}
                onPress={() => onSelectPlan(p.key)}
              />
            </View>
          ))}
        </View>
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
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  hero: {
    flex: 1.35,
  },
  column: {
    flex: 1,
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
});

export default HomeScreen;