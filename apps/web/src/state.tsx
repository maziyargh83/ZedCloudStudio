import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type JSX,
  useContext,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { createQuery } from '@tanstack/solid-query';
import { demoAssets, initialCollections, type Asset, type Collection } from './data';
import { loadFiles, readLocal, saveFile, writeLocal } from './storage';
import { api, API_BASE } from './api';
import type { MediaAsset } from '@z-cloud/contracts';

function createStudio() {
  const [assets, setAssets] = createStore<Asset[]>([]);
  const [collections, setCollections] = createStore<Collection[]>(
    readLocal('collections', initialCollections),
  );
  const [selected, setSelected] = createSignal<string[]>(['demo-1']);
  const [theme, setTheme] = createSignal<'dark' | 'light'>(readLocal('theme', 'dark'));
  const [direction, setDirection] = createSignal<'ltr' | 'rtl'>(readLocal('direction', 'ltr'));
  const [compact, setCompact] = createSignal(readLocal('compact', false));
  const [notice, setNotice] = createSignal('');
  let noticeTimer: ReturnType<typeof setTimeout>;
  const notify = (message: string) => {
    clearTimeout(noticeTimer);
    setNotice(message);
    noticeTimer = setTimeout(() => setNotice(''), 4500);
  };
  const files = createQuery(() => ({
    queryKey: ['local-media'],
    queryFn: loadFiles,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  }));
  const [hydrated, setHydrated] = createSignal(false);
  createEffect(() => {
    if (!files.isPending && !hydrated()) {
      const patches = readLocal<Record<string, Partial<Asset>>>('metadata', {});
      const originals = [...demoAssets, ...(files.data ?? [])];
      setAssets(reconcile(originals.map((a) => ({ ...a, ...patches[a.id], src: a.src }))));
      setHydrated(true);
    }
  });
  createEffect(() => {
    if (assets.length) {
      try {
        writeLocal(
          'metadata',
          Object.fromEntries(assets.map(({ src: _src, ...asset }) => [asset.id, asset])),
        );
      } catch {
        notify('Your browser could not save metadata. Export a backup before closing.');
      }
    }
  });
  createEffect(() => {
    writeLocal('theme', theme());
    document.documentElement.style.colorScheme = theme();
  });
  createEffect(() => {
    writeLocal('direction', direction());
    document.documentElement.dir = direction();
  });
  createEffect(() => writeLocal('compact', compact()));
  createEffect(() => writeLocal('collections', collections));
  const active = createMemo(() => assets.find((a) => a.id === selected()[0]));
  function update(id: string, patch: Partial<Asset>) {
    setAssets((a) => a.id === id, patch);
    if (assets.find((asset) => asset.id === id)?.serverId) {
      const allowed = [
        'title',
        'tags',
        'description',
        'favorite',
        'location',
        'customMetadata',
      ] as const;
      const serverPatch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => (allowed as readonly string[]).includes(key)),
      );
      if (Object.keys(serverPatch).length)
        void api(`/v1/media/${id}`, { method: 'PATCH', body: JSON.stringify(serverPatch) }).catch(
          () =>
            notify('Saved locally. The server could not be updated; retry when it is available.'),
        );
    }
  }
  function acceptImportedAsset(asset: Asset) {
    if (assets.some((existing) => existing.id === asset.id))
      setAssets((existing) => existing.id === asset.id, asset);
    else setAssets(assets.length, asset);
  }
  const serverMedia = createQuery(() => ({
    queryKey: ['server-media'],
    queryFn: () => api<{ data: MediaAsset[] }>('/v1/media'),
    refetchInterval: 10000,
    retry: false,
  }));
  createEffect(() => {
    if (!hydrated() || !serverMedia.data) return;
    for (const remote of serverMedia.data.data.filter((item) => item.source === 'upload')) {
      if (assets.some((asset) => asset.id === remote.id)) continue;
      const patches = readLocal<Record<string, Partial<Asset>>>('metadata', {});
      acceptImportedAsset({
        id: remote.id,
        title: remote.title,
        filename: remote.filename,
        type: remote.type,
        src: `${API_BASE}/v1/media/${remote.id}/content`,
        size: remote.size,
        date: remote.capturedAt.slice(0, 10),
        location: remote.location,
        collection: remote.collectionId ?? '',
        tags: remote.tags,
        description: remote.description,
        favorite: remote.favorite,
        demo: false,
        memory: '',
        draft: '',
        mime: remote.mime,
        customMetadata: remote.customMetadata,
        ...patches[remote.id],
        serverId: remote.id,
      });
    }
  });
  function select(id: string, multiple = false) {
    setSelected((previous) =>
      multiple
        ? previous.includes(id)
          ? previous.filter((x) => x !== id)
          : [...previous, id]
        : [id],
    );
  }
  async function importFiles(list: FileList | File[], collectionId = '') {
    let count = 0;
    let failed = 0;
    let unsupported = 0;
    const importedIds: string[] = [];
    for (const file of Array.from(list)) {
      const type =
        file.type.startsWith('image/') &&
        !['image/heic', 'image/heif', 'image/tiff'].includes(file.type)
          ? 'photo'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : undefined;
      if (!type) {
        unsupported++;
        continue;
      }
      const asset: Asset = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ''),
        filename: file.name,
        type,
        src: URL.createObjectURL(file),
        size: file.size,
        date: new Date(file.lastModified).toISOString().slice(0, 10),
        location: '',
        collection: collectionId,
        tags: [],
        description: '',
        favorite: false,
        demo: false,
        memory: '',
        draft: '',
        mime: file.type,
      };
      try {
        await saveFile(asset, file);
        setAssets(assets.length, asset);
        importedIds.push(asset.id);
        count++;
      } catch {
        URL.revokeObjectURL(asset.src);
        failed++;
      }
    }
    if (importedIds.length) setSelected([importedIds[0]]);
    notify(
      [
        count
          ? `${count} ${count === 1 ? 'file' : 'files'} imported and saved on this device.`
          : '',
        unsupported ? `${unsupported} unsupported file(s) skipped.` : '',
        failed ? `${failed} file(s) could not be saved. Your browser storage may be full.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  function addCollection(name: string, description: string) {
    const collection = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
    };
    setCollections(collections.length, collection);
    return collection;
  }
  function exportMetadata() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              exportedAt: new Date().toISOString(),
              assets: assets.map(({ src: _src, ...a }) => a),
              collections,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zed-cloud-metadata.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Metadata exported. Original media files stay on this device.');
  }
  onCleanup(() => {
    clearTimeout(noticeTimer);
    assets.filter((a) => !a.demo).forEach((a) => URL.revokeObjectURL(a.src));
  });
  return {
    assets,
    collections,
    selected,
    setSelected,
    select,
    active,
    update,
    theme,
    setTheme,
    direction,
    setDirection,
    compact,
    setCompact,
    notice,
    notify,
    importFiles,
    acceptImportedAsset,
    addCollection,
    exportMetadata,
    files,
  };
}
type Studio = ReturnType<typeof createStudio>;
const StudioContext = createContext<Studio>();
export function StudioProvider(props: { children: JSX.Element }) {
  const state = createStudio();
  return <StudioContext.Provider value={state}>{props.children}</StudioContext.Provider>;
}
export function useStudio() {
  const state = useContext(StudioContext);
  if (!state) throw new Error('StudioProvider is required');
  return state;
}
