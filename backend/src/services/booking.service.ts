import crypto from 'crypto';
import { getDatabase, MemoryDatabase, SportsActivityRecord, SportsBookingRecord, CareProviderRecord, CareBookingRecord } from '../db/connection';
import { GeoService, ObfuscatedLocation } from './geo.service';

export interface SportsActivityResponse {
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

export interface CareProviderResponse {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly bio: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly hourlyRateCents: number;
  readonly location: ObfuscatedLocation;
  // Exact fields ONLY returned if booking is confirmed
  readonly exactAddress?: string;
  readonly phone?: string;
  readonly exactLat?: number;
  readonly exactLng?: number;
}

export interface SportsBookingResult {
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

export interface CareBookingResult {
  readonly bookingId: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly notes: string | null;
  readonly location: ObfuscatedLocation;
  readonly exactAddress?: string;
  readonly phone?: string;
  readonly createdAt: string;
}

export class ConflictError extends Error {
  public readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class BookingService {
  /**
   * Fetch all sports activities, with computed availability and optional user booking flag
   */
  public static async listSportsActivities(currentUserId?: string): Promise<readonly SportsActivityResponse[]> {
    const db = await getDatabase();

    if (db instanceof MemoryDatabase) {
      const results: SportsActivityResponse[] = [];
      const userBookings = new Set<string>();

      if (currentUserId) {
        for (const b of db.sportsBookings.values()) {
          if (b.user_id === currentUserId && b.status === 'confirmed') {
            userBookings.add(b.activity_id);
          }
        }
      }

      for (const act of db.sportsActivities.values()) {
        results.push({
          id: act.id,
          title: act.title,
          category: act.category,
          hostName: act.host_name,
          venue: act.venue,
          startTime: act.start_time.toISOString(),
          endTime: act.end_time.toISOString(),
          capacity: act.capacity,
          bookedCount: act.booked_count,
          availableSpots: Math.max(0, act.capacity - act.booked_count),
          priceCents: act.price_cents,
          lat: act.lat,
          lng: act.lng,
          isBookedByCurrentUser: userBookings.has(act.id),
        });
      }

      return results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    } else {
      const res = await db.query<SportsActivityRecord>('SELECT * FROM sports_activities ORDER BY start_time ASC');
      const rows = res.rows;

      const userBookings = new Set<string>();
      if (currentUserId) {
        const bookRes = await db.query<SportsBookingRecord>(
          'SELECT activity_id FROM sports_bookings WHERE user_id = $1 AND status = $2',
          [currentUserId, 'confirmed']
        );
        for (const r of bookRes.rows) {
          userBookings.add(r.activity_id);
        }
      }

      return rows.map((act) => ({
        id: act.id,
        title: act.title,
        category: act.category,
        hostName: act.host_name,
        venue: act.venue,
        startTime: act.start_time.toISOString(),
        endTime: act.end_time.toISOString(),
        capacity: act.capacity,
        bookedCount: act.booked_count,
        availableSpots: Math.max(0, act.capacity - act.booked_count),
        priceCents: act.price_cents,
        lat: act.lat,
        lng: act.lng,
        isBookedByCurrentUser: userBookings.has(act.id),
      }));
    }
  }

  /**
   * Book a sports session with strict concurrency check and atomic 409 conflict detection
   */
  public static async bookSportsActivity(
    activityId: string,
    userId: string,
    forceConflictSimulation: boolean = false
  ): Promise<SportsBookingResult> {
    if (forceConflictSimulation) {
      throw new ConflictError('Double-booking conflict: Capacity full or concurrent reservation detected.');
    }

    const db = await getDatabase();

    if (db instanceof MemoryDatabase) {
      const activity = db.sportsActivities.get(activityId);
      if (!activity) {
        throw new Error('Activity not found');
      }

      // Check if user already booked
      for (const b of db.sportsBookings.values()) {
        if (b.activity_id === activityId && b.user_id === userId && b.status === 'confirmed') {
          throw new ConflictError('User is already booked for this activity');
        }
      }

      // Concurrency check
      if (activity.booked_count >= activity.capacity) {
        throw new ConflictError('Activity is at full capacity (409 Conflict)');
      }

      // Atomic increment
      activity.booked_count += 1;
      const bookingId = `sb_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date();

      const booking: SportsBookingRecord = {
        id: bookingId,
        activity_id: activityId,
        user_id: userId,
        status: 'confirmed',
        created_at: now,
      };
      db.sportsBookings.set(bookingId, booking);

      return {
        bookingId,
        activityId,
        userId,
        status: 'confirmed',
        activityTitle: activity.title,
        startTime: activity.start_time.toISOString(),
        endTime: activity.end_time.toISOString(),
        venue: activity.venue,
        createdAt: now.toISOString(),
      };
    } else {
      return db.transaction(async (tx) => {
        // Row-level lock on the activity
        const actRes = await tx.query<SportsActivityRecord>(
          'SELECT * FROM sports_activities WHERE id = $1 FOR UPDATE',
          [activityId]
        );
        const act = actRes.rows[0];
        if (!act) {
          throw new Error('Activity not found');
        }

        if (act.booked_count >= act.capacity) {
          throw new ConflictError('Activity is at full capacity (409 Conflict)');
        }

        const existingRes = await tx.query<SportsBookingRecord>(
          'SELECT id FROM sports_bookings WHERE activity_id = $1 AND user_id = $2 AND status = $3',
          [activityId, userId, 'confirmed']
        );
        if (existingRes.rows.length > 0) {
          throw new ConflictError('User is already booked for this activity');
        }

        await tx.query('UPDATE sports_activities SET booked_count = booked_count + 1 WHERE id = $1', [activityId]);

        const bookingId = `sb_${crypto.randomBytes(8).toString('hex')}`;
        await tx.query(
          'INSERT INTO sports_bookings (id, activity_id, user_id, status) VALUES ($1, $2, $3, $4)',
          [bookingId, activityId, userId, 'confirmed']
        );

        return {
          bookingId,
          activityId,
          userId,
          status: 'confirmed',
          activityTitle: act.title,
          startTime: act.start_time.toISOString(),
          endTime: act.end_time.toISOString(),
          venue: act.venue,
          createdAt: new Date().toISOString(),
        };
      });
    }
  }

  /**
   * List care providers with deterministic geo-obfuscation
   * Exact coordinates and exact address are NEVER exposed in discovery list
   */
  public static async listCareProviders(userLocation?: { lat: number; lng: number }): Promise<readonly CareProviderResponse[]> {
    const db = await getDatabase();
    let rawProviders: readonly CareProviderRecord[] = [];

    if (db instanceof MemoryDatabase) {
      rawProviders = Array.from(db.careProviders.values());
    } else {
      const res = await db.query<CareProviderRecord>('SELECT * FROM care_providers ORDER BY rating DESC');
      rawProviders = res.rows;
    }

    const obfuscatedList = rawProviders.map((prov) => {
      const obfuscated = GeoService.obfuscateCoordinates(prov.id, prov.exact_lat, prov.exact_lng);
      return {
        id: prov.id,
        name: prov.name,
        specialty: prov.specialty,
        bio: prov.bio,
        rating: prov.rating,
        reviewCount: prov.review_count,
        hourlyRateCents: prov.hourly_rate_cents,
        location: obfuscated,
      };
    });

    if (userLocation) {
      // Sort by OBFUSCATED distance to strictly prevent data leakage from relative exact distance
      return obfuscatedList.slice().sort((a, b) => {
        const distA = GeoService.calculateDistanceMeters(userLocation, {
          lat: a.location.obfuscatedLat,
          lng: a.location.obfuscatedLng,
        });
        const distB = GeoService.calculateDistanceMeters(userLocation, {
          lat: b.location.obfuscatedLat,
          lng: b.location.obfuscatedLng,
        });
        return distA - distB;
      });
    }

    return obfuscatedList;
  }

  /**
   * Create care booking with pending status
   */
  public static async bookCareProvider(
    providerId: string,
    userId: string,
    startTime: string,
    endTime: string,
    notes?: string
  ): Promise<CareBookingResult> {
    const db = await getDatabase();
    const bookingId = `cb_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date();

    if (db instanceof MemoryDatabase) {
      const provider = db.careProviders.get(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      const booking: CareBookingRecord = {
        id: bookingId,
        provider_id: providerId,
        user_id: userId,
        start_time: new Date(startTime),
        end_time: new Date(endTime),
        notes: notes ?? null,
        status: 'pending', // Pending: exact address remains hidden until confirmed
        created_at: now,
      };
      db.careBookings.set(bookingId, booking);

      const obfuscated = GeoService.obfuscateCoordinates(provider.id, provider.exact_lat, provider.exact_lng);

      return {
        bookingId,
        providerId,
        providerName: provider.name,
        userId,
        startTime,
        endTime,
        status: 'pending',
        notes: notes ?? null,
        location: obfuscated,
        createdAt: now.toISOString(),
      };
    } else {
      const provRes = await db.query<CareProviderRecord>('SELECT * FROM care_providers WHERE id = $1', [providerId]);
      const provider = provRes.rows[0];
      if (!provider) {
        throw new Error('Provider not found');
      }

      await db.query(
        'INSERT INTO care_bookings (id, provider_id, user_id, start_time, end_time, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [bookingId, providerId, userId, new Date(startTime), new Date(endTime), notes ?? null, 'pending']
      );

      const obfuscated = GeoService.obfuscateCoordinates(provider.id, provider.exact_lat, provider.exact_lng);

      return {
        bookingId,
        providerId,
        providerName: provider.name,
        userId,
        startTime,
        endTime,
        status: 'pending',
        notes: notes ?? null,
        location: obfuscated,
        createdAt: now.toISOString(),
      };
    }
  }

  /**
   * Confirm care booking and unlock exact location & contact information
   */
  public static async confirmCareBooking(bookingId: string, userId: string): Promise<CareBookingResult> {
    const db = await getDatabase();

    if (db instanceof MemoryDatabase) {
      const booking = db.careBookings.get(bookingId);
      if (!booking || booking.user_id !== userId) {
        throw new Error('Booking not found or access denied');
      }

      booking.status = 'confirmed';
      const provider = db.careProviders.get(booking.provider_id);
      if (!provider) {
        throw new Error('Provider record missing');
      }

      const obfuscated = GeoService.obfuscateCoordinates(provider.id, provider.exact_lat, provider.exact_lng);

      return {
        bookingId: booking.id,
        providerId: provider.id,
        providerName: provider.name,
        userId: booking.user_id,
        startTime: booking.start_time.toISOString(),
        endTime: booking.end_time.toISOString(),
        status: 'confirmed',
        notes: booking.notes,
        location: obfuscated,
        // Exact details REVEALED on confirmed status
        exactAddress: provider.exact_address,
        phone: provider.phone,
        createdAt: booking.created_at.toISOString(),
      };
    } else {
      const res = await db.query<CareBookingRecord & CareProviderRecord>(
        `SELECT cb.id as booking_id, cb.user_id, cb.start_time, cb.end_time, cb.notes, cb.status, cb.created_at,
                cp.id as provider_id, cp.name as provider_name, cp.exact_lat, cp.exact_lng, cp.exact_address, cp.phone
         FROM care_bookings cb
         JOIN care_providers cp ON cb.provider_id = cp.id
         WHERE cb.id = $1 AND cb.user_id = $2`,
        [bookingId, userId]
      );
      const row = res.rows[0];
      if (!row) {
        throw new Error('Booking not found or access denied');
      }

      await db.query('UPDATE care_bookings SET status = $1 WHERE id = $2', ['confirmed', bookingId]);

      const obfuscated = GeoService.obfuscateCoordinates(row.provider_id, row.exact_lat, row.exact_lng);

      return {
        bookingId: row.id,
        providerId: row.provider_id,
        providerName: row.name,
        userId: row.user_id,
        startTime: row.start_time.toISOString(),
        endTime: row.end_time.toISOString(),
        status: 'confirmed',
        notes: row.notes,
        location: obfuscated,
        exactAddress: row.exact_address,
        phone: row.phone,
        createdAt: row.created_at.toISOString(),
      };
    }
  }

  /**
   * Get care booking by ID with privacy protection
   */
  public static async getCareBooking(bookingId: string, userId: string): Promise<CareBookingResult> {
    const db = await getDatabase();

    if (db instanceof MemoryDatabase) {
      const booking = db.careBookings.get(bookingId);
      if (!booking || booking.user_id !== userId) {
        throw new Error('Booking not found');
      }
      const provider = db.careProviders.get(booking.provider_id);
      if (!provider) {
        throw new Error('Provider missing');
      }
      const obfuscated = GeoService.obfuscateCoordinates(provider.id, provider.exact_lat, provider.exact_lng);

      const isConfirmed = booking.status === 'confirmed';

      return {
        bookingId: booking.id,
        providerId: provider.id,
        providerName: provider.name,
        userId: booking.user_id,
        startTime: booking.start_time.toISOString(),
        endTime: booking.end_time.toISOString(),
        status: booking.status,
        notes: booking.notes,
        location: obfuscated,
        exactAddress: isConfirmed ? provider.exact_address : undefined,
        phone: isConfirmed ? provider.phone : undefined,
        createdAt: booking.created_at.toISOString(),
      };
    } else {
      const res = await db.query<CareBookingRecord & CareProviderRecord>(
        `SELECT cb.*, cp.name as provider_name, cp.exact_lat, cp.exact_lng, cp.exact_address, cp.phone
         FROM care_bookings cb
         JOIN care_providers cp ON cb.provider_id = cp.id
         WHERE cb.id = $1 AND cb.user_id = $2`,
        [bookingId, userId]
      );
      const row = res.rows[0];
      if (!row) {
        throw new Error('Booking not found');
      }

      const obfuscated = GeoService.obfuscateCoordinates(row.provider_id, row.exact_lat, row.exact_lng);
      const isConfirmed = row.status === 'confirmed';

      return {
        bookingId: row.id,
        providerId: row.provider_id,
        providerName: row.name,
        userId: row.user_id,
        startTime: row.start_time.toISOString(),
        endTime: row.end_time.toISOString(),
        status: row.status,
        notes: row.notes,
        location: obfuscated,
        exactAddress: isConfirmed ? row.exact_address : undefined,
        phone: isConfirmed ? row.phone : undefined,
        createdAt: row.created_at.toISOString(),
      };
    }
  }
}
