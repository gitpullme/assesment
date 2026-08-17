export type NetworkStateListener = (isOnline: boolean) => void;

/**
 * Network Connectivity Manager & Simulator
 */
export class NetworkManager {
  private static instance: NetworkManager | null = null;
  private isOnlineState: boolean = true;
  private forceOfflineMode: boolean = false;
  private readonly listeners: Set<NetworkStateListener> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleSystemStatus(true));
      window.addEventListener('offline', () => this.handleSystemStatus(false));
      this.isOnlineState = navigator.onLine ?? true;
    }
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  public isOnline(): boolean {
    if (this.forceOfflineMode) return false;
    return this.isOnlineState;
  }

  public setForceOffline(offline: boolean): void {
    this.forceOfflineMode = offline;
    this.notify();
  }

  public isForceOffline(): boolean {
    return this.forceOfflineMode;
  }

  private handleSystemStatus(online: boolean): void {
    this.isOnlineState = online;
    this.notify();
  }

  public subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.isOnline();
    for (const listener of this.listeners) {
      listener(current);
    }
  }
}
