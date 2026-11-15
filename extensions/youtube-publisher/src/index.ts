import { defineExtension } from '@z-cloud/extension-sdk';
export default defineExtension({
  manifest: {
    id: 'z-cloud.youtube-publisher',
    name: 'YouTube publisher',
    version: '0.1.0',
    apiVersion: 1,
    description: 'Publishing boundary; OAuth and uploads are not yet connected.',
    capabilities: ['media:read', 'publish:youtube'],
  },
  activate() {
    return () => {};
  },
});
