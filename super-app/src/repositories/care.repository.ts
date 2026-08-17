import { ApiClient } from './api.client';
import { OfflineSyncQueue } from '../kernel/offline/syncQueue';

export interface CareProvider {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly bio: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly hourlyRateCents: number;
  readonly location: {
    readonly obfuscatedLat: number;
    readonly obfuscatedLng: number;
    readonly radiusMeters: number;
    readonly approximateArea: string;
  };
  readonly exactAddress?: string;
  readonly phone?: string;
}

export interface CareBooking {
  readonly bookingId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly notes: string | null;
  readonly location: {
    readonly obfuscatedLat: number;
    readonly obfuscatedLng: number;
    readonly radiusMeters: number;
    readonly approximateArea: string;
  };
  readonly exactAddress?: string;
  readonly phone?: string;
  readonly createdAt: string;
}

export class CareRepository {
  public static async getProviders(lat?: number, lng?: number): Promise<readonly CareProvider[]> {
    const query = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : '';
    const res = await ApiClient.request<{ providers: readonly CareProvider[] }>(`/care/providers${query}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return res.providers;
  }

  public static async bookProvider(
    providerId: string,
    providerName: string,
    startTime: string,
    endTime: string,
    notes?: string
  ): Promise<{ booking: CareBooking; isOptimistic: boolean }> {
    const queue = OfflineSyncQueue.getInstance();

    const optimisticBooking: CareBooking = {
      bookingId: `opt_cb_${Date.now()}`,
      providerId,
      providerName,
      userId: 'current_user',
      startTime,
      endTime,
      status: 'pending',
      notes: notes ?? null,
      location: {
        obfuscatedLat: 37.77,
        obfuscatedLng: -122.42,
        radiusMeters: 500,
        approximateArea: 'Within 500m of approximate location',
      },
      createdAt: new Date().toISOString(),
    };

    queue.enqueue(
      'care',
      { providerId, startTime, endTime, notes },
      optimisticBooking as unknown as Record<string, unknown>
    );

    return {
      booking: optimisticBooking,
      isOptimistic: true,
    };
  }

  public static async directBookProvider(
    providerId: string,
    startTime: string,
    endTime: string,
    notes?: string
  ): Promise<CareBooking> {
    const res = await ApiClient.request<{ booking: CareBooking }>('/care/bookings', {
      method: 'POST',
      body: { providerId, startTime, endTime, notes },
      requiresAuth: true,
    });
    return res.booking;
  }

  public static async confirmBooking(bookingId: string): Promise<CareBooking> {
    const res = await ApiClient.request<{ booking: CareBooking }>(`/care/bookings/${bookingId}/confirm`, {
      method: 'POST',
      requiresAuth: true,
    });
    return res.booking;
  }

  public static async getBooking(bookingId: string): Promise<CareBooking> {
    const res = await ApiClient.request<{ booking: CareBooking }>(`/care/bookings/${bookingId}`, {
      method: 'GET',
      requiresAuth: true,
    });
    return res.booking;
  }
}
