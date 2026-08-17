import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeContext';

export interface CardProps {
  readonly children: ReactNode;
  readonly style?: ViewStyle;
  readonly elevated?: boolean;
}

export function Card({ children, style, elevated = false }: CardProps): React.ReactElement {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
