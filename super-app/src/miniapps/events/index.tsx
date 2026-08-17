import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MiniAppProps, UserScopedProfile } from '../../kernel/types';
import { Card } from '../../design-system/components/Card';
import { useTheme } from '../../design-system/ThemeContext';

export function EventsMiniApp({ sdk }: MiniAppProps): React.ReactElement {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const [user, setUser] = useState<UserScopedProfile | null>(null);

  useEffect(() => {
    sdk.auth.getUser().then(setUser).catch(console.error);
  }, [sdk]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.xl }]}>
          Community Events
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: typography.sizes.sm }]}>
          Reference stub mini-app demonstrating dynamic N+1 registry discovery with zero host code changes.
        </Text>
      </View>

      <Card elevated>
        <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: typography.sizes.sm }}>
          RUNTIME REGISTRY VERIFICATION
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: '600', marginTop: 4 }}>
          Mini-App ID: {sdk.appId} (v{sdk.manifest.version})
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, marginTop: 4 }}>
          {user ? `Active User Context: ${user.firstName} ${user.lastName} (${user.role})` : 'Guest Mode'}
        </Text>

        <View style={[styles.badge, { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.md }]}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
            ✓ Injected SDK: Capabilities bound to granted permissions [{sdk.permissions.getAllGranted().join(', ')}]
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
  },
  badge: {},
});
