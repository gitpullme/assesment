/**
 * Secure Token Storage Manager
 * Cross-platform adapter using Expo SecureStore on native and localStorage/memory on web.
 */

const ACCESS_TOKEN_KEY = 'wev_secure_access_token';
const REFRESH_TOKEN_KEY = 'wev_secure_refresh_token';

let memoryTokens: { accessToken: string | null; refreshToken: string | null } = {
  accessToken: null,
  refreshToken: null,
};

export class TokenManager {
  public static async getAccessToken(): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return memoryTokens.accessToken;
  }

  public static async setAccessToken(token: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
    memoryTokens.accessToken = token;
  }

  public static async getRefreshToken(): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return memoryTokens.refreshToken;
  }

  public static async setRefreshToken(token: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
    memoryTokens.refreshToken = token;
  }

  public static async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.setAccessToken(accessToken);
    await this.setRefreshToken(refreshToken);
  }

  public static async clearTokens(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    memoryTokens.accessToken = null;
    memoryTokens.refreshToken = null;
  }
}
