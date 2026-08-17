import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../design-system/ThemeContext';
import { useAuthStore } from '../kernel/auth/authStore';
import { NetworkManager } from '../kernel/offline/networkListener';
import { OfflineSyncQueue } from '../kernel/offline/syncQueue';
import { QueuedBookingItem } from '../kernel/offline/stateMachine';
import { KernelBridgeBus, BridgeEnvelope } from '../kernel/sdk/bridge';
import { AuthRepository } from '../repositories/auth.repository';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';

export function DebugPanel(): React.ReactElement {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const authUser = useAuthStore((state) => state.user);
  const setRole = useAuthStore((state) => state.setRoleForTesting);

  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [is409Simulated, setIs409Simulated] = useState<boolean>(false);
  const [queueItems, setQueueItems] = useState<readonly QueuedBookingItem[]>([]);
  const [bridgeLogs, setBridgeLogs] = useState<readonly BridgeEnvelope[]>([]);
  const [rbacResult, setRbacResult] = useState<{ status: string; data?: unknown; error?: string } | null>(null);

  useEffect(() => {
    const netManager = NetworkManager.getInstance();
    setIsOffline(!netManager.isOnline());

    const syncQueue = OfflineSyncQueue.getInstance();
    setIs409Simulated(syncQueue.isSimulatingConflict());

    const unsubQueue = syncQueue.subscribe(setQueueItems);
    const unsubBridge = KernelBridgeBus.getInstance().addInspector((env) => {
      setBridgeLogs((prev) => [env, ...prev.slice(0, 9)]);
    });

    return () => {
      unsubQueue();
      unsubBridge();
    };
  }, []);

  const handleToggleOffline = () => {
    const nextState = !isOffline;
    setIsOffline(nextState);
    NetworkManager.getInstance().setForceOffline(nextState);
  };

  const handleToggle409 = () => {
    const nextState = !is409Simulated;
    setIs409Simulated(nextState);
    OfflineSyncQueue.getInstance().setSimulateConflict(nextState);
  };

  const handleTestRbacEndpoint = async () => {
    setRbacResult({ status: 'TESTING...' });
    try {
      const data = await AuthRepository.getHostOnlyAdminData();
      setRbacResult({ status: '200 OK (ACCESS GRANTED)', data });
    } catch (err) {
      setRbacResult({
        status: '403 FORBIDDEN (SECURITY GUARD REJECTED)',
        error: (err as Error).message,
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border, padding: spacing.md }]}>
      <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.md }]}>
        🛠 WEVSOCIAL Kernel Architecture & Security Inspector
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
        {/* Network & Offline State Controls */}
        <Card elevated style={{ width: 280, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
            1. Network & Offline State
          </Text>
          <Text style={{ color: isOffline ? colors.danger : colors.success, fontSize: typography.sizes.xs, fontWeight: '700', marginVertical: 4 }}>
            Status: {isOffline ? 'OFFLINE (FORCED)' : 'ONLINE'}
          </Text>
          <Button
            title={isOffline ? 'Go Online (Replay Queue)' : 'Simulate Offline Mode'}
            onPress={handleToggleOffline}
            variant={isOffline ? 'primary' : 'outline'}
            size="sm"
          />
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
            Offline Queue: {queueItems.length} items ({queueItems.filter((q) => q.state === 'QUEUED').length} queued, {queueItems.filter((q) => q.state === 'SYNCING').length} syncing)
          </Text>
        </Card>

        {/* 409 Double-Booking Conflict Simulator */}
        <Card elevated style={{ width: 280, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
            2. Double-Booking 409 Simulator
          </Text>
          <Text style={{ color: is409Simulated ? colors.warning : colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: '700', marginVertical: 4 }}>
            Simulation: {is409Simulated ? 'ACTIVE (Will reject with 409)' : 'INACTIVE'}
          </Text>
          <Button
            title={is409Simulated ? 'Disable 409 Simulation' : 'Enable 409 Mock Conflict'}
            onPress={handleToggle409}
            variant={is409Simulated ? 'danger' : 'outline'}
            size="sm"
          />
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
            Triggers atomic optimistic rollback and CONFLICT_REJECTED state.
          </Text>
        </Card>

        {/* RBAC & Role Switcher */}
        <Card elevated style={{ width: 320, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
            3. Identity & RBAC Guard
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginVertical: 2 }}>
            Current Role: <Text style={{ fontWeight: '700', color: colors.primary }}>{authUser?.role ?? 'None'}</Text>
          </Text>
          <View style={styles.rolesRow}>
            {(['guest', 'member', 'host_admin'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: authUser?.role === r ? colors.primary : colors.surfaceHover,
                    borderRadius: borderRadius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  },
                ]}
              >
                <Text style={{ color: authUser?.role === r ? '#FFFFFF' : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            title="Test Admin Endpoint (/api/admin/host-only)"
            onPress={handleTestRbacEndpoint}
            variant="outline"
            size="sm"
            style={{ marginTop: 6 }}
          />
          {rbacResult && (
            <Text
              style={{
                color: rbacResult.status.includes('200') ? colors.success : colors.danger,
                fontSize: 11,
                fontFamily: 'monospace',
                marginTop: 4,
              }}
            >
              {rbacResult.status}
            </Text>
          )}
        </Card>

        {/* Live Kernel Event Bus Monitor */}
        <Card elevated style={{ width: 340, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: typography.sizes.sm }}>
            4. Bridge Event Bus (Live Stream)
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
            Inter-mini-app communications recorded in real-time:
          </Text>
          <ScrollView style={{ maxHeight: 70 }}>
            {bridgeLogs.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>
                No events emitted yet. Book a session in Sports to observe!
              </Text>
            ) : (
              bridgeLogs.map((log, i) => (
                <Text key={i} style={{ color: colors.accent, fontSize: 10, fontFamily: 'monospace' }}>
                  [{log.senderAppId}] → &quot;{log.event}&quot;
                </Text>
              ))
            )}
          </ScrollView>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  roleChip: {},
});
