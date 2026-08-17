import { QueuedBookingItem, SyncState, BookingStateMachine } from './stateMachine';
import { NetworkManager } from './networkListener';

export type QueueSubscriber = (items: readonly QueuedBookingItem[]) => void;
export type ConflictRollbackHandler = (item: QueuedBookingItem, reason: string) => void;

export interface SyncExecutor {
  executeSync(item: QueuedBookingItem): Promise<{ success: boolean; conflict?: boolean; error?: string }>;
}

export class OfflineSyncQueue {
  private static instance: OfflineSyncQueue | null = null;
  private queue: QueuedBookingItem[] = [];
  private readonly subscribers: Set<QueueSubscriber> = new Set();
  private readonly conflictHandlers: Set<ConflictRollbackHandler> = new Set();
  private isProcessing: boolean = false;
  private simulateConflictMode: boolean = false;
  private executor: SyncExecutor | null = null;

  private constructor() {
    // Listen for reconnection
    NetworkManager.getInstance().subscribe((isOnline) => {
      if (isOnline && this.queue.length > 0) {
        this.processQueue().catch((err) => console.error('Failed to process offline queue on reconnection:', err));
      }
    });
  }

  public static getInstance(): OfflineSyncQueue {
    if (!OfflineSyncQueue.instance) {
      OfflineSyncQueue.instance = new OfflineSyncQueue();
    }
    return OfflineSyncQueue.instance;
  }

  public setExecutor(executor: SyncExecutor): void {
    this.executor = executor;
  }

  public setSimulateConflict(simulate: boolean): void {
    this.simulateConflictMode = simulate;
  }

  public isSimulatingConflict(): boolean {
    return this.simulateConflictMode;
  }

  public onConflictRollback(handler: ConflictRollbackHandler): () => void {
    this.conflictHandlers.add(handler);
    return () => {
      this.conflictHandlers.delete(handler);
    };
  }

  public subscribe(subscriber: QueueSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getItems());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getItems(): readonly QueuedBookingItem[] {
    return [...this.queue];
  }

  public enqueue<TPayload>(
    entityType: 'sports' | 'care',
    payload: TPayload,
    optimisticItem: Record<string, unknown>
  ): QueuedBookingItem<TPayload> {
    const isOnline = NetworkManager.getInstance().isOnline();
    const initialState: SyncState = isOnline ? 'SYNCING' : 'QUEUED';

    const item: QueuedBookingItem<TPayload> = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entityType,
      action: 'create_booking',
      payload,
      optimisticItem,
      createdAt: Date.now(),
      state: initialState,
    };

    this.queue.push(item as QueuedBookingItem);
    this.notify();

    if (isOnline) {
      this.processQueue().catch((err) => console.error('Queue execution failed:', err));
    }

    return item;
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || !NetworkManager.getInstance().isOnline() || !this.executor) {
      return;
    }

    this.isProcessing = true;
    this.notify();

    try {
      const itemsToProcess = [...this.queue];
      for (const item of itemsToProcess) {
        if (item.state === 'SUCCESS' || item.state === 'CONFLICT_REJECTED') {
          continue;
        }

        // Update state to SYNCING
        this.updateItemState(item.id, 'SYNCING');

        // Check if conflict simulation is active
        if (this.simulateConflictMode) {
          this.handleConflict(item, 'Simulated 409 Conflict: Concurrent double-booking rejected.');
          continue;
        }

        try {
          const result = await this.executor.executeSync(item);
          if (result.conflict) {
            this.handleConflict(item, result.error ?? 'Booking slot was filled by another participant (409 Conflict)');
          } else if (result.success) {
            this.updateItemState(item.id, 'SUCCESS');
            // Remove successful item after brief confirmation window
            setTimeout(() => {
              this.queue = this.queue.filter((q) => q.id !== item.id);
              this.notify();
            }, 1200);
          } else {
            // Keep in QUEUED state for retry
            this.updateItemState(item.id, 'QUEUED', result.error);
          }
        } catch (err) {
          const message = (err as Error).message;
          if (message.includes('409') || message.includes('Conflict')) {
            this.handleConflict(item, message);
          } else {
            this.updateItemState(item.id, 'QUEUED', message);
          }
        }
      }
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }

  private handleConflict(item: QueuedBookingItem, reason: string): void {
    this.updateItemState(item.id, 'CONFLICT_REJECTED', reason);
    // Notify conflict handlers to rollback optimistic state
    for (const handler of this.conflictHandlers) {
      handler(item, reason);
    }
  }

  private updateItemState(itemId: string, nextState: SyncState, error?: string): void {
    this.queue = this.queue.map((item) => {
      if (item.id === itemId) {
        const validatedState = BookingStateMachine.transition(item.state, nextState);
        return {
          ...item,
          state: validatedState,
          ...(error ? { error } : {}),
        };
      }
      return item;
    });
    this.notify();
  }

  public clear(): void {
    this.queue = [];
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getItems();
    for (const sub of this.subscribers) {
      sub(snapshot);
    }
  }
}
