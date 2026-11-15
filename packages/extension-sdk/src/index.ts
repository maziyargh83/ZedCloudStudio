import { extensionManifestSchema, type ExtensionManifest } from '@z-cloud/contracts';
import type { EventBus } from '@z-cloud/core';
export interface ExtensionContext {
  events: EventBus;
}
export interface ExtensionDefinition {
  manifest: ExtensionManifest;
  activate(context: ExtensionContext): void | (() => void) | Promise<void | (() => void)>;
}
export function defineExtension(extension: ExtensionDefinition): ExtensionDefinition {
  extensionManifestSchema.parse(extension.manifest);
  return extension;
}
