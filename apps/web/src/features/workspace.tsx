import { For, Show, createMemo, createSignal } from 'solid-js';
import { useLocation, useNavigate } from '@tanstack/solid-router';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Compass,
  BookOpen,
  Sparkles,
  Send,
  CalendarDays,
  Check,
  Folder,
  HardDrive,
  Image,
  Video,
  AudioLines,
  ShieldCheck,
  Blocks,
  Sun,
  Moon,
  Monitor,
  Download,
  LibraryBig,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import {
  Button,
  Badge,
  Surface,
  EmptyState,
  TextField,
  Textarea,
  Dialog,
  Tabs,
  Dropdown,
} from '@z-cloud/ui';
import { ExtensionRegistry } from '@z-cloud/extension-runtime';
import mediaLibrary from '@z-cloud/media-library';
import { useStudio } from '../state';
import { formatBytes, formatDate, type Asset } from '../data';
import { openImport } from '../shell';
import { lib, MediaCard } from './library';
import { readLocal, writeLocal } from '../storage';
import { AIWorkspace } from './ai-workspace';

export function WorkspacePage(props: { notFound?: boolean }) {
  const s = useStudio();
  const location = useLocation();
  const navigate = useNavigate();
  const path = createMemo(() => location().pathname);
  const [editing, setEditing] = createSignal<Asset>();
  const [note, setNote] = createSignal('');
  const go = (to: string) => void navigate({ to });
  const registry = new ExtensionRegistry();
  registry.register(mediaLibrary);
  const [extensionEnabled, setExtensionEnabled] = createSignal(false);
  const [tab, setTab] = createSignal('one');
  const [showDialog, setShowDialog] = createSignal(false);
  const notes = createMemo(() => s.assets.filter((a) => a.memory));
  const drafts = createMemo(() => s.assets.filter((a) => a.draft));
  const name = createMemo(
    () =>
      ({
        '/studio': 'Your studio',
        '/adventures': 'Adventures',
        '/memories': 'Memories',
        '/ai': 'AI workspace',
        '/planner': 'Content planner',
        '/publications': 'Publications',
        '/insights': 'Library insights',
        '/extensions': 'Extensions',
        '/settings': 'Settings',
        '/dev/ui': 'Design system',
      })[path()] ?? 'Page not found',
  );
  const descriptions: Record<string, string> = {
    '/studio': 'A quiet place to pick up where you left off.',
    '/adventures': 'The places you went. The stories you brought back.',
    '/memories': 'Keep a little more than the photograph.',
    '/ai': 'Creative support, with you in control.',
    '/planner': 'Give your next story a little room to grow.',
    '/publications': 'From a private moment to a story worth sharing.',
    '/insights': 'A clear picture of what lives in your workspace.',
    '/extensions': 'A small core. Room to make it yours.',
    '/settings': 'Make yourself at home.',
    '/dev/ui': 'The foundations of a quieter creative tool.',
  };
  function edit(a: Asset) {
    setEditing(a);
    setNote(path() === '/memories' ? a.memory : a.draft);
  }
  return (
    <div {...stylex.attrs(lib.page)}>
      <div {...stylex.attrs(lib.pageHeader)}>
        <div>
          <div {...stylex.attrs(lib.eyebrow)}>Z CLOUD STUDIO</div>
          <h1 {...stylex.attrs(lib.title)}>{name()}</h1>
          <p {...stylex.attrs(lib.subtitle)}>{descriptions[path()]}</p>
        </div>
        <Show when={['/studio', '/adventures'].includes(path())}>
          <Button variant="primary" onClick={openImport}>
            <Plus size={14} />
            Import media
          </Button>
        </Show>
      </div>
      <Show when={props.notFound}>
        <EmptyState
          icon={<Compass size={28} />}
          title="A little off the trail"
          description="This page doesn’t exist. Your library is right where you left it."
          action={<Button onClick={() => go('/library')}>Back to library</Button>}
        />
      </Show>
      <Show when={path() === '/studio'}>
        <section {...stylex.attrs(ws.welcome)}>
          <div>
            <Badge tone="accent">YOUR SPACE TO CREATE</Badge>
            <h2 {...stylex.attrs(ws.editorialHeading)}>
              Good stories start
              <br />
              with being there.
            </h2>
            <p {...stylex.attrs(ws.copy)}>
              Gather the little moments. Give them a home.
              <br />
              The next chapter can wait until you’re ready.
            </p>
            <Button onClick={() => go('/library')}>
              Open your library
              <ArrowRight size={14} />
            </Button>
          </div>
          <Show when={s.assets[0]}>
            <img
              src={s.assets[0]?.src}
              alt={s.assets[0]?.title ?? 'Your media'}
              {...stylex.attrs(ws.welcomeImage)}
            />
          </Show>
        </section>
        <div {...stylex.attrs(ws.sectionHeading)}>
          <h2>Pick up a collection</h2>
          <Button variant="ghost" onClick={() => go('/adventures')}>
            All adventures
            <ArrowUpRight size={13} />
          </Button>
        </div>
        <CollectionCards />
        <div {...stylex.attrs(ws.sectionHeading)}>
          <h2>Recently added</h2>
          <Button variant="ghost" onClick={() => go('/library')}>
            View library
            <ArrowUpRight size={13} />
          </Button>
        </div>
        <div {...stylex.attrs(lib.grid)}>
          <For each={s.assets.slice(-6).reverse()}>
            {(a) => (
              <MediaCard
                asset={a}
                selected={s.selected().includes(a.id)}
                onSelect={() => {
                  s.select(a.id);
                  go('/library');
                }}
                onPreview={() => {
                  s.select(a.id);
                  go('/library');
                }}
                onFavorite={() => s.update(a.id, { favorite: !a.favorite })}
              />
            )}
          </For>
        </div>
      </Show>
      <Show when={path() === '/adventures'}>
        <CollectionCards />
        <div {...stylex.attrs(ws.quietNote)}>
          <Compass size={16} />
          <p>
            Each adventure is a collection of moments. Add your media, then open the Memories tab in
            the inspector to keep the story behind it.
          </p>
        </div>
      </Show>
      <Show when={path() === '/memories'}>
        <Show
          when={notes().length}
          fallback={
            <EmptyState
              icon={<BookOpen size={30} />}
              title="The story beyond the frame"
              description="Select a photograph in your library and open Memories in the inspector to write your first note."
              action={
                <Button variant="primary" onClick={() => go('/library')}>
                  Find a moment
                  <ArrowRight size={14} />
                </Button>
              }
            />
          }
        >
          <div {...stylex.attrs(ws.notes)}>
            <For each={notes()}>
              {(a) => (
                <button onClick={() => edit(a)} {...stylex.attrs(ws.noteCard)}>
                  <img src={a.src} alt={a.title} {...stylex.attrs(ws.noteImage)} />
                  <div {...stylex.attrs(ws.noteContent)}>
                    <span {...stylex.attrs(ws.smallLabel)}>{formatDate(a.date)}</span>
                    <h2>{a.title}</h2>
                    <p {...stylex.attrs(ws.copy)}>{a.memory}</p>
                    <span {...stylex.attrs(ws.smallLabel)}>
                      PRIVATE MEMORY
                      <ArrowUpRight size={11} />
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={path() === '/ai'}>
        <AIWorkspace />
      </Show>
      <Show when={path() === '/planner' || path() === '/publications'}>
        <div {...stylex.attrs(ws.infoStrip)}>
          <Send size={16} />
          <div>
            <strong>You’re in draft mode</strong>
            <p>
              Local drafts work today. Scheduling, YouTube sign-in, and publishing are not connected
              yet.
            </p>
          </div>
          <Badge>LOCAL DRAFTS</Badge>
        </div>
        <Show
          when={drafts().length}
          fallback={
            <EmptyState
              icon={<CalendarDays size={28} />}
              title="Make something worth sharing"
              description="Open an asset in the library, then use the Publish tab to start a caption. Your drafts will appear here."
              action={
                <Button onClick={() => go('/library')}>
                  Choose an asset
                  <ArrowRight size={14} />
                </Button>
              }
            />
          }
        >
          <div {...stylex.attrs(ws.notes)}>
            <For each={drafts()}>
              {(a) => (
                <button {...stylex.attrs(ws.noteCard)} onClick={() => edit(a)}>
                  <img src={a.src} alt={a.title} {...stylex.attrs(ws.noteImage)} />
                  <div {...stylex.attrs(ws.noteContent)}>
                    <Badge tone="accent">DRAFT</Badge>
                    <h2>{a.title}</h2>
                    <p {...stylex.attrs(ws.copy)}>{a.draft}</p>
                    <span {...stylex.attrs(ws.smallLabel)}>
                      CONTINUE WRITING
                      <ArrowUpRight size={11} />
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={path() === '/insights'}>
        <div {...stylex.attrs(ws.infoStrip)}>
          <LibraryBig size={16} />
          <div>
            <strong>Your actual library, at a glance</strong>
            <p>
              These totals come from this workspace. Audience and publishing analytics are not
              connected.
            </p>
          </div>
        </div>
        <div {...stylex.attrs(ws.stats)}>
          <For
            each={[
              { label: 'All assets', value: s.assets.length, icon: Image },
              {
                label: 'Your imported files',
                value: s.assets.filter((a) => !a.demo).length,
                icon: HardDrive,
              },
              { label: 'Private memories', value: notes().length, icon: BookOpen },
              { label: 'Local drafts', value: drafts().length, icon: Send },
            ]}
          >
            {(stat) => (
              <Surface>
                <div {...stylex.attrs(ws.statLabel)}>
                  <stat.icon size={15} />
                  {stat.label}
                </div>
                <div {...stylex.attrs(ws.statValue)}>{stat.value}</div>
              </Surface>
            )}
          </For>
        </div>
        <Surface>
          <h2 {...stylex.attrs(ws.panelTitle)}>What’s in your library</h2>
          <For
            each={[
              { type: 'photo', label: 'Photographs', icon: Image },
              { type: 'video', label: 'Videos', icon: Video },
              { type: 'audio', label: 'Audio', icon: AudioLines },
            ]}
          >
            {(t) => (
              <div {...stylex.attrs(ws.metricRow)}>
                <span>
                  <t.icon size={14} />
                  {t.label}
                </span>
                <span>{s.assets.filter((a) => a.type === t.type).length}</span>
              </div>
            )}
          </For>
          <div {...stylex.attrs(ws.metricRow)}>
            <span>Imported storage</span>
            <span>
              {formatBytes(s.assets.filter((a) => !a.demo).reduce((n, a) => n + a.size, 0))}
            </span>
          </div>
        </Surface>
      </Show>
      <Show when={path() === '/extensions'}>
        <div {...stylex.attrs(ws.infoStrip)}>
          <Blocks size={18} />
          <div>
            <strong>A foundation for what’s next</strong>
            <p>
              The registry validates manifests and manages activation and cleanup. Feature
              contributions and third-party isolation are future work.
            </p>
          </div>
        </div>
        <Surface>
          <div {...stylex.attrs(ws.extensionHeader)}>
            <span {...stylex.attrs(ws.largeIcon)}>
              <LibraryBig size={22} />
            </span>
            <div>
              <h2 {...stylex.attrs(ws.panelTitle)}>
                Media library <Badge>v0.1.0</Badge>
              </h2>
              <p {...stylex.attrs(ws.copy)}>Bundled extension · API v1 · Registry lifecycle demo</p>
            </div>
            <Button
              onClick={async () => {
                if (extensionEnabled()) {
                  registry.disable('z-cloud.media-library');
                  setExtensionEnabled(false);
                } else {
                  await registry.enable('z-cloud.media-library');
                  setExtensionEnabled(true);
                }
                s.notify(
                  `Registry extension ${extensionEnabled() ? 'activated' : 'deactivated'}. The core library remains available.`,
                );
              }}
            >
              {extensionEnabled() ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
          <div {...stylex.attrs(ws.permissionRow)}>
            <ShieldCheck size={14} />
            <span>Declared capabilities</span>
            <Badge>media:read</Badge>
            <Badge>media:write</Badge>
          </div>
        </Surface>
        <div {...stylex.attrs(ws.extensionGrid)}>
          <For
            each={[
              {
                name: 'Adventure journal',
                description: 'Journals and connected moments.',
                cap: 'journal:write',
              },
              {
                name: 'AI memory',
                description: 'Provider and retrieval contracts.',
                cap: 'ai:generate',
              },
              {
                name: 'YouTube publisher',
                description: 'A dedicated Cloudflare publishing boundary.',
                cap: 'publish:youtube',
              },
            ]}
          >
            {(e) => (
              <Surface>
                <h3 {...stylex.attrs(ws.panelTitle)}>{e.name}</h3>
                <p {...stylex.attrs(ws.copy)}>{e.description}</p>
                <div {...stylex.attrs(ws.permissionRow)}>
                  <Badge>{e.cap}</Badge>
                  <Badge>FOUNDATION</Badge>
                </div>
              </Surface>
            )}
          </For>
        </div>
      </Show>
      <Show when={path() === '/settings'}>
        <div {...stylex.attrs(ws.settings)}>
          <Surface>
            <h2 {...stylex.attrs(ws.panelTitle)}>Appearance</h2>
            <p {...stylex.attrs(ws.copy)}>A workspace that feels right, in any light.</p>
            <div {...stylex.attrs(ws.settingRow)}>
              <span>Color theme</span>
              <div {...stylex.attrs(ws.buttonRow)}>
                <Button
                  variant={s.theme() === 'dark' ? 'primary' : 'secondary'}
                  onClick={() => s.setTheme('dark')}
                >
                  <Moon size={14} />
                  Dark
                </Button>
                <Button
                  variant={s.theme() === 'light' ? 'primary' : 'secondary'}
                  onClick={() => s.setTheme('light')}
                >
                  <Sun size={14} />
                  Light
                </Button>
              </div>
            </div>
            <div {...stylex.attrs(ws.settingRow)}>
              <span>Grid density</span>
              <Button onClick={() => s.setCompact((v) => !v)}>
                {s.compact() ? 'Compact' : 'Comfortable'}
              </Button>
            </div>
            <div {...stylex.attrs(ws.settingRow)}>
              <span>Layout direction</span>
              <Button onClick={() => s.setDirection((d) => (d === 'ltr' ? 'rtl' : 'ltr'))}>
                {s.direction() === 'ltr' ? 'Left to right' : 'Right to left'}
              </Button>
            </div>
          </Surface>
          <Surface>
            <h2 {...stylex.attrs(ws.panelTitle)}>Your data</h2>
            <p {...stylex.attrs(ws.copy)}>
              Imported originals are stored in this browser’s IndexedDB. Notes and metadata are
              saved locally. Clearing browser data removes this workspace’s local imports and edits.
            </p>
            <div {...stylex.attrs(ws.settingRow)}>
              <span>Metadata backup</span>
              <Button onClick={s.exportMetadata}>
                <Download size={13} />
                Export JSON
              </Button>
            </div>
            <div {...stylex.attrs(ws.settingRow)}>
              <span>Design foundations</span>
              <Button onClick={() => go('/dev/ui')}>
                Open showcase
                <ArrowUpRight size={13} />
              </Button>
            </div>
          </Surface>
        </div>
      </Show>
      <Show when={path() === '/dev/ui'}>
        <div {...stylex.attrs(ws.settings)}>
          <Surface>
            <h2 {...stylex.attrs(ws.panelTitle)}>Color & type</h2>
            <p {...stylex.attrs(ws.copy)}>
              Obsidian graphite. Warm sandstone. Inter with system fallbacks.
            </p>
            <div {...stylex.attrs(ws.swatches)}>
              <For
                each={
                  [
                    'canvas',
                    'surface',
                    'surfaceAlt',
                    'text',
                    'accent',
                    'success',
                    'info',
                    'danger',
                  ] as const
                }
              >
                {(c) => (
                  <div>
                    <span {...stylex.attrs(ws.swatch, ws[c])} />
                    <span {...stylex.attrs(ws.smallLabel)}>{c}</span>
                  </div>
                )}
              </For>
            </div>
            <h2 {...stylex.attrs(ws.editorialHeading)}>Room to create.</h2>
            <p {...stylex.attrs(ws.copy)}>
              The content is the hero. The interface is the instrument.
            </p>
          </Surface>
          <Surface>
            <h2 {...stylex.attrs(ws.panelTitle)}>Buttons & feedback</h2>
            <div {...stylex.attrs(ws.buttonRow)}>
              <Button variant="primary" onClick={() => s.notify('Primary action works.')}>
                <Plus size={14} />
                Primary
              </Button>
              <Button onClick={() => s.notify('Secondary action works.')}>Secondary</Button>
              <Button variant="ghost" onClick={() => s.notify('Quiet action works.')}>
                Ghost
              </Button>
              <Button disabled>Disabled</Button>
            </div>
            <div {...stylex.attrs(ws.buttonRow)}>
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Saved</Badge>
              <Badge tone="info">Information</Badge>
            </div>
          </Surface>
          <Surface>
            <h2 {...stylex.attrs(ws.panelTitle)}>Fields & overlays</h2>
            <label>
              Example input
              <TextField placeholder="A quiet place for your ideas" />
            </label>
            <div {...stylex.attrs(ws.buttonRow)}>
              <Button onClick={() => setShowDialog(true)}>Open accessible dialog</Button>
              <Dropdown
                label="Example menu"
                items={[
                  { value: 'one', label: 'First option' },
                  { value: 'two', label: 'Second option' },
                ]}
                onSelect={(v) => s.notify(`Selected ${v}`)}
              />
              <Button onClick={() => s.setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
                Toggle theme
              </Button>
              <Button onClick={() => s.setDirection((d) => (d === 'ltr' ? 'rtl' : 'ltr'))}>
                Toggle RTL
              </Button>
            </div>
            <Tabs
              value={tab()}
              onChange={setTab}
              label="Example tabs"
              items={[
                { value: 'one', label: 'First tab' },
                { value: 'two', label: 'Second tab' },
                { value: 'three', label: 'Third tab' },
              ]}
            />
            <p {...stylex.attrs(ws.copy)}>
              Selected: {tab()}. Use arrow keys to move between tabs.
            </p>
          </Surface>
          <Surface>
            <EmptyState
              icon={<Folder size={24} />}
              title="Nothing here yet"
              description="An example empty state with a clear next step."
              action={
                <Button onClick={() => s.notify('Example action completed.')}>
                  Take the next step
                </Button>
              }
            />
          </Surface>
        </div>
      </Show>
      <Dialog
        open={Boolean(editing())}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={editing()?.title ?? 'Edit note'}
        description="Private to your workspace. Saved on this device."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const a = editing();
            if (a) s.update(a.id, path() === '/memories' ? { memory: note() } : { draft: note() });
            setEditing(undefined);
            s.notify('Your writing is saved.');
          }}
        >
          <Textarea
            aria-label="Edit writing"
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
          <div {...stylex.attrs(ws.buttonRow)}>
            <Button type="submit" variant="primary">
              <Check size={13} />
              Save
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={showDialog()}
        onOpenChange={setShowDialog}
        title="A little room to focus"
        description="Built on Ark UI. Focus is trapped here and returns to the trigger when this dialog closes."
      >
        <Button onClick={() => setShowDialog(false)}>Done</Button>
      </Dialog>
    </div>
  );
}
function CollectionCards() {
  const s = useStudio();
  const navigate = useNavigate();
  return (
    <div {...stylex.attrs(ws.collections)}>
      <For each={s.collections}>
        {(c) => (
          <a
            href={`/collections/${c.id}`}
            onClick={(e) => {
              e.preventDefault();
              void navigate({ to: `/collections/${c.id}` });
            }}
            {...stylex.attrs(ws.collectionCard)}
          >
            <div {...stylex.attrs(ws.collectionCover)}>
              <Show
                when={s.assets.find((a) => a.collection === c.id)}
                fallback={<Folder size={28} />}
              >
                {(a) => <img src={a().src} alt={c.name} {...stylex.attrs(ws.coverImage)} />}
              </Show>
              <span {...stylex.attrs(ws.collectionArrow)}>
                <ArrowUpRight size={14} />
              </span>
            </div>
            <div {...stylex.attrs(ws.collectionInfo)}>
              <h2>{c.name}</h2>
              <p>
                {s.assets.filter((a) => a.collection === c.id).length} assets <span>·</span> Private
                collection
              </p>
              <p {...stylex.attrs(ws.copy)}>{c.description}</p>
            </div>
          </a>
        )}
      </For>
    </div>
  );
}
const ws = stylex.create({
  welcome: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 32,
    padding: 32,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginBottom: 32,
    overflow: 'hidden',
  },
  welcomeImage: {
    width: '45%',
    objectFit: 'cover',
    borderRadius: 8,
    display: { default: 'block', '@media (max-width: 600px)': 'none' },
  },
  editorialHeading: {
    fontSize: 36,
    letterSpacing: '-1.4px',
    lineHeight: 1.2,
    fontWeight: 500,
    marginBlock: 20,
  },
  copy: {
    fontSize: 12,
    lineHeight: '21px',
    color: colors.secondary,
    marginBlock: 12,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 16,
    fontSize: 11,
  },
  collections: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3,minmax(0,1fr))',
      '@media (max-width: 1000px)': 'repeat(2,minmax(0,1fr))',
      '@media (max-width: 600px)': '1fr',
    },
    gap: 20,
  },
  collectionCard: {
    display: 'block',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  collectionCover: {
    position: 'relative',
    height: 180,
    backgroundColor: colors.surfaceAlt,
    display: 'grid',
    placeItems: 'center',
    color: colors.muted,
  },
  coverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  collectionArrow: {
    position: 'absolute',
    bottom: 12,
    insetInlineEnd: 12,
    width: 28,
    height: 28,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: colors.mediaScrim,
    color: colors.mediaText,
    borderRadius: '50%',
  },
  collectionInfo: { padding: 16, fontSize: 11, color: colors.muted },
  quietNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    color: colors.muted,
    fontSize: 12,
    lineHeight: '22px',
    marginTop: 24,
    padding: 20,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
  },
  notes: {
    display: 'grid',
    gridTemplateColumns: { default: 'repeat(2,minmax(0,1fr))', '@media (max-width: 700px)': '1fr' },
    gap: 20,
  },
  noteCard: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    padding: 0,
    textAlign: 'start',
    color: colors.text,
  },
  noteImage: { height: 180, width: '100%', objectFit: 'cover' },
  noteContent: { padding: 20, fontSize: 12 },
  smallLabel: {
    fontSize: 9,
    letterSpacing: '0.7px',
    color: colors.muted,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  aiPanel: {
    maxWidth: 640,
    margin: '32px auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  },
  largeIcon: {
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: colors.accentSubtle,
    color: colors.accent,
    borderRadius: 12,
    flexShrink: 0,
  },
  aiPrompt: {
    width: '100%',
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-end',
  },
  privacy: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: colors.muted },
  infoStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 24,
    fontSize: 12,
    color: colors.secondary,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(4,minmax(0,1fr))',
      '@media (max-width: 800px)': 'repeat(2,minmax(0,1fr))',
    },
    gap: 16,
    marginBottom: 24,
  },
  statLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: colors.muted },
  statValue: {
    fontSize: 32,
    fontWeight: 500,
    letterSpacing: '-1px',
    marginTop: 12,
    fontVariantNumeric: 'tabular-nums',
  },
  panelTitle: { fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 },
  metricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBlock: 16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    fontSize: 12,
    color: colors.secondary,
  },
  extensionHeader: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  permissionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    fontSize: 10,
    color: colors.muted,
    flexWrap: 'wrap',
  },
  extensionGrid: {
    display: 'grid',
    gridTemplateColumns: { default: 'repeat(3,minmax(0,1fr))', '@media (max-width: 900px)': '1fr' },
    gap: 16,
    marginTop: 20,
  },
  settings: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBlock: 16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    fontSize: 12,
    color: colors.secondary,
  },
  buttonRow: { display: 'flex', alignItems: 'center', gap: 8, marginBlock: 16, flexWrap: 'wrap' },
  swatches: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(8,minmax(0,1fr))',
      '@media (max-width: 700px)': 'repeat(4,minmax(0,1fr))',
    },
    gap: 12,
    marginBlock: 20,
  },
  swatch: {
    display: 'block',
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    marginBottom: 8,
  },
  canvas: { backgroundColor: colors.canvas },
  surface: { backgroundColor: colors.surface },
  surfaceAlt: { backgroundColor: colors.surfaceAlt },
  text: { backgroundColor: colors.text },
  accent: { backgroundColor: colors.accent },
  success: { backgroundColor: colors.success },
  info: { backgroundColor: colors.info },
  danger: { backgroundColor: colors.danger },
});
