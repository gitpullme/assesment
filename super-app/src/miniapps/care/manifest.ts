import { defineMiniApp } from '../../kernel/manifest';
import { CareMiniApp } from './index';

export const CareManifest = defineMiniApp({
  id: 'wev.care',
  name: 'Care & Childcare',
  version: '1.0.4',
  description: 'Book vetted in-home care providers with strict deterministic geo-privacy.',
  icon: 'Heart',
  accentColor: '#10B981',
  requiredPermissions: ['auth:profile:read', 'storage:scoped', 'bridge:interapp', 'location:obfuscated'],
  entryPoint: CareMiniApp,
});
