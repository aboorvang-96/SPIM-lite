import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const colors = {
  primary: '#2563EB', // Vibrant modern blue
  secondary: '#3B82F6', 
  background: '#F8FAFC', // Very light, clean slate-gray
  surface: '#FFFFFF', // Pure white for cards
  accent: '#DBEAFE',
  success: '#10B981', // Emerald green
  error: '#EF4444',   // Vibrant red
  text: '#0F172A',    // Slate 900
  textSecondary: '#64748B', // Slate 500
  border: '#E2E8F0',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    onPrimary: '#FFFFFF',
    onSurface: colors.text,
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FFFFFF',
      level3: '#FFFFFF',
      level4: '#FFFFFF',
      level5: '#FFFFFF',
    } as any,
  },
  roundness: 12, // Increased roundness for modern sleek look
};
