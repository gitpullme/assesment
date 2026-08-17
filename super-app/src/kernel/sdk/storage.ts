import { MiniAppId, WevStorageApi } from '../types';
import { PermissionManager } from './permissions';

/**
 * In-memory / persistent namespaced storage adapter.
 * Each Mini-App gets an isolated key prefix: `__wev_app_${appId}_${key}`
 */
class HostStorageEngine {
  private static instance: HostStorageEngine | null = null;
  private readonly store: Map<string, string> = new Map();

  public static getInstance(): HostStorageEngine {
    if (!HostStorageEngine.instance) {
      HostStorageEngine.instance = new HostStorageEngine();
    }
    return HostStorageEngine.instance;
  }

  public getRaw(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return this.store.get(key) ?? null;
  }

  public setRaw(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    this.store.set(key, value);
  }

  public removeRaw(key: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    this.store.delete(key);
  }

  public clearPrefix(prefix: string): void {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    }

    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }
}

export class ScopedMiniAppStorage implements WevStorageApi {
  private readonly prefix: string;
  private readonly permissions: PermissionManager;
  private readonly hostStorage = HostStorageEngine.getInstance();

  constructor(appId: MiniAppId, permissions: PermissionManager) {
    this.prefix = `__wev_app_${appId}__`;
    this.permissions = permissions;
  }

  public async get<T = unknown>(key: string): Promise<T | null> {
    this.permissions.assertPermission('storage:scoped', 'wev.storage.get');
    const namespacedKey = `${this.prefix}${key}`;
    const raw = this.hostStorage.getRaw(namespacedKey);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  public async set<T = unknown>(key: string, value: T): Promise<void> {
    this.permissions.assertPermission('storage:scoped', 'wev.storage.set');
    const namespacedKey = `${this.prefix}${key}`;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.hostStorage.setRaw(namespacedKey, serialized);
  }

  public async remove(key: string): Promise<void> {
    this.permissions.assertPermission('storage:scoped', 'wev.storage.remove');
    const namespacedKey = `${this.prefix}${key}`;
    this.hostStorage.removeRaw(namespacedKey);
  }

  public async clear(): Promise<void> {
    this.permissions.assertPermission('storage:scoped', 'wev.storage.clear');
    this.hostStorage.clearPrefix(this.prefix);
  }
}
