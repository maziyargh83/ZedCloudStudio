import { EventBus } from '@z-cloud/core';
import type { ExtensionDefinition } from '@z-cloud/extension-sdk';
export class ExtensionRegistry {
  private entries = new Map<
    string,
    { extension: ExtensionDefinition; enabled: boolean; cleanup?: () => void }
  >();
  constructor(private events = new EventBus()) {}
  register(extension: ExtensionDefinition) {
    if (this.entries.has(extension.manifest.id))
      throw new Error(`Duplicate extension: ${extension.manifest.id}`);
    this.entries.set(extension.manifest.id, { extension, enabled: false });
  }
  list() {
    return [...this.entries.values()].map(({ extension, enabled }) => ({
      ...extension.manifest,
      enabled,
    }));
  }
  async enable(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown extension: ${id}`);
    if (entry.enabled) return;
    const cleanup = await entry.extension.activate({ events: this.events });
    entry.cleanup = cleanup ?? undefined;
    entry.enabled = true;
    this.events.emit('extension.enabled', { id });
  }
  disable(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown extension: ${id}`);
    if (!entry.enabled) return;
    entry.cleanup?.();
    entry.cleanup = undefined;
    entry.enabled = false;
    this.events.emit('extension.disabled', { id });
  }
}
