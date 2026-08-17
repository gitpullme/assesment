export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly surfaceHover: string;
  readonly border: string;
  readonly borderFocus: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly primary: string;
  readonly primaryHover: string;
  readonly primaryForeground: string;
  readonly accent: string;
  readonly accentForeground: string;
  readonly success: string;
  readonly successBackground: string;
  readonly warning: string;
  readonly warningBackground: string;
  readonly danger: string;
  readonly dangerBackground: string;
  readonly cardShadow: string;
}

export const darkThemeColors: ThemeColors = {
  background: '#090D16',
  surface: '#111827',
  surfaceElevated: '#1F2937',
  surfaceHover: '#374151',
  border: '#1F2937',
  borderFocus: '#3B82F6',
  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryForeground: '#FFFFFF',
  accent: '#10B981',
  accentForeground: '#FFFFFF',
  success: '#10B981',
  successBackground: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningBackground: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerBackground: 'rgba(239, 68, 68, 0.15)',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
};

export const lightThemeColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  surfaceHover: '#E2E8F0',
  border: '#E2E8F0',
  borderFocus: '#2563EB',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryForeground: '#FFFFFF',
  accent: '#059669',
  accentForeground: '#FFFFFF',
  success: '#059669',
  successBackground: '#ECFDF5',
  warning: '#D97706',
  warningBackground: '#FFFBEB',
  danger: '#DC2626',
  dangerBackground: '#FEF2F2',
  cardShadow: 'rgba(0, 0, 0, 0.08)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const typography = {
  fontFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 30,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
