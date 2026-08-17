import { create } from 'zustand';
import { TokenManager } from './tokenManager';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: 'guest' | 'member' | 'host_admin';
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar: string | null;
}

interface AuthState {
  readonly user: AuthUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly setSession: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly setRoleForTesting: (role: 'guest' | 'member' | 'host_admin') => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: {
    id: 'usr_member_01',
    email: 'alex@wevsocial.com',
    role: 'member',
    firstName: 'Alex',
    lastName: 'Rivera',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
  },
  isAuthenticated: true,
  isLoading: false,

  setSession: async (user, accessToken, refreshToken) => {
    await TokenManager.saveTokens(accessToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await TokenManager.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  setRoleForTesting: (role) => {
    const current = get().user;
    if (!current) return;
    set({
      user: {
        ...current,
        role,
      },
    });
  },
}));
