import { MiniAppRegistry } from '../src/kernel/registry';
import { defineMiniApp } from '../src/kernel/manifest';
import { createMiniAppSdk } from '../src/kernel/sdk';
import { BookingStateMachine } from '../src/kernel/offline/stateMachine';
import { OfflineSyncQueue } from '../src/kernel/offline/syncQueue';
import { NetworkManager } from '../src/kernel/offline/networkListener';
import { SecurityError, MiniAppManifest } from '../src/kernel/types';
import type { QueuedBookingItem } from '../src/kernel/offline/stateMachine';
import React from 'react';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`SuperApp Assertion Failed: ${message}`);
  }
}

async function runSuperAppTests(): Promise<void> {
  console.log('--- STARTING SUPER-APP KERNEL COMPREHENSIVE TEST SUITE ---');

  // 1. Test MiniAppRegistry Dynamic Discovery & Zero-Code N+1 Scalability
  console.log('1. Testing MiniAppRegistry Discovery & N+1 Scalability...');
  const registry = MiniAppRegistry.getInstance();
  registry.clear();

  const dummyApp1: MiniAppManifest = defineMiniApp({
    id: 'wev.sports',
    name: 'Sports',
    version: '1.0.0',
    description: 'Sports app',
    icon: 'Activity',
    accentColor: '#3B82F6',
    requiredPermissions: ['auth:profile:read', 'storage:scoped', 'bridge:interapp'],
    entryPoint: () => React.createElement('div', null, 'Sports'),
  });

  const dummyApp2: MiniAppManifest = defineMiniApp({
    id: 'wev.care',
    name: 'Care',
    version: '1.0.0',
    description: 'Care app',
    icon: 'Heart',
    accentColor: '#10B981',
    requiredPermissions: ['auth:profile:read', 'storage:scoped', 'bridge:interapp', 'location:obfuscated'],
    entryPoint: () => React.createElement('div', null, 'Care'),
  });

  const dummyApp3: MiniAppManifest = defineMiniApp({
    id: 'wev.events',
    name: 'Events',
    version: '1.0.0',
    description: 'Events stub',
    icon: 'Calendar',
    accentColor: '#8B5CF6',
    requiredPermissions: ['auth:profile:read'],
    entryPoint: () => React.createElement('div', null, 'Events'),
  });

  registry.register(dummyApp1);
  registry.register(dummyApp2);
  registry.register(dummyApp3);

  assert(registry.getAll().length === 3, 'Registry must contain exactly 3 apps');

  // Hypothetical 4th Mini-App addition at runtime
  const dummyApp4: MiniAppManifest = defineMiniApp({
    id: 'wev.music',
    name: 'Music & Concerts',
    version: '1.0.0',
    description: 'Hypothetical 4th mini-app',
    icon: 'Music',
    accentColor: '#EC4899',
    requiredPermissions: ['auth:profile:read', 'storage:scoped'],
    entryPoint: () => React.createElement('div', null, 'Music'),
  });

  registry.register(dummyApp4);
  assert(registry.getAll().length === 4, 'Registry must now contain 4 apps');
  assert(registry.get('wev.music')?.name === 'Music & Concerts', '4th app must be retrievable');
  console.log('✓ Runtime Registry passed: Dynamic discovery and N+1 scaling verified without shell/app alterations.');

  // 2. Test Injected SDK Capability Boundary & Permissions Gatekeeper
  console.log('2. Testing Injected SDK Capability Boundary & Permission Enforcement...');
  const hostUser = {
    id: 'usr_member_01',
    email: 'alex@wevsocial.com',
    role: 'member' as const,
    firstName: 'Alex',
    lastName: 'Rivera',
    avatar: null,
  };

  const navDelegate = {
    navigateWithinApp: () => {},
    crossAppNavigate: () => {},
    goBack: () => {},
  };

  // Mini-App A with full permissions (including 'auth:email:read')
  const appA_Manifest: MiniAppManifest = {
    ...dummyApp1,
    requiredPermissions: ['auth:profile:read', 'auth:email:read', 'storage:scoped', 'bridge:interapp'],
  };
  const sdkA = createMiniAppSdk(appA_Manifest, {
    getUserContext: () => hostUser,
    navigationDelegate: navDelegate,
  });

  // Mini-App B with limited permissions (no 'auth:email:read', no 'storage:scoped')
  const appB_Manifest: MiniAppManifest = {
    ...dummyApp2,
    requiredPermissions: ['auth:profile:read', 'bridge:interapp'],
  };
  const sdkB = createMiniAppSdk(appB_Manifest, {
    getUserContext: () => hostUser,
    navigationDelegate: navDelegate,
  });

  // Test Scoped Auth
  const userA = await sdkA.auth.getUser();
  assert(userA.firstName === 'Alex', 'Mini-App A must read profile');
  assert(userA.email === 'alex@wevsocial.com', 'Mini-App A with email permission must receive email');

  const userB = await sdkB.auth.getUser();
  assert(userB.firstName === 'Alex', 'Mini-App B must read profile');
  assert(userB.email === undefined, 'Mini-App B WITHOUT email permission MUST NOT receive email');

  // Test Namespaced Storage Isolation
  await sdkA.storage.set('favorite_sport', 'tennis');
  const storedInA = await sdkA.storage.get<string>('favorite_sport');
  assert(storedInA === 'tennis', 'Mini-App A must retrieve its own stored key');

  // Mini-App B lacks 'storage:scoped' permission -> must be blocked
  let storageBlocked = false;
  try {
    await sdkB.storage.get('favorite_sport');
  } catch (err) {
    if (err instanceof SecurityError && err.requiredPermission === 'storage:scoped') {
      storageBlocked = true;
    }
  }
  assert(storageBlocked, 'Mini-App B must be blocked from storage without permission');

  // Test Storage Key Isolation across two apps with permission
  const appC_Manifest: MiniAppManifest = {
    ...dummyApp3,
    requiredPermissions: ['storage:scoped', 'auth:profile:read'],
  };
  const sdkC = createMiniAppSdk(appC_Manifest, {
    getUserContext: () => hostUser,
    navigationDelegate: navDelegate,
  });
  const storedInC = await sdkC.storage.get<string>('favorite_sport');
  assert(storedInC === null, 'Mini-App C MUST NOT see keys stored by Mini-App A');
  console.log('✓ Capability Boundary passed: Scoped auth, namespaced storage isolation, and permission guards validated.');

  // 3. Test Inter-App Bridge Communication & Cross-App Handoff
  console.log('3. Testing Inter-App Bridge Event Dispatch & Subscription...');
  let receivedPayload: unknown = null;
  const unsubscribe = sdkB.bridge.on<{ activityId: string; title: string }>('sports:booking_created', (payload) => {
    receivedPayload = payload;
  });

  sdkA.bridge.emit('sports:booking_created', { activityId: 'act_tennis_01', title: 'Sunset Tennis Doubles' });
  assert(
    receivedPayload !== null &&
      (receivedPayload as { activityId: string }).activityId === 'act_tennis_01',
    'Mini-App B must receive bridge event emitted by Mini-App A'
  );

  // Test Unsubscribe
  receivedPayload = null;
  unsubscribe();
  sdkA.bridge.emit('sports:booking_created', { activityId: 'act_tennis_02', title: 'Morning Tennis' });
  assert(receivedPayload === null, 'Handler must not be called after unsubscribe');
  console.log('✓ Inter-App Bridge passed: Event emission, cross-app dispatch, and cleanup verified.');

  // 4. Test Offline Sync State Machine & 409 Conflict Rollback
  console.log('4. Testing Offline Sync State Machine Transitions...');
  // IDLE -> QUEUED -> SYNCING -> SUCCESS
  assert(BookingStateMachine.isValidTransition('IDLE', 'QUEUED'), 'IDLE -> QUEUED is valid');
  assert(BookingStateMachine.isValidTransition('QUEUED', 'SYNCING'), 'QUEUED -> SYNCING is valid');
  assert(BookingStateMachine.isValidTransition('SYNCING', 'SUCCESS'), 'SYNCING -> SUCCESS is valid');
  assert(BookingStateMachine.isValidTransition('SYNCING', 'CONFLICT_REJECTED'), 'SYNCING -> CONFLICT_REJECTED is valid');
  assert(!BookingStateMachine.isValidTransition('IDLE', 'SUCCESS'), 'IDLE -> SUCCESS directly is illegal');

  console.log('Testing Offline Queueing, Reconnection, and 409 Conflict Handling...');
  const queue = OfflineSyncQueue.getInstance();
  queue.clear();

  const netManager = NetworkManager.getInstance();

  // Test Offline Enqueue
  netManager.setForceOffline(true);
  const queuedItem = queue.enqueue('sports', { activityId: 'act_test' }, { title: 'Test Activity' });
  assert(queuedItem.state === 'QUEUED', 'Item must be in QUEUED state when offline');

  let conflictRolledBack = false;
  queue.onConflictRollback((_item: QueuedBookingItem, _reason: string) => {
    conflictRolledBack = true;
  });

  // Enable 409 simulation and go online
  queue.setSimulateConflict(true);
  queue.setExecutor({
    executeSync: async () => ({ success: false, conflict: true, error: 'Simulated 409 Conflict' }),
  });

  netManager.setForceOffline(false);
  await queue.processQueue();

  assert(conflictRolledBack, '409 Conflict must trigger rollback handler');
  const finalItems = queue.getItems();
  assert(
    finalItems.some((i: QueuedBookingItem) => i.state === 'CONFLICT_REJECTED'),
    'Queued item must transition to CONFLICT_REJECTED'
  );
  console.log('✓ Offline Sync State Machine passed: Offline queueing, state transitions, and 409 rollback validated.');

  console.log('\n🎉 ALL SUPER-APP KERNEL TESTS PASSED (100% SUCCESS)\n');
}

runSuperAppTests().catch((err) => {
  console.error('SuperApp Test Suite Failed:', err);
  process.exit(1);
});
