import React from 'react';

/**
 * WEVSOCIAL Core Kernel Type Definitions
 * 100% Strict TypeScript - Zero `any` types.
 */

export type MiniAppPermission =
  | 'auth:profile:read'
  | 'auth:email:read'
  | 'storage:scoped'
  | 'bridge:interapp'
  | 'location:obfuscated'
  | 'notifications:send';

export type MiniAppId = string;

export interface MiniAppProps {
  readonly sdk: WevSdk;
  readonly initialParams?: Readonly<Record<string, unknown>>;
}

export interface MiniAppManifest {
  readonly id: MiniAppId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly icon: string;
  readonly accentColor: string;
  readonly requiredPermissions: readonly MiniAppPermission[];
  readonly entryPoint: React.ComponentType<MiniAppProps>;
}

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface UserScopedProfile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar: string | null;
  readonly role: 'guest' | 'member' | 'host_admin';
  // Email is only exposed if 'auth:email:read' permission is granted
  readonly email?: string;
}

export type EventHandler<T = unknown> = (payload: T) => void;
export type UnsubscribeFn = () => void;

export interface NavigationTarget {
  readonly miniAppId?: MiniAppId;
  readonly screen?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface WevAuthApi {
  getUser(): Promise<UserScopedProfile>;
}

export interface WevStorageApi {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WevNavigationApi {
  navigate(target: NavigationTarget | string, params?: Readonly<Record<string, unknown>>): void;
  goBack(): void;
}

export interface WevBridgeApi {
  emit<T = unknown>(event: string, payload: T): void;
  on<T = unknown>(event: string, handler: EventHandler<T>): UnsubscribeFn;
}

export interface WevPermissionsApi {
  request(permission: MiniAppPermission): Promise<PermissionStatus>;
  has(permission: MiniAppPermission): boolean;
  getAllGranted(): readonly MiniAppPermission[];
}

export interface WevSdk {
  readonly appId: MiniAppId;
  readonly manifest: Readonly<MiniAppManifest>;
  readonly auth: WevAuthApi;
  readonly storage: WevStorageApi;
  readonly nav: WevNavigationApi;
  readonly bridge: WevBridgeApi;
  readonly permissions: WevPermissionsApi;
}

export class SecurityError extends Error {
  public readonly requiredPermission: MiniAppPermission;
  public readonly appId: MiniAppId;

  constructor(appId: MiniAppId, requiredPermission: MiniAppPermission, message?: string) {
    super(
      message ??
        `Security Boundary Violation: Mini-App '${appId}' was blocked from calling API because permission '${requiredPermission}' is not granted.`
    );
    this.name = 'SecurityError';
    this.appId = appId;
    this.requiredPermission = requiredPermission;
  }
}
