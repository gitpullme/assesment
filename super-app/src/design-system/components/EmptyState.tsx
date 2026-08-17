import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Button } from './Button';

export interface EmptyStateProps {
  readonly title: string;
  readonly message: string;
  readonly actionTitle?: string;
  readonly onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  actionTitle,
  onAction,
}: EmptyStateProps): React.ReactElement {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xxl }]}>
      <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.xl }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.message,
          { color: colors.textSecondary, fontSize: typography.sizes.md, marginVertical: spacing.sm },
        ]}
      >
        {message}
      </Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
});
