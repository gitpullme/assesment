import { MiniAppId, NavigationTarget, WevNavigationApi } from '../types';

export interface HostNavigationDelegate {
  navigateWithinApp(appId: MiniAppId, screen?: string, params?: Readonly<Record<string, unknown>>): void;
  crossAppNavigate(targetAppId: MiniAppId, screen?: string, params?: Readonly<Record<string, unknown>>): void;
  goBack(appId: MiniAppId): void;
}

export class ScopedMiniAppNavigation implements WevNavigationApi {
  private readonly appId: MiniAppId;
  private readonly delegate: HostNavigationDelegate;

  constructor(appId: MiniAppId, delegate: HostNavigationDelegate) {
    this.appId = appId;
    this.delegate = delegate;
  }

  public navigate(target: NavigationTarget | string, params?: Readonly<Record<string, unknown>>): void {
    if (typeof target === 'string') {
      this.delegate.navigateWithinApp(this.appId, target, params);
      return;
    }

    if (target.miniAppId && target.miniAppId !== this.appId) {
      this.delegate.crossAppNavigate(target.miniAppId, target.screen, target.params);
    } else {
      this.delegate.navigateWithinApp(this.appId, target.screen, target.params);
    }
  }

  public goBack(): void {
    this.delegate.goBack(this.appId);
  }
}
