export const colors = {
  brandPrimary: '#1B2E22',
  brandCream: '#F4EEE2',
  brandAccent: '#C9A15A',
  textMuted: 'rgba(244,238,226,0.65)',
  border: 'rgba(244,238,226,0.15)',
  overlayDark: 'rgba(27,46,34,0.85)',
  // Legacy aliases for migration
  brandPrimaryDeep: '#1B2E22',
  brandPrimaryLight: '#2A4A38',
  brandAccentDeep: '#A8854A',
  textPrimary: '#F4EEE2',
  textInk: '#10281D',
  surface: '#F6F1E7',
  elevated: '#FEFFFF',
  success: '#3E9A63',
  error: '#C05A4A',
  verde900: '#1B2E22',
  verde700: '#2A4A38',
  verde600: '#35664A',
  verde500: '#3E9A63',
  crema: '#F4EEE2',
  ink: '#10281D',
  white: '#FFFFFF',
  negro: '#000000',
  terracota: '#C9A15A',
  terracota700: '#A8854A',
};

export const typography = {
  serif: 'LibreBaskerville-Regular',
  serifBold: 'LibreBaskerville-Bold',
  sans: 'WorkSans-Regular',
  sansMedium: 'WorkSans-Medium',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  gap: 14,
  screen: 20,
  cardVertical: 22,
};

export const radii = {
  card: 16,
  pill: 999,
  button: 12,
  // alias migración
  roomCard: 16,
  modal: 20,
  cta: 12,
  chip: 999,
  circle: 999,
  badge: 12,
  planCard: 16,
};

export const sizes = {
  wordmark: 20,
  cardTitle: 29,
  cardSubtitle: 13,
  idleTitle: 42,
  idleHint: 14,
  label: 11,
  microLabel: 11,
  clock: 18,
  roomTitle: 24,
  roomSubtitle: 13,
  dockTotal: 28,
  formLabel: 14,
  chip: 13,
  cta: 18,
  icon: 24,
  arrow: 36,
  badgeSize: 11,
  planName: 29,
  planSubtitle: 13,
  // alias migración
  roomPhoto: 116,
  roomCardHeight: 116,
  planIcon: 56,
  heroTitle: 42,
};

export const fonts = {
  serif: typography.serif,
  serifBold: typography.serifBold,
  sans: typography.sans,
  sansMedium: typography.sansMedium,
};

export const shadows = {
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
};

export const springs = {
  press: { stiffness: 420, damping: 20, mass: 1 },
};

export const overlayGradient = {
  layers: [
    { heightPct: 0.42, color: 'rgba(27,46,34,0.18)' },
    { heightPct: 0.3, color: 'rgba(27,46,34,0.32)' },
    { heightPct: 0.28, color: 'rgba(27,46,34,0.62)' },
  ],
};