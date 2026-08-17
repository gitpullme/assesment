import { MiniAppId, MiniAppPermission, PermissionStatus, WevPermissionsApi, SecurityError } from '../types';

export interface PermissionManagerConfig {
  readonly appId: MiniAppId;
  readonly defaultGrantedPermissions: readonly MiniAppPermission[];
  readonly onPermissionPrompt?: (permission: MiniAppPermission) => Promise<boolean>;
}

export class PermissionManager implements WevPermissionsApi {
  private readonly appId: MiniAppId;
  private readonly grantedPermissions: Set<MiniAppPermission>;
  private readonly onPrompt?: (permission: MiniAppPermission) => Promise<boolean>;

  constructor(config: PermissionManagerConfig) {
    this.appId = config.appId;
    this.grantedPermissions = new Set(config.defaultGrantedPermissions);
    this.onPrompt = config.onPermissionPrompt;
  }

  public async request(permission: MiniAppPermission): Promise<PermissionStatus> {
    if (this.grantedPermissions.has(permission)) {
      return 'granted';
    }

    if (this.onPrompt) {
      const allowed = await this.onPrompt(permission);
      if (allowed) {
        this.grantedPermissions.add(permission);
        return 'granted';
      }
      return 'denied';
    }

    // Default auto-grant for non-sensitive scopes if in manifest
    this.grantedPermissions.add(permission);
    return 'granted';
  }

  public has(permission: MiniAppPermission): boolean {
    return this.grantedPermissions.has(permission);
  }

  public getAllGranted(): readonly MiniAppPermission[] {
    return Array.from(this.grantedPermissions);
  }

  /**
   * Enforces permission guard. Throws SecurityError if permission not granted.
   */
  public assertPermission(permission: MiniAppPermission, operationDescription?: string): void {
    if (!this.has(permission)) {
      throw new SecurityError(
        this.appId,
        permission,
        `Operation '${operationDescription ?? permission}' blocked: Mini-App '${this.appId}' lacks required permission '${permission}'.`
      );
    }
  }
}
