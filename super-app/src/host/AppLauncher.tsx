import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MiniAppManifest } from '../kernel/types';
import { MiniAppRegistry } from '../kernel/registry';
import { Card } from '../design-system/components/Card';
import { useTheme } from '../design-system/ThemeContext';

export interface AppLauncherProps {
  readonly onLaunchApp: (appId: string) => void;
}

export function AppLauncher({ onLaunchApp }: AppLauncherProps): React.ReactElement {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [manifests, setManifests] = useState<readonly MiniAppManifest[]>([]);

  useEffect(() => {
    const registry = MiniAppRegistry.getInstance();
    const unsubscribe = registry.subscribe(setManifests);
    return () => unsubscribe();
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={[styles.heroBadge, { color: colors.primary, fontSize: typography.sizes.xs }]}>
          WEVSOCIAL SUPER-APP KERNEL
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.display }]}>
          Mini-App Hub
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.md }]}>
          Independent mini-apps running inside a sandboxed native kernel with strict capability boundaries.
        </Text>
      </View>

      <View style={styles.grid}>
        {manifests.map((app) => (
          <TouchableOpacity
            key={app.id}
            onPress={() => onLaunchApp(app.id)}
            activeOpacity={0.8}
            style={{ marginBottom: spacing.md }}
          >
            <Card elevated style={{ borderColor: colors.border }}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: app.accentColor,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>
                    {app.name.charAt(0)}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[styles.appName, { color: colors.textPrimary, fontSize: typography.sizes.lg }]}>
                    {app.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
                    ID: {app.id} • v{app.version}
                  </Text>
                </View>

                <View style={[styles.launchBadge, { backgroundColor: colors.surfaceHover, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}>
                  <Text style={{ color: colors.primary, fontSize: typography.sizes.xs, fontWeight: '700' }}>
                    OPEN →
                  </Text>
                </View>
              </View>

              <Text style={[styles.appDesc, { color: colors.textSecondary, fontSize: typography.sizes.sm, marginVertical: spacing.sm }]}>
                {app.description}
              </Text>

              {/* Permission tags */}
              <View style={[styles.permsRow, { marginTop: spacing.xs }]}>
                {app.requiredPermissions.map((perm) => (
                  <View
                    key={perm}
                    style={[
                      styles.permChip,
                      {
                        backgroundColor: colors.surfaceHover,
                        borderRadius: borderRadius.sm,
                        paddingHorizontal: spacing.xs + 2,
                        paddingVertical: 2,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>
                      {perm}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBadge: {
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 22,
  },
  grid: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontWeight: '700',
  },
  launchBadge: {},
  appDesc: {
    lineHeight: 20,
  },
  permsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  permChip: {},
});
