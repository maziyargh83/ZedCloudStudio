import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionRegistry } from './index';
import { defineExtension } from '@z-cloud/extension-sdk';
import { EventBus } from '@z-cloud/core';
const manifest = {
  id: 'test.example',
  name: 'Example',
  version: '1.0.0',
  apiVersion: 1 as const,
  description: 'Test extension',
  capabilities: [],
};
test('registration, idempotent activation, events, cleanup and reactivation', async () => {
  let activated = 0,
    cleaned = 0;
  const events = new EventBus();
  const enabled: string[] = [];
  events.on('extension.enabled', (e) => enabled.push(e.id));
  const registry = new ExtensionRegistry(events);
  const extension = defineExtension({
    manifest,
    activate() {
      activated++;
      return () => {
        cleaned++;
      };
    },
  });
  registry.register(extension);
  assert.throws(() => registry.register(extension), /Duplicate/);
  await registry.enable(manifest.id);
  await registry.enable(manifest.id);
  assert.equal(activated, 1);
  assert.equal(registry.list()[0].enabled, true);
  registry.disable(manifest.id);
  registry.disable(manifest.id);
  assert.equal(cleaned, 1);
  assert.equal(registry.list()[0].enabled, false);
  await registry.enable(manifest.id);
  assert.equal(activated, 2);
  assert.equal(enabled.length, 2);
});
test('failed activation stays disabled and invalid manifests are rejected', async () => {
  const registry = new ExtensionRegistry();
  registry.register(
    defineExtension({
      manifest,
      activate() {
        throw new Error('Activation failed');
      },
    }),
  );
  await assert.rejects(() => registry.enable(manifest.id), /Activation failed/);
  assert.equal(registry.list()[0].enabled, false);
  assert.throws(() =>
    defineExtension({ manifest: { ...manifest, id: 'unqualified' }, activate() {} }),
  );
});
