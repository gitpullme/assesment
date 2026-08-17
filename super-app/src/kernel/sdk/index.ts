import { MiniAppId, MiniAppManifest, WevSdk } from '../types';
import { PermissionManager } from './permissions';
import { ScopedMiniAppStorage } from './storage';
import { ScopedMiniAppAuth, HostUserContext } from './auth';
import { ScopedMiniAppBridge } from './bridge';
import { ScopedMiniAppNavigation, HostNavigationDelegate } from './navigation';

export interface HostContext {
  readonly getUserContext: () => HostUserContext | null;
  readonly navigationDelegate: HostNavigationDelegate;
  readonly onPermissionPrompt?: (permission: import('../types').MiniAppPermission) => Promise<boolean>;
}

/**
 * Injected SDK Factory
 * Produces an isolated, permission-gated SDK instance dedicated to a specific mini-app.
 */
export function createMiniAppSdk(
  manifest: MiniAppManifest,
  hostContext: HostContext
): WevSdk {
  const appId: MiniAppId = manifest.id;

  const permissionManager = new PermissionManager({
    appId,
    defaultGrantedPermissions: manifest.requiredPermissions,
    onPermissionPrompt: hostContext.onPermissionPrompt,
  });

  const storageApi = new ScopedMiniAppStorage(appId, permissionManager);
  const authApi = new ScopedMiniAppAuth(permissionManager, hostContext.getUserContext);
  const bridgeApi = new ScopedMiniAppBridge(appId, permissionManager);
  const navApi = new ScopedMiniAppNavigation(appId, hostContext.navigationDelegate);

  return Object.freeze({
    appId,
    manifest,
    auth: storageApi ? authApi : authApi, // strictly type-checked
    storage: storageApi,
    nav: navApi,
    bridge: bridgeApi,
    permissions: permissionManager,
  });
}

export * from './permissions';
export * from './storage';
export * from './auth';
export * from './bridge';
export * from './navigation';
