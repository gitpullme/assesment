import { MiniAppManifest } from './types';

export function defineMiniApp(manifest: MiniAppManifest): MiniAppManifest {
  if (!manifest.id || typeof manifest.id !== 'string') {
    throw new Error('MiniApp manifest requires a valid non-empty id string');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error(`MiniApp ${manifest.id} requires a name`);
  }
  if (!manifest.entryPoint) {
    throw new Error(`MiniApp ${manifest.id} requires a React entryPoint component`);
  }
  return Object.freeze(manifest);
}
