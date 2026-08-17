import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../design-system/ThemeContext';
import { useAuthStore } from '../kernel/auth/authStore';

export interface HeaderProps {
  readonly activeMiniAppName?: string;
  readonly onBackToHub?: () => void;
  readonly onToggleDebugPanel: () => void;
  readonly isDebugOpen: boolean;
}

export function Header({
  activeMiniAppName,
  onBackToHub,
  onToggleDebugPanel,
  isDebugOpen,
}: HeaderProps): React.ReactElement {
  const { colors, spacing, borderRadius, typography, mode, toggleTheme } = useTheme();
  const user = useAuthStore((state) => state.user);

  const getRoleBadgeColor = (role?: string): string => {
    switch (role) {
      case 'host_admin':
        return '#8B5CF6';
      case 'member':
        return '#3B82F6';
      case 'guest':
      default:
        return '#64748B';
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
      <View style={styles.leftSection}>
        {onBackToHub && (
          <TouchableOpacity
            onPress={onBackToHub}
            style={[styles.backBtn, { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
              ← Hub
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ marginLeft: onBackToHub ? spacing.sm : 0 }}>
          <Text style={[styles.logo, { color: colors.textPrimary, fontSize: typography.sizes.lg }]}>
            WEV<Text style={{ color: colors.primary }}>SOCIAL</Text>
          </Text>
          {activeMiniAppName && (
            <Text style={[styles.currentApp, { color: colors.textMuted, fontSize: typography.sizes.xs }]}>
              / {activeMiniAppName}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {/* User Role Badge */}
        {user && (
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor: `${getRoleBadgeColor(user.role)}20`,
                borderColor: getRoleBadgeColor(user.role),
                borderRadius: borderRadius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              },
            ]}
          >
            <Text style={{ color: getRoleBadgeColor(user.role), fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
              {user.role}
            </Text>
          </View>
        )}

        {/* Theme Mode Toggle */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.actionIconBtn, { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
            {mode === 'dark' ? '🌙' : '☀️'}
          </Text>
        </TouchableOpacity>

        {/* Debug Panel Toggle Button */}
        <TouchableOpacity
          onPress={onToggleDebugPanel}
          style={[
            styles.debugBtn,
            {
              backgroundColor: isDebugOpen ? colors.primary : colors.surfaceElevated,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <Text style={{ color: isDebugOpen ? '#FFFFFF' : colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
            🛠 Kernel Debug
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {},
  logo: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentApp: {
    fontWeight: '600',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    borderWidth: 1,
  },
  actionIconBtn: {},
  debugBtn: {},
});
