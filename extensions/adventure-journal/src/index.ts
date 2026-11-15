import { defineExtension } from '@z-cloud/extension-sdk';
export default defineExtension({
  manifest: {
    id: 'z-cloud.adventure-journal',
    name: 'Adventure journal',
    version: '0.1.0',
    apiVersion: 1,
    description: 'Keep the story around your media.',
    capabilities: ['media:read', 'journal:write'],
  },
  activate() {
    return () => {};
  },
});
