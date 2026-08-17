import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string | undefined;
  readonly jwtSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessExpirySec: number;
  readonly jwtRefreshExpirySec: number;
  readonly nodeEnv: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'wev_super_jwt_access_secret_key_32bytes_long_min_2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'wev_super_jwt_refresh_secret_key_32bytes_long_min_2026',
  jwtAccessExpirySec: 15 * 60, // 15 minutes
  jwtRefreshExpirySec: 30 * 24 * 60 * 60, // 30 days
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
