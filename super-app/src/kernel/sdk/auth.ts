import { UserScopedProfile, WevAuthApi } from '../types';
import { PermissionManager } from './permissions';

export interface HostUserContext {
  readonly id: string;
  readonly email: string;
  readonly role: 'guest' | 'member' | 'host_admin';
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar: string | null;
}

export class ScopedMiniAppAuth implements WevAuthApi {
  private readonly permissions: PermissionManager;
  private readonly getUserContext: () => HostUserContext | null;

  constructor(permissions: PermissionManager, getUserContext: () => HostUserContext | null) {
    this.permissions = permissions;
    this.getUserContext = getUserContext;
  }

  public async getUser(): Promise<UserScopedProfile> {
    this.permissions.assertPermission('auth:profile:read', 'wev.auth.getUser');

    const hostUser = this.getUserContext();
    if (!hostUser) {
      return {
        id: 'guest_anon',
        firstName: 'Guest',
        lastName: 'Visitor',
        avatar: null,
        role: 'guest',
      };
    }

    const canReadEmail = this.permissions.has('auth:email:read');

    return {
      id: hostUser.id,
      firstName: hostUser.firstName,
      lastName: hostUser.lastName,
      avatar: hostUser.avatar,
      role: hostUser.role,
      ...(canReadEmail ? { email: hostUser.email } : {}),
    };
  }
}
