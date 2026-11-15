import { defineExtension } from '@z-cloud/extension-sdk';
export default defineExtension({
  manifest: {
    id: 'z-cloud.ai-memory',
    name: 'AI memory',
    version: '0.1.0',
    apiVersion: 1,
    description: 'Provider and retrieval contracts for a future AI integration.',
    capabilities: ['media:read', 'ai:generate'],
  },
  activate() {
    return () => {};
  },
});
