import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type JSX,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import {
  saveQueuedFile,
  loadTransferJobs,
  saveTransferJob,
  removeTransferJob,
  loadFileBlob,
  saveFile,
  readLocal,
  writeLocal,
} from '@z-cloud/storage/browser';
import {
  uploadMetadataSchema,
  type UploadMetadata,
  type TransferJob,
  type StorageServer,
  type PublicUploadSession,
} from '@z-cloud/contracts';
import { api, ApiError, API_BASE } from './api';
import { useStudio } from './state';
import type { Asset } from './data';

export interface ImportDraft {
  id: string;
  file: File;
  metadata: UploadMetadata;
}
function createTransfers() {
  const studio = useStudio();
  const [jobs, setJobs] = createStore<TransferJob[]>([]);
  const [ready, setReady] = createSignal(false);
  const [servers, setServers] = createSignal<StorageServer[]>(readLocal('storage-servers', []));
  const [connectionError, setConnectionError] = createSignal('');
  const active = new Map<string, AbortController>();
  let timer: ReturnType<typeof setInterval>;
  let stopped = false;
  let persistence = Promise.resolve();
  function persist(job: TransferJob) {
    const value = JSON.parse(JSON.stringify(job));
    persistence = persistence
      .then(() => saveTransferJob(value))
      .catch(() => {
        studio.notify('Queue changes could not be saved. Check browser storage.');
      });
  }
  function patch(id: string, values: Partial<TransferJob>, save = true) {
    setJobs((job) => job.id === id, { ...values, updatedAt: new Date().toISOString() });
    const job = jobs.find((job) => job.id === id);
    if (save && job) persist(job);
  }
  async function refreshServers() {
    try {
      const data = (await api<{ data: StorageServer[] }>('/v1/servers')).data;
      setServers(data);
      writeLocal('storage-servers', data);
      setConnectionError('');
    } catch (error) {
      setConnectionError((error as Error).message);
    }
  }
  function fromSession(session: PublicUploadSession) {
    return {
      status: session.status,
      phase: session.phase,
      receivedBytes: session.receivedBytes,
      destinationBytes: session.destinationBytes,
      error: session.error,
    };
  }
  function assetFor(job: TransferJob, src: string): Asset {
    const metadata = job.metadata;
    return {
      id: job.id,
      title: metadata.title,
      filename: metadata.filename,
      type: metadata.type,
      src,
      size: metadata.size,
      date: metadata.capturedAt.slice(0, 10),
      location: metadata.location,
      collection: metadata.collectionId ?? '',
      tags: metadata.tags,
      description: metadata.description,
      favorite: metadata.favorite,
      demo: false,
      memory: '',
      draft: '',
      mime: metadata.mime,
      customMetadata: metadata.customMetadata,
    };
  }
  async function enqueue(drafts: ImportDraft[], destination: StorageServer, start: boolean) {
    let added = 0;
    for (const draft of drafts) {
      if (jobs.some((job) => job.id === draft.id)) continue;
      const validated = uploadMetadataSchema.safeParse(draft.metadata);
      if (!validated.success)
        throw new Error(
          'Check the title, tags and custom fields. Each tag supports up to 64 characters and custom values up to 2,000.',
        );
      const now = new Date().toISOString();
      const job: TransferJob = {
        id: draft.id,
        metadata: validated.data,
        destinationId: destination.id,
        destinationName: destination.name,
        status: start ? 'queued' : 'paused',
        phase: 'receiving',
        receivedBytes: 0,
        destinationBytes: 0,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      const src = URL.createObjectURL(draft.file);
      const asset = assetFor(job, src);
      try {
        await saveQueuedFile(asset, draft.file, job);
        studio.acceptImportedAsset(asset);
        setJobs(jobs.length, job);
        added++;
      } catch {
        URL.revokeObjectURL(src);
        throw new Error(
          `${added} files were added. The next file could not be saved; check available browser storage.`,
        );
      }
    }
    if (drafts[0]) studio.setSelected([drafts[0].id]);
    studio.notify(`${added} files added to the upload queue.`);
    pump();
  }
  async function serverControl(id: string, action: 'pause' | 'resume' | 'cancel') {
    try {
      return (
        await api<{ data: PublicUploadSession }>(`/v1/uploads/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        })
      ).data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return;
      throw error;
    }
  }
  async function control(id: string, action: 'pause' | 'resume' | 'cancel') {
    active.get(id)?.abort();
    patch(id, {
      status: action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : 'queued',
      error: undefined,
    });
    try {
      const session = await serverControl(id, action);
      if (session)
        patch(id, {
          ...fromSession(session),
          ...(action === 'resume' && session.status === 'uploading'
            ? { status: 'queued' as const }
            : {}),
        });
    } catch (error) {
      if (action === 'resume' || action === 'cancel')
        patch(id, { status: 'failed', error: (error as Error).message });
    }
    if (action === 'resume') pump();
  }
  async function edit(id: string, metadata: UploadMetadata) {
    const job = jobs.find((item) => item.id === id);
    if (!job || !['paused', 'failed'].includes(job.status))
      throw new Error('Pause this transfer before editing.');
    try {
      await api(`/v1/uploads/${id}`, { method: 'PATCH', body: JSON.stringify({ metadata }) });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
    patch(id, { metadata: uploadMetadataSchema.parse(metadata) });
    const asset = studio.assets.find((asset) => asset.id === id);
    if (asset)
      studio.update(id, {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        location: metadata.location,
        collection: metadata.collectionId ?? '',
        customMetadata: metadata.customMetadata,
      });
  }
  async function attachFile(id: string, file: File) {
    const job = jobs.find((job) => job.id === id);
    if (!job) return;
    if (file.size !== job.metadata.size || file.name !== job.metadata.filename)
      throw new Error('Choose the same original filename and size.');
    const asset = assetFor(job, URL.createObjectURL(file));
    await saveFile(asset, file);
    studio.acceptImportedAsset(asset);
    await control(id, 'resume');
  }
  async function clearCompleted() {
    for (const job of jobs.filter((job) => ['completed', 'cancelled'].includes(job.status)))
      await removeTransferJob(job.id);
    setJobs(reconcile(jobs.filter((job) => !['completed', 'cancelled'].includes(job.status))));
  }
  function uploadChunk(
    id: string,
    index: number,
    blob: Blob,
    before: number,
    controller: AbortController,
  ) {
    return new Promise<PublicUploadSession>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API_BASE}/v1/uploads/${id}/chunks/${index}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 180000;
      const abort = () => xhr.abort();
      controller.signal.addEventListener('abort', abort, { once: true });
      const cleanup = () => controller.signal.removeEventListener('abort', abort);
      xhr.upload.onprogress = (event) =>
        patch(
          id,
          {
            receivedBytes: Math.min(
              before + event.loaded,
              jobs.find((job) => job.id === id)!.metadata.size,
            ),
          },
          false,
        );
      xhr.onload = () => {
        cleanup();
        let result;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError('The server returned an unreadable response.'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(result.data);
        else reject(new ApiError(result.error ?? 'A file chunk could not be sent.', xhr.status));
      };
      xhr.onerror = () => {
        cleanup();
        reject(new ApiError('The connection was interrupted. Your uploaded chunks are preserved.'));
      };
      xhr.ontimeout = () => {
        cleanup();
        reject(new ApiError('The upload timed out. Retry to continue from saved chunks.'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('Paused', 'AbortError'));
      };
      if (controller.signal.aborted) {
        cleanup();
        reject(new DOMException('Paused', 'AbortError'));
      } else xhr.send(blob);
    });
  }
  async function run(id: string, controller: AbortController) {
    const job = jobs.find((job) => job.id === id)!;
    const signal = controller.signal;
    patch(id, { status: 'uploading', attempts: job.attempts + 1, error: undefined });
    try {
      let session = (
        await api<{ data: PublicUploadSession }>('/v1/uploads', {
          method: 'POST',
          body: JSON.stringify({ id, metadata: job.metadata, destinationId: job.destinationId }),
          signal,
        })
      ).data;
      signal.throwIfAborted();
      patch(id, fromSession(session));
      if (['paused', 'failed', 'cancelled'].includes(session.status)) return;
      if (session.phase === 'receiving') {
        const blob = await loadFileBlob(id);
        if (!blob)
          throw new Error(
            'The original is unavailable in this browser. Select the original file to continue.',
          );
        for (let index = 0; index < Math.ceil(blob.size / session.chunkSize); index++) {
          signal.throwIfAborted();
          const part = blob.slice(
            index * session.chunkSize,
            Math.min(blob.size, (index + 1) * session.chunkSize),
          );
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', await part.arrayBuffer())),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join('');
          if (session.receivedChunks.includes(index)) {
            if (session.chunkHashes?.[String(index)] !== hash)
              throw new Error(
                'This original does not match the saved chunks. Choose the same original file.',
              );
            continue;
          }
          session = await uploadChunk(id, index, part, session.receivedBytes, controller);
          if (session.chunkHashes?.[String(index)] !== hash)
            throw new Error('The received chunk could not be verified. Retry to check it again.');
          signal.throwIfAborted();
          patch(id, fromSession(session));
        }
        session = (
          await api<{ data: PublicUploadSession }>(`/v1/uploads/${id}/complete`, {
            method: 'POST',
            body: '{}',
            signal,
          })
        ).data;
        patch(id, fromSession(session));
      }
      while (!['completed', 'failed', 'paused', 'cancelled'].includes(session.status)) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
          }, 700);
          const abort = () => {
            clearTimeout(timeout);
            reject(new DOMException('Paused', 'AbortError'));
          };
          signal.addEventListener('abort', abort, { once: true });
        });
        signal.throwIfAborted();
        session = (await api<{ data: PublicUploadSession }>(`/v1/uploads/${id}`, { signal })).data;
        patch(id, fromSession(session));
      }
      if (session.status === 'completed') {
        const existing = studio.assets.find((asset) => asset.id === id);
        if (existing) studio.update(id, { serverId: id });
        else
          studio.acceptImportedAsset({
            ...assetFor(job, `${API_BASE}/v1/media/${id}/content`),
            serverId: id,
          });
      }
    } catch (error) {
      if (!signal.aborted) patch(id, { status: 'failed', error: (error as Error).message });
    }
  }
  function pump() {
    if (stopped || !ready()) return;
    for (const job of jobs) {
      if (active.size >= 2) break;
      if (job.status !== 'queued' || active.has(job.id)) continue;
      const controller = new AbortController();
      active.set(job.id, controller);
      const work = async () => {
        if (navigator.locks)
          await navigator.locks.request(`zcloud-upload-${job.id}`, { ifAvailable: true }, (lock) =>
            lock ? run(job.id, controller) : Promise.resolve(),
          );
        else await run(job.id, controller);
      };
      void work().finally(() => active.delete(job.id));
    }
  }
  onMount(() => {
    void loadTransferJobs<TransferJob>()
      .then((saved) => {
        setJobs(
          reconcile(
            saved.map((job) => ({
              ...job,
              status: job.status === 'uploading' ? ('queued' as const) : job.status,
            })),
          ),
        );
        setReady(true);
        pump();
      })
      .catch(() => {
        setReady(true);
        studio.notify('The upload queue could not be opened.');
      });
    void refreshServers();
    timer = setInterval(pump, 1000);
  });
  onCleanup(() => {
    stopped = true;
    clearInterval(timer);
    for (const controller of active.values()) controller.abort();
  });
  const pending = createMemo(
    () => jobs.filter((job) => !['completed', 'cancelled'].includes(job.status)).length,
  );
  return {
    jobs,
    ready,
    servers,
    refreshServers,
    connectionError,
    pending,
    enqueue,
    control,
    edit,
    attachFile,
    clearCompleted,
  };
}
const Context = createContext<ReturnType<typeof createTransfers>>();
export function TransferProvider(props: { children: JSX.Element }) {
  const value = createTransfers();
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
export function useTransfers() {
  const value = useContext(Context);
  if (!value) throw new Error('TransferProvider is required');
  return value;
}
