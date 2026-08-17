import { EventHandler, MiniAppId, UnsubscribeFn, WevBridgeApi } from '../types';
import { PermissionManager } from './permissions';

export interface BridgeEnvelope<T = unknown> {
  readonly senderAppId: MiniAppId;
  readonly event: string;
  readonly payload: T;
  readonly timestamp: number;
}

export type GlobalBridgeListener = (envelope: BridgeEnvelope) => void;

/**
 * Kernel Event Bus Engine
 * Central event distribution system enforcing security boundaries and routing events between mini-apps.
 */
export class KernelBridgeBus {
  private static instance: KernelBridgeBus | null = null;
  private readonly eventListeners: Map<string, Set<(envelope: BridgeEnvelope) => void>> = new Map();
  private readonly globalInspectors: Set<GlobalBridgeListener> = new Set();

  public static getInstance(): KernelBridgeBus {
    if (!KernelBridgeBus.instance) {
      KernelBridgeBus.instance = new KernelBridgeBus();
    }
    return KernelBridgeBus.instance;
  }

  public dispatch(envelope: BridgeEnvelope): void {
    // Notify global inspectors (e.g. Host debug log)
    for (const inspector of this.globalInspectors) {
      inspector(envelope);
    }

    const listeners = this.eventListeners.get(envelope.event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(envelope);
        } catch (err) {
          console.error(`[KernelBridge] Error in event listener for '${envelope.event}':`, err);
        }
      }
    }
  }

  public subscribe(event: string, handler: (envelope: BridgeEnvelope) => void): UnsubscribeFn {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const set = this.eventListeners.get(event)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.eventListeners.delete(event);
      }
    };
  }

  public addInspector(inspector: GlobalBridgeListener): UnsubscribeFn {
    this.globalInspectors.add(inspector);
    return () => {
      this.globalInspectors.delete(inspector);
    };
  }

  public clear(): void {
    this.eventListeners.clear();
    this.globalInspectors.clear();
  }
}

export class ScopedMiniAppBridge implements WevBridgeApi {
  private readonly appId: MiniAppId;
  private readonly permissions: PermissionManager;
  private readonly bus = KernelBridgeBus.getInstance();

  constructor(appId: MiniAppId, permissions: PermissionManager) {
    this.appId = appId;
    this.permissions = permissions;
  }

  public emit<T = unknown>(event: string, payload: T): void {
    this.permissions.assertPermission('bridge:interapp', `wev.bridge.emit(${event})`);

    const envelope: BridgeEnvelope<T> = {
      senderAppId: this.appId,
      event,
      payload,
      timestamp: Date.now(),
    };

    this.bus.dispatch(envelope as BridgeEnvelope<unknown>);
  }

  public on<T = unknown>(event: string, handler: EventHandler<T>): UnsubscribeFn {
    this.permissions.assertPermission('bridge:interapp', `wev.bridge.on(${event})`);

    return this.bus.subscribe(event, (envelope) => {
      handler(envelope.payload as T);
    });
  }
}
