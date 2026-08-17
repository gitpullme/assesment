import { ApiClient } from './api.client';
import { TokenManager } from '../kernel/auth/tokenManager';

export interface AuthSession {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: 'guest' | 'member' | 'host_admin';
    readonly firstName: string;
    readonly lastName: string;
    readonly avatar: string | null;
  };
  readonly tokens: {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresIn: number;
  };
}

export class AuthRepository {
  public static async login(email: string, passwordPlain: string): Promise<AuthSession> {
    const res = await ApiClient.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: { email, password: passwordPlain },
      requiresAuth: false,
    });
    await TokenManager.saveTokens(res.tokens.accessToken, res.tokens.refreshToken);
    return res;
  }

  public static async register(
    email: string,
    passwordPlain: string,
    firstName: string,
    lastName: string,
    role?: 'guest' | 'member' | 'host_admin'
  ): Promise<AuthSession> {
    const res = await ApiClient.request<AuthSession>('/auth/register', {
      method: 'POST',
      body: { email, password: passwordPlain, firstName, lastName, role },
      requiresAuth: false,
    });
    await TokenManager.saveTokens(res.tokens.accessToken, res.tokens.refreshToken);
    return res;
  }

  public static async getHostOnlyAdminData(): Promise<Record<string, unknown>> {
    return ApiClient.request<Record<string, unknown>>('/admin/host-only', {
      method: 'GET',
      requiresAuth: true,
    });
  }
}
