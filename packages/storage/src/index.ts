export interface StorageObject {
  key: string;
  size: number;
  mime: string;
}
export interface StorageAdapter {
  readonly kind: 'local' | 'remote';
  get(key: string): Promise<Blob | undefined>;
  put(key: string, value: Blob): Promise<StorageObject>;
  remove(key: string): Promise<void>;
}
/** Useful for tests and short-lived work. This adapter does not persist files. */
export class MemoryStorage implements StorageAdapter {
  readonly kind = 'local' as const;
  private data = new Map<string, Blob>();
  async get(key: string) {
    return this.data.get(key);
  }
  async put(key: string, value: Blob) {
    this.data.set(key, value);
    return { key, size: value.size, mime: value.type };
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}
