export const colors = {
  primary: '#143A2A',
  onPrimary: '#FFFFFF',
  surface: '#F3ECDD',
  elevated: '#FEFFFF',
  ink: '#10281D',
  inkMuted: '#6B736B',
  accent: '#9B3B2E',
  accentEmphasis: '#7A2F24',
  border: '#E0D8CC',
  verde900: '#143A2A',
  verde700: '#1B4A35',
  verde600: '#2C6B4A',
  verde500: '#3E9A63',
  crema: '#F3ECDD',
  negro: '#000000',
  terracota: '#9B3B2E',
  terracota700: '#7E2E23',
  overlay: 'rgba(16, 40, 29, 0.5)',
  white: '#FFFFFF',
};

export const fonts = {
  serif: 'serif',
  sans: 'sans-serif',
};

export const sizes = {
  planName: 20,
  screenTitle: 18,
  subtitle: 14,
  label: 16,
  micro: 12,
  planIcon: 56,
  ring: 60,
  arrow: 40,
  badge: 12,
  cta: 18,
  roomName: 20,
  roomSubtitle: 14,
  dockTotal: 24,
  roomPhoto: 116,
  roomCardHeight: 116,
  formLabel: 14,
  chip: 14,
};

export const radii = {
  planCard: 20,
  roomCard: 16,
  cta: 16,
  modal: 24,
  chip: 999,
  circle: 28,
  badge: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  card: 12,
  md: 16,
  screen: 24,
  lg: 32,
  gap: 16,
};

export const spring = {
  stiffness: 400,
  damping: 17,
  mass: 1,
};

export const springSoft = {
  stiffness: 300,
  damping: 20,
  mass: 1,
};

export const ease = [0.22, 1, 0.36, 1] as const;

export const shadows = {
  card: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
};
