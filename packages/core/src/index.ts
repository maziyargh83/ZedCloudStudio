import type { AssetPatch, CreateAsset, MediaAsset } from '@z-cloud/contracts';
export * from './reviews';
export interface MediaRepository {
  list(): Promise<MediaAsset[]>;
  find(id: string): Promise<MediaAsset | undefined>;
  create(input: CreateAsset, id?: string): Promise<MediaAsset>;
  update(id: string, patch: AssetPatch): Promise<MediaAsset | undefined>;
  compareAndUpdate?(
    id: string,
    expected: AssetPatch,
    patch: AssetPatch,
  ): Promise<MediaAsset | undefined>;
}
export type DomainEvents = {
  'media.imported': { asset: MediaAsset };
  'media.updated': { asset: MediaAsset };
  'extension.enabled': { id: string };
  'extension.disabled': { id: string };
};
export class EventBus {
  private listeners = new Map<keyof DomainEvents, Set<(event: never) => void>>();
  on<K extends keyof DomainEvents>(name: K, listener: (event: DomainEvents[K]) => void) {
    const group = this.listeners.get(name) ?? new Set();
    group.add(listener as (event: never) => void);
    this.listeners.set(name, group);
    return () => {
      group.delete(listener as (event: never) => void);
    };
  }
  emit<K extends keyof DomainEvents>(name: K, event: DomainEvents[K]) {
    for (const listener of this.listeners.get(name) ?? []) listener(event as never);
  }
}
