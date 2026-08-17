/**
 * Offline Sync State Machine
 * Strict Transitions: IDLE -> QUEUED -> SYNCING -> SUCCESS | CONFLICT_REJECTED
 */

export type SyncState = 'IDLE' | 'QUEUED' | 'SYNCING' | 'SUCCESS' | 'CONFLICT_REJECTED';

export interface QueuedBookingItem<TPayload = unknown> {
  readonly id: string;
  readonly entityType: 'sports' | 'care';
  readonly action: 'create_booking';
  readonly payload: TPayload;
  readonly optimisticItem: Record<string, unknown>;
  readonly createdAt: number;
  readonly state: SyncState;
  readonly error?: string;
}

export class BookingStateMachine {
  public static isValidTransition(current: SyncState, next: SyncState): boolean {
    switch (current) {
      case 'IDLE':
        return next === 'QUEUED' || next === 'SYNCING';
      case 'QUEUED':
        return next === 'SYNCING' || next === 'IDLE';
      case 'SYNCING':
        return next === 'SUCCESS' || next === 'CONFLICT_REJECTED' || next === 'QUEUED';
      case 'SUCCESS':
        return next === 'IDLE';
      case 'CONFLICT_REJECTED':
        return next === 'IDLE' || next === 'QUEUED';
      default:
        return false;
    }
  }

  public static transition(current: SyncState, next: SyncState): SyncState {
    if (!this.isValidTransition(current, next)) {
      throw new Error(`Illegal state transition in BookingStateMachine: '${current}' -> '${next}'`);
    }
    return next;
  }
}
