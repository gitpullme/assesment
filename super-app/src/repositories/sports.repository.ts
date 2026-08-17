import { ApiClient } from './api.client';
import { OfflineSyncQueue } from '../kernel/offline/syncQueue';

export interface SportsActivity {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly hostName: string;
  readonly venue: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly availableSpots: number;
  readonly priceCents: number;
  readonly lat: number;
  readonly lng: number;
  readonly isBookedByCurrentUser?: boolean;
}

export interface SportsBooking {
  readonly bookingId: string;
  readonly activityId: string;
  readonly userId: string;
  readonly status: 'pending' | 'confirmed' | 'conflict_rejected' | 'cancelled';
  readonly activityTitle: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly venue: string;
  readonly createdAt: string;
}

export class SportsRepository {
  public static async getActivities(): Promise<readonly SportsActivity[]> {
    const res = await ApiClient.request<{ activities: readonly SportsActivity[] }>('/sports/activities', {
      method: 'GET',
      requiresAuth: false,
    });
    return res.activities;
  }

  public static async bookActivity(
    activityId: string,
    activityTitle: string,
    startTime: string,
    endTime: string,
    venue: string,
    simulateConflict: boolean = false
  ): Promise<{ booking: SportsBooking; isOptimistic: boolean }> {
    const queue = OfflineSyncQueue.getInstance();

    const optimisticBooking: SportsBooking = {
      bookingId: `opt_sb_${Date.now()}`,
      activityId,
      userId: 'current_user',
      status: 'pending',
      activityTitle,
      startTime,
      endTime,
      venue,
      createdAt: new Date().toISOString(),
    };

    // If simulating conflict, inform the queue
    if (simulateConflict) {
      queue.setSimulateConflict(true);
    }

    queue.enqueue('sports', { activityId, simulateConflict }, optimisticBooking as unknown as Record<string, unknown>);

    return {
      booking: optimisticBooking,
      isOptimistic: true,
    };
  }

  public static async directBookActivity(
    activityId: string,
    simulateConflict: boolean = false
  ): Promise<SportsBooking> {
    const res = await ApiClient.request<{ booking: SportsBooking }>('/sports/bookings', {
      method: 'POST',
      body: { activityId, simulateConflict },
      requiresAuth: true,
    });
    return res.booking;
  }
}
