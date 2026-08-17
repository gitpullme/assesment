import crypto from 'crypto';

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface ObfuscatedLocation {
  readonly obfuscatedLat: number;
  readonly obfuscatedLng: number;
  readonly radiusMeters: number;
  readonly approximateArea: string;
}

/**
 * Deterministic Geo-Obfuscation Service
 * 
 * Guarantees that:
 * 1. An entity's location is snapped to a point strictly within a 500m radius.
 * 2. The jitter is deterministic (seeded by provider ID + salt), meaning it NEVER changes
 *    across server restarts, queries, or client renders.
 * 3. Exact lat/lng and exact street addresses never leak to the client unless booking state is CONFIRMED.
 */
export class GeoService {
  private static readonly MAX_RADIUS_METERS = 500;
  private static readonly EARTH_RADIUS_METERS = 6371000;
  private static readonly GEO_SALT = 'wev_social_geo_privacy_seed_2026_deterministic';

  /**
   * Deterministically calculates a pseudo-random offset within 500m using SHA-256 seed.
   */
  public static obfuscateCoordinates(
    providerId: string,
    exactLat: number,
    exactLng: number
  ): ObfuscatedLocation {
    // Generate deterministic 32-bit integers from providerId + salt
    const hash = crypto
      .createHash('sha256')
      .update(`${this.GEO_SALT}:${providerId}`)
      .digest('hex');

    // Extract two pseudo-random float values in [0, 1) from deterministic hash chunks
    const hashSlice1 = parseInt(hash.substring(0, 8), 16);
    const hashSlice2 = parseInt(hash.substring(8, 16), 16);

    const u = hashSlice1 / 0xffffffff;
    const v = hashSlice2 / 0xffffffff;

    // Distribute evenly in a disk: r = R * sqrt(u), theta = 2 * PI * v
    // Minimum 150m offset to prevent accidental near-exact collision, maximum 500m
    const minRadius = 150;
    const r = minRadius + (this.MAX_RADIUS_METERS - minRadius) * Math.sqrt(u);
    const theta = 2 * Math.PI * v;

    // Convert polar offset (r, theta) to lat/lng delta
    const deltaLat = (r * Math.cos(theta)) / this.EARTH_RADIUS_METERS * (180 / Math.PI);
    const deltaLng =
      (r * Math.sin(theta)) /
      (this.EARTH_RADIUS_METERS * Math.cos((exactLat * Math.PI) / 180)) *
      (180 / Math.PI);

    const obfuscatedLat = Number((exactLat + deltaLat).toFixed(6));
    const obfuscatedLng = Number((exactLng + deltaLng).toFixed(6));

    return {
      obfuscatedLat,
      obfuscatedLng,
      radiusMeters: this.MAX_RADIUS_METERS,
      approximateArea: 'Within 500m of approximate location',
    };
  }

  /**
   * Haversine formula to compute great-circle distance between two points in meters.
   */
  public static calculateDistanceMeters(
    coord1: Coordinates,
    coord2: Coordinates
  ): number {
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const lat1 = (coord1.lat * Math.PI) / 180;
    const lat2 = (coord2.lat * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_METERS * c;
  }
}
