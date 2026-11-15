import { MediaCard } from '@z-cloud/ui-patterns';
export { MediaCard } from '@z-cloud/ui-patterns';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { useLocation, useNavigate } from '@tanstack/solid-router';
import {
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Image,
  Video,
  AudioLines,
  ArrowDownWideNarrow,
  Check,
  Heart,
  MapPin,
  X,
  Folder,
  ChevronRight,
  ArrowUpRight,
  Expand,
  CloudOff,
  Grid2X2,
  LoaderCircle,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { Button, IconButton, Badge, Dropdown, EmptyState, Dialog } from '@z-cloud/ui';
import { useStudio } from '../state';
import { formatDate, type Asset } from '../data';
import { openImport } from '../shell';

export function Library() {
  const s = useStudio();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = createSignal('');
  const [kind, setKind] = createSignal('all');
  const [tag, setTag] = createSignal('all');
  const [sort, setSort] = createSignal('newest');
  const [view, setView] = createSignal<'grid' | 'list'>('grid');
  const [density, setDensity] = createSignal(false);
  const [preview, setPreview] = createSignal<Asset>();
  const [filters, setFilters] = createSignal(false);
  const collection = createMemo(() =>
    s.collections.find((c) => location().pathname === `/collections/${c.id}`),
  );
  const favorites = createMemo(() => location().pathname.endsWith('/favorites'));
  const recent = createMemo(() => location().pathname.endsWith('/recent'));
  const title = createMemo(
    () =>
      collection()?.name ??
      (favorites() ? 'Favorites' : recent() ? 'Recent imports' : 'Media library'),
  );
  const source = createMemo(() =>
    s.assets.filter(
      (a) =>
        (!collection() || a.collection === collection()?.id) &&
        (!favorites() || a.favorite) &&
        (!recent() || !a.demo),
    ),
  );
  const tags = createMemo(() => [...new Set(source().flatMap((a) => a.tags))].sort());
  const filtered = createMemo(() => {
    const search = query().toLowerCase().trim();
    return source()
      .filter(
        (a) =>
          (kind() === 'all' || a.type === kind()) &&
          (tag() === 'all' || a.tags.includes(tag())) &&
          (!search ||
            [a.title, a.filename, a.location, ...a.tags].join(' ').toLowerCase().includes(search)),
      )
      .sort((a, b) =>
        sort() === 'name'
          ? a.title.localeCompare(b.title)
          : sort() === 'oldest'
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date),
      );
  });
  const selectedVisible = createMemo(() => filtered().filter((a) => s.selected().includes(a.id)));
  const reset = () => {
    setQuery('');
    setKind('all');
    setTag('all');
  };
  function batchFavorite() {
    const add = selectedVisible().some((a) => !a.favorite);
    selectedVisible().forEach((a) => s.update(a.id, { favorite: add }));
    s.notify(`${selectedVisible().length} assets ${add ? 'added to' : 'removed from'} favorites.`);
  }
  return (
    <div {...stylex.attrs(lib.page)}>
      <div {...stylex.attrs(lib.pageHeader)}>
        <div>
          <div {...stylex.attrs(lib.eyebrow)}>YOUR CREATIVE WORLD</div>
          <h1 {...stylex.attrs(lib.title)}>
            {title()}
            <span aria-hidden="true" {...stylex.attrs(lib.titleCount)}>
              {source().length}
            </span>
          </h1>
          <p {...stylex.attrs(lib.subtitle)}>
            {collection()?.description ??
              (favorites()
                ? 'The moments you keep coming back to.'
                : recent()
                  ? 'Your own files, saved on this device.'
                  : 'Everything you capture. Room for what comes next.')}
          </p>
        </div>
        <Button variant="primary" onClick={openImport}>
          <Plus size={15} />
          Import media
        </Button>
      </div>
      <Show when={!collection() && !favorites() && !recent()}>
        <section {...stylex.attrs(lib.featured)} aria-label="Featured collection">
          <img
            src={s.assets.find((a) => a.collection === 'alpine')?.src}
            alt="Featured collection cover"
            {...stylex.attrs(lib.heroImage)}
          />
          <div {...stylex.attrs(lib.heroScrim)} />
          <div {...stylex.attrs(lib.heroContent)}>
            <div {...stylex.attrs(lib.heroEyebrow)}>
              <Folder size={11} />
              FEATURED COLLECTION<span {...stylex.attrs(lib.heroDemo)}>DEMO</span>
            </div>
            <h2 {...stylex.attrs(lib.heroTitle)}>Alpine escape</h2>
            <p {...stylex.attrs(lib.heroDescription)}>A little further from everything.</p>
            <button
              onClick={() =>
                void navigate({
                  to: '/collections/$collectionId',
                  params: { collectionId: 'alpine' },
                })
              }
              {...stylex.attrs(lib.heroLink)}
            >
              Explore collection <ArrowUpRight size={14} />
            </button>
          </div>
          <div {...stylex.attrs(lib.heroBottom)}>
            <span>OCTOBER 21—24, 2026</span>
            <span>
              {s.assets.filter((a) => a.collection === 'alpine').length} photographs{' '}
              <span {...stylex.attrs(lib.heroDot)}>·</span> A story in the making
            </span>
          </div>
          <span {...stylex.attrs(lib.heroIndex)}>01 / 03</span>
        </section>
      </Show>
      <div {...stylex.attrs(lib.controls)}>
        <div {...stylex.attrs(lib.typeTabs)} role="group" aria-label="Media type">
          <For
            each={[
              { id: 'all', label: 'All media', icon: Grid2X2 },
              { id: 'photo', label: 'Photos', icon: Image },
              { id: 'video', label: 'Videos', icon: Video },
              { id: 'audio', label: 'Audio', icon: AudioLines },
            ]}
          >
            {(t) => (
              <button
                onClick={() => setKind(t.id)}
                aria-pressed={kind() === t.id}
                {...stylex.attrs(lib.typeTab, kind() === t.id && lib.typeTabActive)}
              >
                <t.icon size={13} />
                {t.label}
                <span {...stylex.attrs(lib.typeCount)}>
                  {source().filter((a) => t.id === 'all' || a.type === t.id).length}
                </span>
              </button>
            )}
          </For>
        </div>
        <div {...stylex.attrs(lib.filterRow)}>
          <label {...stylex.attrs(lib.search)}>
            <Search size={14} />
            <input
              aria-label="Search media"
              placeholder="Search your library…"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              {...stylex.attrs(lib.searchInput)}
            />
            <Show when={query()}>
              <IconButton label="Clear search" onClick={() => setQuery('')}>
                <X size={12} />
              </IconButton>
            </Show>
          </label>
          <Button
            variant={filters() ? 'primary' : 'secondary'}
            onClick={() => setFilters((v) => !v)}
            aria-expanded={filters()}
          >
            <SlidersHorizontal size={13} />
            <span {...stylex.attrs(lib.hideSmall)}>Filters</span>
            <Show when={tag() !== 'all'}>
              <span>1</span>
            </Show>
          </Button>
          <div {...stylex.attrs(lib.viewGroup)}>
            <IconButton
              label="Grid view"
              active={view() === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={14} />
            </IconButton>
            <IconButton
              label="List view"
              active={view() === 'list'}
              onClick={() => setView('list')}
            >
              <List size={15} />
            </IconButton>
          </div>
        </div>
      </div>
      <Show when={filters()}>
        <div {...stylex.attrs(lib.filterPanel)}>
          <span>Filter by tag</span>
          <button
            {...stylex.attrs(lib.tag, tag() === 'all' && lib.tagActive)}
            onClick={() => setTag('all')}
          >
            All tags
          </button>
          <For each={tags()}>
            {(t) => (
              <button
                onClick={() => setTag(t)}
                {...stylex.attrs(lib.tag, tag() === t && lib.tagActive)}
              >
                {t}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={s.files.isError}>
        <div role="alert" {...stylex.attrs(lib.errorBanner)}>
          Browser storage is unavailable. Sample media is still available; imported files cannot be
          restored.
        </div>
      </Show>
      <div {...stylex.attrs(lib.gridHeader)}>
        <div {...stylex.attrs(lib.gridHeading)}>
          <h2>
            {query() || tag() !== 'all'
              ? 'Search results'
              : collection()
                ? 'Collection assets'
                : 'Your library'}
          </h2>
          <span>{filtered().length} assets</span>
        </div>
        <div {...stylex.attrs(lib.gridActions)}>
          <Show when={selectedVisible().length > 1}>
            <Button size="sm" onClick={batchFavorite}>
              <Heart size={12} />
              {selectedVisible().length} selected
            </Button>
          </Show>
          <Dropdown
            label={
              sort() === 'newest'
                ? 'Newest first'
                : sort() === 'oldest'
                  ? 'Oldest first'
                  : 'Name A–Z'
            }
            icon={<ArrowDownWideNarrow size={12} />}
            items={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name', label: 'Name A–Z' },
            ]}
            onSelect={setSort}
          />
          <Show when={view() === 'grid'}>
            <IconButton
              label={density() ? 'Larger thumbnails' : 'Smaller thumbnails'}
              active={density()}
              onClick={() => setDensity((v) => !v)}
            >
              <Grid2X2 size={13} />
            </IconButton>
          </Show>
        </div>
      </div>
      <Show
        when={!s.files.isPending}
        fallback={
          <div {...stylex.attrs(lib.loading)}>
            <LoaderCircle size={20} />
            Opening your library…
          </div>
        }
      >
        <Show
          when={filtered().length}
          fallback={
            <EmptyState
              icon={<Search size={26} />}
              title={source().length ? 'No moments found' : 'Make room for a new story'}
              description={
                source().length
                  ? 'Try a different search or clear your filters.'
                  : 'Import a few files to start building this part of your world.'
              }
              action={
                source().length ? (
                  <Button onClick={reset}>Clear filters</Button>
                ) : (
                  <Button variant="primary" onClick={openImport}>
                    <Plus size={14} />
                    Import media
                  </Button>
                )
              }
            />
          }
        >
          <div
            {...stylex.attrs(
              lib.grid,
              (density() || s.compact()) && lib.denseGrid,
              view() === 'list' && lib.list,
            )}
            role="group"
            aria-label="Media assets"
          >
            <For each={filtered()}>
              {(a) => (
                <MediaCard
                  dateLabel={formatDate(a.date)}
                  asset={a}
                  selected={s.selected().includes(a.id)}
                  list={view() === 'list'}
                  onSelect={(multi) => s.select(a.id, multi)}
                  onPreview={() => setPreview(a)}
                  onFavorite={() => s.update(a.id, { favorite: !a.favorite })}
                />
              )}
            </For>
          </div>
          <div {...stylex.attrs(lib.libraryEnd)}>
            <span {...stylex.attrs(lib.endLine)} />
            <span>You’re all caught up. Go make something.</span>
            <span {...stylex.attrs(lib.endLine)} />
          </div>
        </Show>
      </Show>
      <MediaPreview asset={preview()} onClose={() => setPreview(undefined)} />
    </div>
  );
}
export function MediaPreview(props: { asset?: Asset; onClose: () => void }) {
  const [error, setError] = createSignal(false);
  return (
    <Dialog
      open={Boolean(props.asset)}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
          setError(false);
        }
      }}
      title={props.asset?.title ?? 'Media preview'}
      wide
    >
      <Show when={props.asset}>
        {(a) => (
          <>
            <Show
              when={!error()}
              fallback={
                <EmptyState
                  icon={<Video size={28} />}
                  title="This format can’t be previewed here"
                  description="The original is safely stored. Download it to open in a compatible application."
                  action={
                    <a href={a().src} download={a().filename}>
                      <Button>Download original</Button>
                    </a>
                  }
                />
              }
            >
              <Show when={a().type === 'photo'}>
                <img
                  src={a().src}
                  alt={a().title}
                  {...stylex.attrs(lib.previewImage)}
                  onError={() => setError(true)}
                />
              </Show>
              <Show when={a().type === 'video'}>
                <video
                  controls
                  src={a().src}
                  {...stylex.attrs(lib.previewImage)}
                  onError={() => setError(true)}
                >
                  <track kind="captions" />
                </video>
              </Show>
              <Show when={a().type === 'audio'}>
                <audio controls src={a().src} onError={() => setError(true)} />
              </Show>
            </Show>
            <div {...stylex.attrs(lib.previewFooter)}>
              <span>{a().location || a().filename}</span>
              <span>{formatDate(a().date)}</span>
            </div>
          </>
        )}
      </Show>
    </Dialog>
  );
}
export const lib = stylex.create({
  page: {
    padding: { default: 28, '@media (max-width: 1200px)': 24, '@media (max-width: 600px)': 16 },
    paddingBottom: 16,
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: '1.6px',
    fontWeight: 500,
    color: colors.muted,
    marginBottom: 8,
  },
  title: {
    fontSize: { default: 28, '@media (max-width: 600px)': 24 },
    fontWeight: 550,
    letterSpacing: '-1px',
    lineHeight: 1.25,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  titleCount: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.muted,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 5,
    paddingInline: 7,
    paddingBlock: 3,
    letterSpacing: 0,
  },
  subtitle: { fontSize: 11, color: colors.muted, marginTop: 8, maxWidth: 450, lineHeight: 1.7 },
  featured: {
    height: 188,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 24,
    backgroundColor: colors.surface,
  },
  heroImage: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 55%' },
  heroScrim: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(90deg,rgba(0,0,0,.68) 0%,rgba(0,0,0,.08) 100%),linear-gradient(0deg,rgba(0,0,0,.5),transparent 55%)',
  },
  heroContent: {
    position: 'absolute',
    insetBlockStart: 22,
    insetInlineStart: 24,
    color: colors.mediaText,
  },
  heroEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 8,
    letterSpacing: '1.5px',
    fontWeight: 500,
  },
  heroDemo: {
    fontSize: 7,
    letterSpacing: '0.8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,.4)',
    borderRadius: 3,
    paddingInline: 4,
    lineHeight: '14px',
  },
  heroTitle: { fontSize: 30, fontWeight: 500, letterSpacing: '-0.8px', marginTop: 10 },
  heroDescription: { fontSize: 11, opacity: 0.8, marginTop: 2 },
  heroLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    padding: 0,
    color: colors.mediaText,
    fontSize: 10,
    fontWeight: 500,
  },
  heroBottom: {
    position: 'absolute',
    bottom: 16,
    insetInline: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    color: colors.mediaText,
    fontSize: 8,
    letterSpacing: '0.6px',
  },
  heroDot: { paddingInline: 6 },
  heroIndex: {
    position: 'absolute',
    insetBlockStart: 22,
    insetInlineEnd: 24,
    color: colors.mediaText,
    fontSize: 9,
    letterSpacing: 1,
  },
  controls: { display: 'flex', flexDirection: 'column', gap: 16 },
  typeTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: { default: 24, '@media (max-width: 600px)': 14 },
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    overflowX: 'auto',
  },
  typeTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingInline: 0,
    paddingBlock: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: { default: colors.muted, ':hover': colors.text },
    backgroundColor: 'transparent',
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  typeTabActive: { color: colors.text, borderBottomColor: colors.accent },
  typeCount: {
    fontSize: 9,
    color: colors.secondary,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    paddingInline: 4,
    lineHeight: '16px',
  },
  filterRow: { display: 'flex', alignItems: 'center', gap: 8 },
  search: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingInline: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    color: colors.muted,
    flex: 1,
    minWidth: 0,
  },
  searchInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    color: colors.text,
    outline: 'none',
    width: '100%',
    minWidth: 0,
    fontSize: 11,
    '::placeholder': { color: colors.muted },
  },
  viewGroup: {
    display: 'flex',
    alignItems: 'center',
    padding: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
  },
  hideSmall: { display: { default: 'inline', '@media (max-width: 600px)': 'none' } },
  filterPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    marginTop: 12,
    color: colors.muted,
    fontSize: 10,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 4,
    paddingInline: 7,
    paddingBlock: 3,
    backgroundColor: colors.surfaceAlt,
    color: colors.secondary,
    fontSize: 10,
  },
  tagActive: {
    backgroundColor: colors.accentSubtle,
    color: colors.accent,
    borderColor: colors.accent,
  },
  gridHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 24,
    marginBottom: 14,
  },
  gridHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 10,
    color: colors.muted,
  },
  gridActions: { display: 'flex', alignItems: 'center', gap: 6 },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3,minmax(0,1fr))',
      '@media (min-width: 1800px)': 'repeat(4,minmax(0,1fr))',
      '@media (max-width: 1150px)': 'repeat(2,minmax(0,1fr))',
      '@media (max-width: 600px)': 'repeat(2,minmax(0,1fr))',
    },
    gap: 16,
    rowGap: 20,
  },
  denseGrid: {
    gridTemplateColumns: {
      default: 'repeat(4,minmax(0,1fr))',
      '@media (max-width: 1150px)': 'repeat(3,minmax(0,1fr))',
      '@media (max-width: 600px)': 'repeat(2,minmax(0,1fr))',
    },
    gap: 10,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  libraryEnd: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBlock: 32,
    color: colors.muted,
    fontSize: 9,
  },
  endLine: { width: 24, height: 1, backgroundColor: colors.border },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
    gap: 12,
    color: colors.muted,
  },
  errorBanner: {
    padding: 12,
    backgroundColor: colors.accentSubtle,
    color: colors.warning,
    fontSize: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  previewImage: {
    maxHeight: '65dvh',
    objectFit: 'contain',
    width: '100%',
    backgroundColor: colors.canvas,
    borderRadius: 6,
  },
  previewFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    color: colors.muted,
    fontSize: 11,
  },
});
