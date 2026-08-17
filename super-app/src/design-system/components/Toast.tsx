import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeContext';

export interface ToastBannerProps {
  readonly title: string;
  readonly message: string;
  readonly type?: 'info' | 'success' | 'warning' | 'error';
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onClose?: () => void;
  readonly style?: ViewStyle;
}

export function ToastBanner({
  title,
  message,
  type = 'info',
  actionLabel,
  onAction,
  onClose,
  style,
}: ToastBannerProps): React.ReactElement {
  const { colors, borderRadius, spacing, typography } = useTheme();

  const getTypeColors = (): { bg: string; border: string; text: string } => {
    switch (type) {
      case 'success':
        return { bg: colors.successBackground, border: colors.success, text: colors.success };
      case 'warning':
        return { bg: colors.warningBackground, border: colors.warning, text: colors.warning };
      case 'error':
        return { bg: colors.dangerBackground, border: colors.danger, text: colors.danger };
      case 'info':
      default:
        return { bg: 'rgba(37, 99, 235, 0.12)', border: colors.primary, text: colors.primary };
    }
  };

  const typeStyle = getTypeColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: typeStyle.bg,
          borderColor: typeStyle.border,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: typeStyle.text, fontSize: typography.sizes.sm }]}>
          {title}
        </Text>
        <Text
          style={[
            styles.message,
            { color: colors.textPrimary, fontSize: typography.sizes.xs + 1, marginTop: 2 },
          ]}
        >
          {message}
        </Text>
      </View>

      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={[styles.actionBtn, { backgroundColor: typeStyle.border, borderRadius: borderRadius.sm }]}
          >
            <Text style={[styles.actionText, { color: '#FFFFFF', fontSize: typography.sizes.xs }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
});
