import { TokenManager } from '../kernel/auth/tokenManager';

export interface ApiRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
  readonly requiresAuth?: boolean;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class ApiClient {
  private static baseUrl = 'http://localhost:4000/api';
  private static isRefreshing = false;
  private static refreshSubscribers: Array<(token: string) => void> = [];

  public static setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public static getBaseUrl(): string {
    return this.baseUrl;
  }

  public static async request<TResponse>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<TResponse> {
    const { method = 'GET', body, headers = {}, requiresAuth = true } = options;

    let accessToken: string | null = null;
    if (requiresAuth) {
      accessToken = await TokenManager.getAccessToken();
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError(0, `Network Connection Error: ${(networkErr as Error).message}`);
    }

    // Handle 401 Unauthorized with Silent Refresh
    if (response.status === 401 && requiresAuth) {
      const refreshedToken = await this.handleSilentRefresh();
      if (refreshedToken) {
        requestHeaders['Authorization'] = `Bearer ${refreshedToken}`;
        const retryResponse = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        return this.parseResponse<TResponse>(retryResponse);
      }
    }

    return this.parseResponse<TResponse>(response);
  }

  private static async parseResponse<TResponse>(response: Response): Promise<TResponse> {
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const errorMsg =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as Record<string, unknown>)['error'])
          : `HTTP ${response.status} Error`;
      throw new ApiError(response.status, errorMsg, data);
    }

    return data as TResponse;
  }

  private static async handleSilentRefresh(): Promise<string | null> {
    const refreshToken = await TokenManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    if (this.isRefreshing) {
      return new Promise<string>((resolve) => {
        this.refreshSubscribers.push((newToken) => resolve(newToken));
      });
    }

    this.isRefreshing = true;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await TokenManager.clearTokens();
        return null;
      }

      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      await TokenManager.saveTokens(body.accessToken, body.refreshToken);

      for (const subscriber of this.refreshSubscribers) {
        subscriber(body.accessToken);
      }
      this.refreshSubscribers = [];
      return body.accessToken;
    } catch {
      await TokenManager.clearTokens();
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }
}
