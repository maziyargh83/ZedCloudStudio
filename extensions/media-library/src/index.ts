import { defineExtension } from '@z-cloud/extension-sdk';
export default defineExtension({
  manifest: {
    id: 'z-cloud.media-library',
    name: 'Media library',
    version: '0.1.0',
    apiVersion: 1,
    description: 'A home for everything you capture.',
    capabilities: ['media:read', 'media:write'],
  },
  activate() {
    return () => {};
  },
});
