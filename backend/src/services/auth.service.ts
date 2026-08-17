import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { getDatabase, MemoryDatabase, UserRecord, RefreshTokenRecord } from '../db/connection';

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly role: 'guest' | 'member' | 'host_admin';
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar: string | null;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface AuthSessionResponse {
  readonly user: UserProfile;
  readonly tokens: AuthTokens;
}

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: 'guest' | 'member' | 'host_admin';
  readonly type: 'access' | 'refresh';
}

export class AuthService {
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  public static generateTokens(user: UserProfile): AuthTokens {
    const accessPayload: JwtPayload & { jti: string } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      jti: crypto.randomBytes(16).toString('hex'),
    };

    const refreshPayload: JwtPayload & { jti: string } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
      jti: crypto.randomBytes(16).toString('hex'),
    };

    const accessToken = jwt.sign(accessPayload, config.jwtSecret, {
      expiresIn: config.jwtAccessExpirySec,
    });

    const refreshToken = jwt.sign(refreshPayload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpirySec,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwtAccessExpirySec,
    };
  }

  public static verifyAccessToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Invalid token structure');
    }
    const payload = decoded as unknown as Record<string, unknown>;
    if (
      typeof payload['sub'] !== 'string' ||
      typeof payload['email'] !== 'string' ||
      typeof payload['role'] !== 'string' ||
      payload['type'] !== 'access'
    ) {
      throw new Error('Malformed token claims');
    }

    return {
      sub: payload['sub'],
      email: payload['email'],
      role: payload['role'] as 'guest' | 'member' | 'host_admin',
      type: 'access',
    };
  }

  public static verifyRefreshToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, config.jwtRefreshSecret);
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Invalid token structure');
    }
    const payload = decoded as unknown as Record<string, unknown>;
    if (
      typeof payload['sub'] !== 'string' ||
      typeof payload['email'] !== 'string' ||
      typeof payload['role'] !== 'string' ||
      payload['type'] !== 'refresh'
    ) {
      throw new Error('Malformed refresh token claims');
    }

    return {
      sub: payload['sub'],
      email: payload['email'],
      role: payload['role'] as 'guest' | 'member' | 'host_admin',
      type: 'refresh',
    };
  }

  public static async register(
    email: string,
    passwordPlain: string,
    firstName: string,
    lastName: string,
    role: 'guest' | 'member' | 'host_admin' = 'member'
  ): Promise<AuthSessionResponse> {
    const db = await getDatabase();
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = await this.hashPassword(passwordPlain);

    if (db instanceof MemoryDatabase) {
      for (const u of db.users.values()) {
        if (u.email.toLowerCase() === email.toLowerCase()) {
          throw new Error('Email already registered');
        }
      }
      const newUser: UserRecord = {
        id: userId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
        first_name: firstName,
        last_name: lastName,
        avatar: null,
        created_at: new Date(),
      };
      db.users.set(userId, newUser);

      const profile: UserProfile = {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        avatar: newUser.avatar,
      };
      const tokens = this.generateTokens(profile);
      await this.saveRefreshToken(userId, tokens.refreshToken);
      return { user: profile, tokens };
    } else {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.rows.length > 0) {
        throw new Error('Email already registered');
      }
      await db.query(
        'INSERT INTO users (id, email, password_hash, role, first_name, last_name, avatar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, email.toLowerCase(), passwordHash, role, firstName, lastName, null]
      );
      const profile: UserProfile = {
        id: userId,
        email: email.toLowerCase(),
        role,
        firstName,
        lastName,
        avatar: null,
      };
      const tokens = this.generateTokens(profile);
      await this.saveRefreshToken(userId, tokens.refreshToken);
      return { user: profile, tokens };
    }
  }

  public static async login(email: string, passwordPlain: string): Promise<AuthSessionResponse> {
    const db = await getDatabase();

    let userRecord: UserRecord | null = null;

    if (db instanceof MemoryDatabase) {
      for (const u of db.users.values()) {
        if (u.email.toLowerCase() === email.toLowerCase()) {
          userRecord = u;
          break;
        }
      }
    } else {
      const res = await db.query<UserRecord>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
      const row = res.rows[0];
      if (row) {
        userRecord = row;
      }
    }

    if (!userRecord) {
      throw new Error('Invalid email or password');
    }

    const isValid = await this.verifyPassword(passwordPlain, userRecord.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const profile: UserProfile = {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      firstName: userRecord.first_name,
      lastName: userRecord.last_name,
      avatar: userRecord.avatar,
    };

    const tokens = this.generateTokens(profile);
    await this.saveRefreshToken(userRecord.id, tokens.refreshToken);
    return { user: profile, tokens };
  }

  public static async refreshSession(refreshToken: string): Promise<AuthTokens> {
    const claims = this.verifyRefreshToken(refreshToken);
    const db = await getDatabase();

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    if (db instanceof MemoryDatabase) {
      let found: RefreshTokenRecord | null = null;
      for (const rt of db.refreshTokens.values()) {
        if (rt.token_hash === tokenHash && rt.user_id === claims.sub && !rt.revoked) {
          found = rt;
          break;
        }
      }
      if (!found || found.expires_at.getTime() < Date.now()) {
        throw new Error('Refresh token is invalid or expired');
      }

      // Invalidate used token (rotation)
      db.refreshTokens.delete(found.id);

      const user = db.users.get(claims.sub);
      if (!user) {
        throw new Error('User not found');
      }

      const profile: UserProfile = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
      };

      const newTokens = this.generateTokens(profile);
      await this.saveRefreshToken(user.id, newTokens.refreshToken);
      return newTokens;
    } else {
      const res = await db.query<RefreshTokenRecord>(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
        [tokenHash, claims.sub]
      );
      const row = res.rows[0];
      if (!row) {
        throw new Error('Refresh token is invalid or expired');
      }

      // Rotate token
      await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [row.id]);

      const userRes = await db.query<UserRecord>('SELECT * FROM users WHERE id = $1', [claims.sub]);
      const user = userRes.rows[0];
      if (!user) {
        throw new Error('User not found');
      }

      const profile: UserProfile = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
      };

      const newTokens = this.generateTokens(profile);
      await this.saveRefreshToken(user.id, newTokens.refreshToken);
      return newTokens;
    }
  }

  public static async saveRefreshToken(userId: string, token: string): Promise<void> {
    const db = await getDatabase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenId = `rt_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + config.jwtRefreshExpirySec * 1000);

    if (db instanceof MemoryDatabase) {
      db.refreshTokens.set(tokenId, {
        id: tokenId,
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked: false,
        created_at: new Date(),
      });
    } else {
      await db.query(
        'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked) VALUES ($1, $2, $3, $4, FALSE)',
        [tokenId, userId, tokenHash, expiresAt]
      );
    }
  }

  public static async getUserById(userId: string): Promise<UserProfile | null> {
    const db = await getDatabase();
    if (db instanceof MemoryDatabase) {
      const user = db.users.get(userId);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
      };
    } else {
      const res = await db.query<UserRecord>('SELECT * FROM users WHERE id = $1', [userId]);
      const user = res.rows[0];
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
      };
    }
  }
}
