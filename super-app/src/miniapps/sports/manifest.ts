import { defineMiniApp } from '../../kernel/manifest';
import { SportsMiniApp } from './index';

export const SportsManifest = defineMiniApp({
  id: 'wev.sports',
  name: 'Sports & Fitness',
  version: '1.2.0',
  description: 'Discover pick-up games, join tournaments, and reserve courts with instant booking.',
  icon: 'Activity',
  accentColor: '#3B82F6',
  requiredPermissions: ['auth:profile:read', 'storage:scoped', 'bridge:interapp'],
  entryPoint: SportsMiniApp,
});
