import { MiniAppId, MiniAppManifest } from './types';

export type RegistryListener = (manifests: readonly MiniAppManifest[]) => void;

/**
 * Runtime Mini-App Registry
 * Manages mini-app discovery, dynamic loading, metadata query, and registry lifecycle.
 */
export class MiniAppRegistry {
  private static instance: MiniAppRegistry | null = null;
  private readonly manifests: Map<MiniAppId, MiniAppManifest> = new Map();
  private readonly listeners: Set<RegistryListener> = new Set();

  private constructor() {}

  public static getInstance(): MiniAppRegistry {
    if (!MiniAppRegistry.instance) {
      MiniAppRegistry.instance = new MiniAppRegistry();
    }
    return MiniAppRegistry.instance;
  }

  /**
   * Register a new mini-app manifest into the runtime registry.
   */
  public register(manifest: MiniAppManifest): void {
    if (this.manifests.has(manifest.id)) {
      console.warn(`Mini-App '${manifest.id}' is already registered. Updating registration.`);
    }
    this.manifests.set(manifest.id, manifest);
    this.notifyListeners();
  }

  /**
   * Unregister a mini-app from the runtime registry.
   */
  public unregister(appId: MiniAppId): boolean {
    const deleted = this.manifests.delete(appId);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Retrieve a specific mini-app manifest by ID.
   */
  public get(appId: MiniAppId): MiniAppManifest | undefined {
    return this.manifests.get(appId);
  }

  /**
   * Return all currently registered mini-app manifests.
   */
  public getAll(): readonly MiniAppManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Check if a mini-app is registered.
   */
  public has(appId: MiniAppId): boolean {
    return this.manifests.has(appId);
  }

  /**
   * Subscribe to registry changes (e.g. dynamic app installation).
   */
  public subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const all = this.getAll();
    for (const listener of this.listeners) {
      listener(all);
    }
  }

  /**
   * Clear registry (useful for testing).
   */
  public clear(): void {
    this.manifests.clear();
    this.notifyListeners();
  }
}
