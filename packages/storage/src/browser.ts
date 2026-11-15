interface BrowserAsset {
  id: string;
  src: string;
}

const DB = 'zed-cloud-media';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files'))
        request.result.createObjectStore('files', { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains('transfers'))
        request.result.createObjectStore('transfers', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadFiles<T extends BrowserAsset>(): Promise<T[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('files', 'readonly').objectStore('files').getAll();
      req.onsuccess = () =>
        resolve(
          req.result.map((record: T & { blob: Blob }) => {
            const asset: T & { blob?: Blob } = { ...record };
            delete asset.blob;
            asset.src = URL.createObjectURL(record.blob);
            return asset;
          }),
        );
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function saveFile<T extends BrowserAsset>(asset: T, blob: Blob): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ ...asset, src: '', blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`zc:${key}`) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  localStorage.setItem(`zc:${key}`, JSON.stringify(value));
}

async function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const request = action(tx);
      let value: T | undefined;
      if (request)
        request.onsuccess = () => {
          value = request.result;
        };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function saveQueuedFile<T extends BrowserAsset, J extends { id: string }>(
  asset: T,
  blob: Blob,
  job: J,
) {
  await transact(['files', 'transfers'], 'readwrite', (tx) => {
    tx.objectStore('files').put({ ...asset, src: '', blob });
    tx.objectStore('transfers').put(JSON.parse(JSON.stringify(job)));
  });
}
export async function loadTransferJobs<T>(): Promise<T[]> {
  return (
    (await transact<T[]>(['transfers'], 'readonly', (tx) =>
      tx.objectStore('transfers').getAll(),
    )) ?? []
  );
}
export async function saveTransferJob<T extends { id: string }>(job: T) {
  await transact(['transfers'], 'readwrite', (tx) => {
    tx.objectStore('transfers').put(JSON.parse(JSON.stringify(job)));
  });
}
export async function removeTransferJob(id: string) {
  await transact(['transfers'], 'readwrite', (tx) => {
    tx.objectStore('transfers').delete(id);
  });
}
export async function loadFileBlob(id: string): Promise<Blob | undefined> {
  const record = await transact<{ blob: Blob }>(['files'], 'readonly', (tx) =>
    tx.objectStore('files').get(id),
  );
  return record?.blob;
}
