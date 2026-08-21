export const colors = {
  // Paleta boutique: verde profundo (bosque) + dorado (cobre cálido) + crema
  brandPrimary: '#1F3B2C',
  brandPrimaryDeep: '#162D20',
  brandPrimaryLight: '#2E5240',
  brandAccent: '#C9A15A',
  brandAccentDeep: '#A8854A',
  brandCream: '#F4EEE2',
  overlayDark: 'rgba(10,18,14,0.55)',
  textPrimary: '#F4EEE2',
  textMuted: 'rgba(244,238,226,0.7)',
  textInk: '#10281D',
  border: '#E0D8CC',
  surface: '#F6F1E7',
  elevated: '#FEFFFF',
  success: '#3E9A63',
  error: '#C05A4A',
  // Aliases de la paleta anterior (migración)
  verde900: '#1F3B2C',
  verde700: '#2E5240',
  verde600: '#3A6450',
  verde500: '#3E9A63',
  crema: '#F4EEE2',
  ink: '#10281D',
  white: '#FFFFFF',
  negro: '#000000',
  terracota: '#C9A15A',
  terracota700: '#A8854A',
};

export const typography = {
  serif: 'PlayfairDisplay',
  sans: 'Inter',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  // alias migración
  gap: 16,
  screen: 24,
};

export const radii = {
  card: 20,
  pill: 999,
  button: 14,
  // alias migración
  roomCard: 16,
  modal: 20,
  cta: 14,
  chip: 999,
  circle: 999,
  badge: 12,
  planCard: 20,
};

export const sizes = {
  heroTitle: 42,
  cardTitle: 32,
  cardSubtitle: 16,
  microLabel: 12,
  planName: 32,
  planSubtitle: 16,
  label: 18,
  cta: 22,
  icon: 28,
  clock: 16,
  wordmark: 28,
  roomTitle: 28,
  roomSubtitle: 16,
  dockTotal: 28,
  formLabel: 18,
  chip: 18,
  // alias migración
  roomPhoto: 116,
  roomCardHeight: 116,
  planIcon: 56,
  arrow: 40,
  badgeSize: 12,
};

export const fonts = {
  serif: typography.serif,
  sans: typography.sans,
  sansMedium: typography.sans,
};

export const shadows = {
  card: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
};

export const springs = {
  press: { stiffness: 420, damping: 20, mass: 1 },
};

export const overlayGradient = {
  layers: [
    { heightPct: 0.42, color: 'rgba(10,18,14,0.18)' },
    { heightPct: 0.3, color: 'rgba(10,18,14,0.32)' },
    { heightPct: 0.28, color: 'rgba(10,18,14,0.62)' },
  ],
};