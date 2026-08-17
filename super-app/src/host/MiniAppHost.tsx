import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MiniAppId } from '../kernel/types';
import { MiniAppRegistry } from '../kernel/registry';
import { createMiniAppSdk, HostNavigationDelegate } from '../kernel/sdk';
import { MiniAppErrorBoundary } from '../kernel/error/MiniAppErrorBoundary';
import { useAuthStore } from '../kernel/auth/authStore';
import { useTheme } from '../design-system/ThemeContext';
import { Button } from '../design-system/components/Button';

export interface MiniAppHostProps {
  readonly appId: MiniAppId;
  readonly initialParams?: Readonly<Record<string, unknown>>;
  readonly onExitToHost: () => void;
  readonly onNavigateToMiniApp: (targetAppId: MiniAppId, screen?: string, params?: Readonly<Record<string, unknown>>) => void;
}

export function MiniAppHost({
  appId,
  initialParams,
  onExitToHost,
  onNavigateToMiniApp,
}: MiniAppHostProps): React.ReactElement {
  const { colors, spacing } = useTheme();
  const authUser = useAuthStore((state) => state.user);

  const manifest = useMemo(() => {
    return MiniAppRegistry.getInstance().get(appId);
  }, [appId]);

  const sdk = useMemo(() => {
    if (!manifest) return null;

    const navDelegate: HostNavigationDelegate = {
      navigateWithinApp: (_id, _screen, _params) => {
        // Internal route handling
      },
      crossAppNavigate: (targetAppId, screen, params) => {
        onNavigateToMiniApp(targetAppId, screen, params);
      },
      goBack: () => {
        onExitToHost();
      },
    };

    return createMiniAppSdk(manifest, {
      getUserContext: () => {
        if (!authUser) return null;
        return {
          id: authUser.id,
          email: authUser.email,
          role: authUser.role,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          avatar: authUser.avatar,
        };
      },
      navigationDelegate: navDelegate,
    });
  }, [manifest, authUser, onExitToHost, onNavigateToMiniApp]);

  if (!manifest || !sdk) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.xl }]}>
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>
          Mini-App Not Found
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
          No registered manifest matching ID &quot;{appId}&quot;.
        </Text>
        <Button title="Back to Launcher" onPress={onExitToHost} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const EntryPoint = manifest.entryPoint;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MiniAppErrorBoundary
        appId={manifest.id}
        appName={manifest.name}
        onExitToHost={onExitToHost}
      >
        <EntryPoint sdk={sdk} initialParams={initialParams} />
      </MiniAppErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
