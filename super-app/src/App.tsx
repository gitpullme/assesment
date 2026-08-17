import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MiniAppRegistry } from './kernel/registry';
import { SportsManifest } from './miniapps/sports/manifest';
import { CareManifest } from './miniapps/care/manifest';
import { EventsManifest } from './miniapps/events/manifest';
import { ThemeProvider, useTheme } from './design-system/ThemeContext';
import { Header } from './host/Header';
import { AppLauncher } from './host/AppLauncher';
import { MiniAppHost } from './host/MiniAppHost';
import { DebugPanel } from './host/DebugPanel';
import { OfflineSyncQueue } from './kernel/offline/syncQueue';
import { SportsRepository } from './repositories/sports.repository';
import { CareRepository } from './repositories/care.repository';
import { MiniAppId } from './kernel/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

// Initialize Registry with Reference Mini-Apps
MiniAppRegistry.getInstance().register(SportsManifest);
MiniAppRegistry.getInstance().register(CareManifest);
MiniAppRegistry.getInstance().register(EventsManifest);

// Wire OfflineSyncQueue to execute real backend bookings upon sync
OfflineSyncQueue.getInstance().setExecutor({
  executeSync: async (item) => {
    try {
      if (item.entityType === 'sports') {
        const payload = item.payload as { activityId: string; simulateConflict?: boolean };
        await SportsRepository.directBookActivity(payload.activityId, payload.simulateConflict);
        return { success: true };
      } else if (item.entityType === 'care') {
        const payload = item.payload as { providerId: string; startTime: string; endTime: string; notes?: string };
        await CareRepository.directBookProvider(payload.providerId, payload.startTime, payload.endTime, payload.notes);
        return { success: true };
      }
      return { success: true };
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('409') || msg.includes('Conflict') || msg.includes('full')) {
        return { success: false, conflict: true, error: msg };
      }
      return { success: false, error: msg };
    }
  },
});

function SuperAppContent(): React.ReactElement {
  const { colors, mode } = useTheme();
  const [activeAppId, setActiveAppId] = useState<MiniAppId | null>(null);
  const [activeAppParams, setActiveAppParams] = useState<Readonly<Record<string, unknown>> | undefined>(undefined);
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);

  const activeManifest = activeAppId ? MiniAppRegistry.getInstance().get(activeAppId) : undefined;

  const handleLaunchApp = (appId: MiniAppId, params?: Readonly<Record<string, unknown>>) => {
    setActiveAppId(appId);
    setActiveAppParams(params);
  };

  const handleBackToHub = () => {
    setActiveAppId(null);
    setActiveAppParams(undefined);
  };

  const handleCrossAppNavigate = (targetAppId: MiniAppId, _screen?: string, params?: Readonly<Record<string, unknown>>) => {
    setActiveAppId(targetAppId);
    setActiveAppParams(params);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Top Application Bar */}
      <Header
        activeMiniAppName={activeManifest?.name}
        onBackToHub={activeAppId ? handleBackToHub : undefined}
        onToggleDebugPanel={() => setIsDebugOpen((prev) => !prev)}
        isDebugOpen={isDebugOpen}
      />

      {/* Optional Debug & Security Panel */}
      {isDebugOpen && <DebugPanel />}

      {/* Content View: AppLauncher or Isolated MiniAppHost */}
      <View style={styles.body}>
        {activeAppId ? (
          <MiniAppHost
            appId={activeAppId}
            initialParams={activeAppParams}
            onExitToHost={handleBackToHub}
            onNavigateToMiniApp={handleCrossAppNavigate}
          />
        ) : (
          <AppLauncher onLaunchApp={handleLaunchApp} />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SuperAppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
