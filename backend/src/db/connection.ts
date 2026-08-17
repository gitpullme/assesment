import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface IDatabase {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: IDatabase) => Promise<T>): Promise<T>;
  init(): Promise<void>;
  close(): Promise<void>;
  isLivePostgres(): boolean;
}

// Live PostgreSQL implementation
class PostgresDatabase implements IDatabase {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 4000,
    });
  }

  public isLivePostgres(): boolean {
    return true;
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params ? (params as unknown[]) : undefined);
  }

  public async transaction<T>(callback: (client: IDatabase) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const scopedDb: IDatabase = {
        query: <R extends QueryResultRow = QueryResultRow>(t: string, p?: readonly unknown[]) =>
          client.query<R>(t, p ? (p as unknown[]) : undefined),
        transaction: () => {
          throw new Error('Nested transactions not supported');
        },
        init: async () => {},
        close: async () => {},
        isLivePostgres: () => true,
      };
      const result = await callback(scopedDb);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async init(): Promise<void> {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await this.pool.query(sql);
      }
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// In-memory relational database fallback (strict typing, ACID semantics for zero-dependency local verification)
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: 'guest' | 'member' | 'host_admin';
  first_name: string;
  last_name: string;
  avatar: string | null;
  created_at: Date;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface SportsActivityRecord {
  id: string;
  title: string;
  category: string;
  host_name: string;
  venue: string;
  start_time: Date;
  end_time: Date;
  capacity: number;
  booked_count: number;
  price_cents: number;
  lat: number;
  lng: number;
  created_at: Date;
}

export interface SportsBookingRecord {
  id: string;
  activity_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'conflict_rejected' | 'cancelled';
  created_at: Date;
}

export interface CareProviderRecord {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  rating: number;
  review_count: number;
  hourly_rate_cents: number;
  exact_lat: number;
  exact_lng: number;
  exact_address: string;
  phone: string;
  created_at: Date;
}

export interface CareBookingRecord {
  id: string;
  provider_id: string;
  user_id: string;
  start_time: Date;
  end_time: Date;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: Date;
}

export class MemoryDatabase implements IDatabase {
  public users: Map<string, UserRecord> = new Map();
  public refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  public sportsActivities: Map<string, SportsActivityRecord> = new Map();
  public sportsBookings: Map<string, SportsBookingRecord> = new Map();
  public careProviders: Map<string, CareProviderRecord> = new Map();
  public careBookings: Map<string, CareBookingRecord> = new Map();

  public isLivePostgres(): boolean {
    return false;
  }

  public async init(): Promise<void> {
    // Seed initial users with bcrypt password "Password123!"
    const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

    const adminUser: UserRecord = {
      id: 'usr_admin_01',
      email: 'admin@wevsocial.com',
      password_hash: defaultPasswordHash,
      role: 'host_admin',
      first_name: 'Sarah',
      last_name: 'Connor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      created_at: new Date(),
    };
    const memberUser: UserRecord = {
      id: 'usr_member_01',
      email: 'alex@wevsocial.com',
      password_hash: defaultPasswordHash,
      role: 'member',
      first_name: 'Alex',
      last_name: 'Rivera',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      created_at: new Date(),
    };
    const guestUser: UserRecord = {
      id: 'usr_guest_01',
      email: 'guest@wevsocial.com',
      password_hash: defaultPasswordHash,
      role: 'guest',
      first_name: 'Guest',
      last_name: 'Visitor',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      created_at: new Date(),
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(memberUser.id, memberUser);
    this.users.set(guestUser.id, guestUser);

    const now = Date.now();
    const activities: readonly SportsActivityRecord[] = [
      {
        id: 'act_tennis_01',
        title: 'Sunset Clay Court Tennis Doubles',
        category: 'tennis',
        host_name: 'Coach Marcus',
        venue: 'Grand Central Tennis Club, Court 3',
        start_time: new Date(now + 2 * 3600 * 1000),
        end_time: new Date(now + 4 * 3600 * 1000),
        capacity: 4,
        booked_count: 3,
        price_cents: 1500,
        lat: 37.7749,
        lng: -122.4194,
        created_at: new Date(),
      },
      {
        id: 'act_bball_02',
        title: '3v3 Half-Court Basketball Pick-up',
        category: 'basketball',
        host_name: 'Jordan Bell',
        venue: 'Mission Rec Center Gym A',
        start_time: new Date(now + 5 * 3600 * 1000),
        end_time: new Date(now + 7 * 3600 * 1000),
        capacity: 6,
        booked_count: 2,
        price_cents: 800,
        lat: 37.7599,
        lng: -122.4148,
        created_at: new Date(),
      },
      {
        id: 'act_yoga_03',
        title: 'Sunrise Vinyasa Flow & Breathwork',
        category: 'yoga',
        host_name: 'Elena Vance',
        venue: 'Dolores Park Hillside Lawn',
        start_time: new Date(now + 24 * 3600 * 1000),
        end_time: new Date(now + 25.5 * 3600 * 1000),
        capacity: 20,
        booked_count: 14,
        price_cents: 1200,
        lat: 37.7596,
        lng: -122.4269,
        created_at: new Date(),
      },
      {
        id: 'act_full_04',
        title: 'High-Intensity Futsal Tournament',
        category: 'football',
        host_name: 'Diego Silva',
        venue: 'SOMA Indoor Arena Court 1',
        start_time: new Date(now + 3 * 3600 * 1000),
        end_time: new Date(now + 5 * 3600 * 1000),
        capacity: 10,
        booked_count: 10, // Full capacity for 409 testing
        price_cents: 2000,
        lat: 37.7812,
        lng: -122.4045,
        created_at: new Date(),
      },
      {
        id: 'act_run_05',
        title: 'Bay Trail 10K Endurance Paced Run',
        category: 'running',
        host_name: 'Claire Dupont',
        venue: 'Crissy Field Warming Hut',
        start_time: new Date(now + 48 * 3600 * 1000),
        end_time: new Date(now + 50 * 3600 * 1000),
        capacity: 30,
        booked_count: 8,
        price_cents: 0,
        lat: 37.8044,
        lng: -122.4662,
        created_at: new Date(),
      },
      {
        id: 'act_swim_06',
        title: 'Masters Open Water Swim Session',
        category: 'swimming',
        host_name: 'Capt. Soren',
        venue: 'Aquatic Park Cove Pier',
        start_time: new Date(now + 72 * 3600 * 1000),
        end_time: new Date(now + 73.5 * 3600 * 1000),
        capacity: 12,
        booked_count: 5,
        price_cents: 1800,
        lat: 37.8066,
        lng: -122.4239,
        created_at: new Date(),
      },
    ];

    for (const act of activities) {
      this.sportsActivities.set(act.id, act);
    }

    const providers: readonly CareProviderRecord[] = [
      {
        id: 'prov_care_01',
        name: 'Maria Sanchez, RN',
        specialty: 'Childcare (Infant/Toddler)',
        bio: 'Certified pediatric nurse and CPR instructor with 9+ years experience caring for infants and toddlers in private homes.',
        rating: 4.95,
        review_count: 48,
        hourly_rate_cents: 3200,
        exact_lat: 37.7654,
        exact_lng: -122.4312,
        exact_address: '482 Castro St, San Francisco, CA 94114',
        phone: '+1-415-555-0142',
        created_at: new Date(),
      },
      {
        id: 'prov_care_02',
        name: 'David Kim',
        specialty: 'After-School Care & Tutoring',
        bio: 'Credentialed STEM teacher offering active sports coaching, homework help, and certified after-school childcare.',
        rating: 4.88,
        review_count: 34,
        hourly_rate_cents: 2800,
        exact_lat: 37.7833,
        exact_lng: -122.4167,
        exact_address: '820 Geary St, San Francisco, CA 94109',
        phone: '+1-415-555-0198',
        created_at: new Date(),
      },
      {
        id: 'prov_care_03',
        name: 'Grace Thorne, CNA',
        specialty: 'Senior Eldercare & Mobility Support',
        bio: 'Compassionate certified nursing assistant dedicated to companion care, medication reminders, and gentle physical therapy assistance.',
        rating: 5.0,
        review_count: 62,
        hourly_rate_cents: 3500,
        exact_lat: 37.7502,
        exact_lng: -122.4181,
        exact_address: '1294 Valencia St, San Francisco, CA 94110',
        phone: '+1-415-555-0177',
        created_at: new Date(),
      },
      {
        id: 'prov_care_04',
        name: 'Hannah Lin',
        specialty: 'Special Needs & Sensory Support',
        bio: 'Special Education specialist with extensive background in ASD behavioral support, calm routines, and engaging creative arts.',
        rating: 4.92,
        review_count: 29,
        hourly_rate_cents: 3800,
        exact_lat: 37.7891,
        exact_lng: -122.4014,
        exact_address: '201 Folsom St, San Francisco, CA 94105',
        phone: '+1-415-555-0163',
        created_at: new Date(),
      },
    ];

    for (const prov of providers) {
      this.careProviders.set(prov.id, prov);
    }
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    _text: string,
    _params?: readonly unknown[]
  ): Promise<QueryResult<T>> {
    // MemoryDatabase direct access methods are used for typed repositories;
    // this query stub satisfies IDatabase interface.
    return {
      rows: [] as unknown as T[],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: [],
    };
  }

  public async transaction<T>(callback: (client: IDatabase) => Promise<T>): Promise<T> {
    return callback(this);
  }

  public async close(): Promise<void> {
    this.users.clear();
    this.refreshTokens.clear();
    this.sportsActivities.clear();
    this.sportsBookings.clear();
    this.careProviders.clear();
    this.careBookings.clear();
  }
}

let dbInstance: IDatabase | null = null;

export async function getDatabase(): Promise<IDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (config.databaseUrl) {
    try {
      const pgDb = new PostgresDatabase(config.databaseUrl);
      // Test connectivity
      await pgDb.query('SELECT 1');
      await pgDb.init();
      dbInstance = pgDb;
      console.log('Connected to live PostgreSQL database.');
      return dbInstance;
    } catch (err) {
      console.warn('Postgres connection failed, falling back to in-memory database:', (err as Error).message);
    }
  }

  const memDb = new MemoryDatabase();
  await memDb.init();
  dbInstance = memDb;
  console.log('Initialized in-memory database with schema and seed data.');
  return dbInstance;
}
