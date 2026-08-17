import { defineMiniApp } from '../../kernel/manifest';
import { EventsMiniApp } from './index';

export const EventsManifest = defineMiniApp({
  id: 'wev.events',
  name: 'Community Events',
  version: '1.0.0',
  description: 'Discover local cultural events, workshops, and community meetups.',
  icon: 'Calendar',
  accentColor: '#8B5CF6',
  requiredPermissions: ['auth:profile:read', 'storage:scoped'],
  entryPoint: EventsMiniApp,
});
