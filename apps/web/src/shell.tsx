import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { Outlet, useLocation, useNavigate } from '@tanstack/solid-router';
import {
  Grid2X2,
  Upload,
  Server,
  LibraryBig,
  Compass,
  BookOpen,
  Sparkles,
  CalendarDays,
  Send,
  ChartNoAxesCombined,
  Blocks,
  Settings2,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  PanelLeftClose,
  PanelRight,
  Check,
  HardDrive,
  CircleHelp,
  Sun,
  Moon,
  X,
  ArrowUpRight,
  Command,
  Image,
  Heart,
  Clock3,
  Folder,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { lightTheme } from '@z-cloud/design-tokens/themes/light';
import { Button, IconButton, Badge, Dialog, TextField, Textarea } from '@z-cloud/ui';
import { useStudio } from './state';
import { useTransfers } from './transfers';
import { ImportDialog } from './features/import-dialog';
import { formatBytes } from './data';
import { Inspector } from './features/inspector';
export const nav = [
  { path: '/studio', label: 'Studio', icon: Grid2X2 },
  { path: '/library', label: 'Media library', icon: LibraryBig },
  { path: '/imports', label: 'Import queue', icon: Upload },
  { path: '/servers', label: 'Storage servers', icon: Server },
  { path: '/adventures', label: 'Adventures', icon: Compass },
  { path: '/memories', label: 'Memories', icon: BookOpen },
  { path: '/ai', label: 'AI workspace', icon: Sparkles },
  { path: '/planner', label: 'Content planner', icon: CalendarDays },
  { path: '/publications', label: 'Publications', icon: Send },
  { path: '/insights', label: 'Insights', icon: ChartNoAxesCombined },
];
export function StudioShell() {
  const s = useStudio();
  const queue = useTransfers();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebar, setSidebar] = createSignal(false);
  const [sidebarHidden, setSidebarHidden] = createSignal(false);
  const [inspector, setInspector] = createSignal(window.innerWidth >= 1024);
  const [importOpen, setImportOpen] = createSignal(false);
  const [collectionOpen, setCollectionOpen] = createSignal(false);
  const [collectionName, setCollectionName] = createSignal('');
  const [collectionDescription, setCollectionDescription] = createSignal('');
  const [commandOpen, setCommandOpen] = createSignal(false);
  const [commandQuery, setCommandQuery] = createSignal('');
  const [help, setHelp] = createSignal(false);
  createEffect(() => {
    const themeClass = stylex.attrs(lightTheme).class;
    if (themeClass)
      for (const name of themeClass.split(' '))
        document.documentElement.classList.toggle(name, s.theme() === 'light');
  });
  const libraryRoute = createMemo(
    () =>
      location().pathname === '/' ||
      location().pathname.startsWith('/library') ||
      location().pathname.startsWith('/collections'),
  );
  const current = createMemo(
    () =>
      nav.find((n) => location().pathname.startsWith(n.path))?.label ??
      (location().pathname.startsWith('/collections')
        ? 'Collections'
        : location().pathname === '/'
          ? 'Media library'
          : location().pathname === '/dev/ui'
            ? 'Design system'
            : 'Workspace'),
  );
  const collectionId = createMemo(
    () => s.collections.find((c) => location().pathname === `/collections/${c.id}`)?.id ?? '',
  );
  const inspectorInScope = createMemo(
    () => !collectionId() || s.active()?.collection === collectionId(),
  );
  const go = (to: string) => {
    void navigate({ to });
    setSidebar(false);
    setCommandOpen(false);
  };
  const commands = createMemo(() =>
    [
      ...nav.map((n) => ({ label: n.label, action: () => go(n.path), icon: n.icon })),
      {
        label: 'Import media',
        action: () => {
          setCommandOpen(false);
          setImportOpen(true);
        },
        icon: Plus,
      },
      {
        label: 'Toggle theme',
        action: () => {
          s.setTheme(s.theme() === 'dark' ? 'light' : 'dark');
          setCommandOpen(false);
        },
        icon: Sun,
      },
      { label: 'Design system', action: () => go('/dev/ui'), icon: Blocks },
    ].filter((c) => c.label.toLowerCase().includes(commandQuery().toLowerCase())),
  );
  function onKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setCommandOpen((v) => !v);
    }
    if (event.key === 'Escape') setSidebar(false);
  }
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));
  return (
    <div {...stylex.attrs(shell.app, s.theme() === 'light' && lightTheme)}>
      <Show when={sidebar()}>
        <button
          {...stylex.attrs(shell.mobileBackdrop)}
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      </Show>
      <aside
        aria-label="Workspace navigation"
        {...stylex.attrs(
          shell.sidebar,
          s.direction() === 'rtl' && shell.sidebarRTL,
          sidebarHidden() && shell.sidebarHidden,
          sidebar() && shell.sidebarOpen,
        )}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go('/library');
          }}
          {...stylex.attrs(shell.brand)}
        >
          <span {...stylex.attrs(shell.brandMark)}>Ƶ</span>
          <span>
            Z cloud<span {...stylex.attrs(shell.brandDot)}>®</span>
          </span>
          <span {...stylex.attrs(shell.brandBadge)}>
            <Badge>STUDIO</Badge>
          </span>
        </a>
        <button {...stylex.attrs(shell.workspace)} onClick={() => go('/settings')}>
          <span {...stylex.attrs(shell.workspaceAvatar)}>M</span>
          <span {...stylex.attrs(shell.workspaceText)}>
            <strong {...stylex.attrs(shell.workspaceName)}>Maziyar’s workspace</strong>
            <span>Personal space</span>
          </span>
          <ChevronDown size={13} />
        </button>
        <button {...stylex.attrs(shell.search)} onClick={() => setCommandOpen(true)}>
          <Search size={14} />
          <span>Quick search</span>
          <kbd {...stylex.attrs(shell.kbd)}>⌘ K</kbd>
        </button>
        <div {...stylex.attrs(shell.navScroll)}>
          <div {...stylex.attrs(shell.sectionLabel)}>WORKSPACE</div>
          <nav {...stylex.attrs(shell.nav)}>
            <For each={nav}>
              {(item) => (
                <a
                  href={item.path}
                  aria-current={
                    location().pathname === item.path ||
                    (item.path === '/library' && libraryRoute())
                      ? 'page'
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    go(item.path);
                  }}
                  {...stylex.attrs(
                    shell.navItem,
                    (location().pathname === item.path ||
                      (item.path === '/library' && libraryRoute())) &&
                      shell.navActive,
                  )}
                >
                  <item.icon size={16} strokeWidth={1.6} />
                  <span>{item.label}</span>
                  <Show when={item.path === '/library'}>
                    <span {...stylex.attrs(shell.navCount)}>{s.assets.length}</span>
                  </Show>
                  <Show when={item.path === '/imports' && queue.pending()}>
                    <Badge tone="accent">{queue.pending()}</Badge>
                  </Show>
                  <Show when={item.path === '/ai'}>
                    <span {...stylex.attrs(shell.aiDot)} />
                  </Show>
                </a>
              )}
            </For>
          </nav>
          <div {...stylex.attrs(shell.sectionRow)}>
            <span {...stylex.attrs(shell.sectionLabel)}>COLLECTIONS</span>
            <IconButton label="New collection" onClick={() => setCollectionOpen(true)}>
              <Plus size={13} />
            </IconButton>
          </div>
          <nav {...stylex.attrs(shell.nav)}>
            <For each={s.collections}>
              {(c, i) => (
                <a
                  href={`/collections/${c.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(`/collections/${c.id}`);
                  }}
                  {...stylex.attrs(
                    shell.navItem,
                    location().pathname === `/collections/${c.id}` && shell.collectionActive,
                  )}
                >
                  <span
                    {...stylex.attrs(
                      shell.collectionDot,
                      i() % 3 === 1 && shell.greenDot,
                      i() % 3 === 2 && shell.blueDot,
                    )}
                  />
                  <span {...stylex.attrs(shell.ellipsis)}>{c.name}</span>
                  <span {...stylex.attrs(shell.navCount)}>
                    {s.assets.filter((a) => a.collection === c.id).length}
                  </span>
                </a>
              )}
            </For>
          </nav>
          <div {...stylex.attrs(shell.sectionRow)}>
            <span {...stylex.attrs(shell.sectionLabel)}>QUICK ACCESS</span>
          </div>
          <nav {...stylex.attrs(shell.nav)}>
            <a
              href="/library/favorites"
              onClick={(e) => {
                e.preventDefault();
                go('/library/favorites');
              }}
              {...stylex.attrs(shell.navItem)}
            >
              <Heart size={15} />
              <span>Favorites</span>
            </a>
            <a
              href="/library/recent"
              onClick={(e) => {
                e.preventDefault();
                go('/library/recent');
              }}
              {...stylex.attrs(shell.navItem)}
            >
              <Clock3 size={15} />
              <span>Recent imports</span>
            </a>
          </nav>
        </div>
        <div {...stylex.attrs(shell.sidebarBottom)}>
          <nav {...stylex.attrs(shell.nav)}>
            <a
              href="/extensions"
              onClick={(e) => {
                e.preventDefault();
                go('/extensions');
              }}
              {...stylex.attrs(
                shell.navItem,
                location().pathname === '/extensions' && shell.collectionActive,
              )}
            >
              <Blocks size={16} />
              <span>Extensions</span>
            </a>
            <a
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                go('/settings');
              }}
              {...stylex.attrs(
                shell.navItem,
                location().pathname === '/settings' && shell.collectionActive,
              )}
            >
              <Settings2 size={16} />
              <span>Settings</span>
            </a>
          </nav>
          <div {...stylex.attrs(shell.storage)}>
            <div {...stylex.attrs(shell.storageRow)}>
              <HardDrive size={13} />
              <span>On this device</span>
              <Badge>LOCAL</Badge>
            </div>
            <div {...stylex.attrs(shell.storageTrack)}>
              <div {...stylex.attrs(shell.storageFill)} />
            </div>
            <div {...stylex.attrs(shell.storageRow)}>
              <span>
                {formatBytes(s.assets.filter((a) => !a.demo).reduce((n, a) => n + a.size, 0))}{' '}
                imported
              </span>
              <span>{s.assets.filter((a) => !a.demo).length} files</span>
            </div>
          </div>
          <button {...stylex.attrs(shell.profile)} onClick={() => go('/settings')}>
            <span {...stylex.attrs(shell.profileAvatar)}>MG</span>
            <span {...stylex.attrs(shell.workspaceText)}>
              <strong {...stylex.attrs(shell.workspaceName)}>Maziyar Gholami</strong>
              <span>Creator workspace</span>
            </span>
            <ChevronDown size={13} />
          </button>
        </div>
      </aside>
      <div {...stylex.attrs(shell.main)}>
        <header {...stylex.attrs(shell.topbar)}>
          <div {...stylex.attrs(shell.breadcrumb)}>
            <IconButton
              label="Toggle navigation"
              onClick={() =>
                window.innerWidth > 900 ? setSidebarHidden((v) => !v) : setSidebar((v) => !v)
              }
            >
              <PanelLeftClose size={16} />
            </IconButton>
            <span {...stylex.attrs(shell.hideMobile)}>Workspace</span>
            <ChevronRight size={12} />
            <span>{current()}</span>
          </div>
          <div {...stylex.attrs(shell.topActions)}>
            <span {...stylex.attrs(shell.saved)}>
              <span {...stylex.attrs(shell.liveDot)} />
              Local workspace
            </span>
            <Badge tone="accent">DEMO + LOCAL</Badge>
            <div {...stylex.attrs(shell.topDivider)} />
            <IconButton
              label={s.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => s.setTheme(s.theme() === 'dark' ? 'light' : 'dark')}
            >
              {s.theme() === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
            <IconButton label="Keyboard shortcuts" onClick={() => setHelp(true)}>
              <CircleHelp size={15} />
            </IconButton>
            <Show when={libraryRoute()}>
              <IconButton
                label="Toggle inspector"
                active={inspector()}
                onClick={() => setInspector((v) => !v)}
              >
                <PanelRight size={16} />
              </IconButton>
            </Show>
          </div>
        </header>
        <div {...stylex.attrs(shell.workspaceBody)}>
          <main id="main-content" {...stylex.attrs(shell.content)}>
            <Outlet />
          </main>
          <Show when={libraryRoute() && inspector() && s.active() && inspectorInScope()}>
            <Inspector onClose={() => setInspector(false)} />
          </Show>
        </div>
        <footer {...stylex.attrs(shell.statusbar)}>
          <span {...stylex.attrs(shell.statusText)}>
            <span {...stylex.attrs(shell.liveDot)} />
            {s.files.isPending ? 'Opening local library…' : 'Workspace ready'}
            <span {...stylex.attrs(shell.statusSeparator)}>·</span>
            {s.assets.length} assets
          </span>
          <span {...stylex.attrs(shell.statusText)}>
            <span {...stylex.attrs(shell.hideMobile)}>Local originals · managed uploads</span>
            <span {...stylex.attrs(shell.statusSeparator)}>·</span>Z Cloud{' '}
            <span {...stylex.attrs(shell.mono)}>v0.1.0</span>
          </span>
        </footer>
      </div>
      <button
        {...stylex.attrs(shell.floatingImport)}
        aria-label="Import media"
        onClick={() => setImportOpen(true)}
      >
        <Plus size={18} />
      </button>
      <Show when={s.notice()}>
        <div role="status" {...stylex.attrs(shell.toast)}>
          <Check size={16} />
          {s.notice()}
          <IconButton label="Dismiss notification" onClick={() => s.notify('')}>
            <X size={14} />
          </IconButton>
        </div>
      </Show>
      <ImportDialog
        open={importOpen()}
        onOpenChange={setImportOpen}
        collectionId={collectionId()}
      />
      <Dialog
        open={collectionOpen()}
        onOpenChange={setCollectionOpen}
        title="A new collection"
        description="Give your next chapter a place to live."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!collectionName().trim()) return;
            const c = s.addCollection(collectionName(), collectionDescription());
            setCollectionOpen(false);
            setCollectionName('');
            setCollectionDescription('');
            go(`/collections/${c.id}`);
          }}
        >
          <div {...stylex.attrs(shell.form)}>
            <label>
              Collection name
              <TextField
                required
                maxLength={100}
                value={collectionName()}
                onInput={(e) => setCollectionName(e.currentTarget.value)}
                placeholder="Somewhere worth remembering"
              />
            </label>
            <label>
              Description
              <Textarea
                value={collectionDescription()}
                onInput={(e) => setCollectionDescription(e.currentTarget.value)}
                placeholder="What’s the story?"
              />
            </label>
            <Button variant="primary" type="submit">
              <Plus size={14} />
              Create collection
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={commandOpen()}
        onOpenChange={setCommandOpen}
        title="Go anywhere"
        description="Search your workspace or run a command."
      >
        <TextField
          aria-label="Search commands"
          placeholder="Where would you like to go?"
          value={commandQuery()}
          onInput={(e) => setCommandQuery(e.currentTarget.value)}
        />
        <div {...stylex.attrs(shell.commandList)}>
          <For each={commands()}>
            {(c) => (
              <button {...stylex.attrs(shell.commandItem)} onClick={c.action}>
                <c.icon size={16} />
                {c.label}
                <ArrowUpRight size={13} />
              </button>
            )}
          </For>
          <Show when={!commands().length}>
            <p {...stylex.attrs(shell.muted)}>No matching commands.</p>
          </Show>
        </div>
      </Dialog>
      <Dialog
        open={help()}
        onOpenChange={setHelp}
        title="Made for your flow"
        description="A few shortcuts to keep you in the moment."
      >
        <div {...stylex.attrs(shell.shortcutRow)}>
          <span>Quick search & commands</span>
          <kbd>⌘ / Ctrl + K</kbd>
        </div>
        <div {...stylex.attrs(shell.shortcutRow)}>
          <span>Select multiple assets</span>
          <kbd>⌘ / Ctrl + click</kbd>
        </div>
        <div {...stylex.attrs(shell.shortcutRow)}>
          <span>Open media preview</span>
          <kbd>Double-click</kbd>
        </div>
        <div {...stylex.attrs(shell.shortcutRow)}>
          <span>Close dialog</span>
          <kbd>Esc</kbd>
        </div>
      </Dialog>
      <ImportBridge open={() => setImportOpen(true)} />
    </div>
  );
}
function ImportBridge(props: { open: () => void }) {
  const handler = () => props.open();
  onMount(() => window.addEventListener('zc:import', handler));
  onCleanup(() => window.removeEventListener('zc:import', handler));
  return null;
}
export const openImport = () => window.dispatchEvent(new Event('zc:import'));

export const shell = stylex.create({
  app: {
    display: 'flex',
    height: '100dvh',
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    color: colors.text,
    fontSize: 13,
    lineHeight: 1.5,
  },
  sidebar: {
    width: { default: 232, '@media (max-width: 1100px)': 208, '@media (max-width: 900px)': 232 },
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.sidebar,
    borderInlineEndWidth: 1,
    borderInlineEndStyle: 'solid',
    borderColor: colors.border,
    zIndex: 50,
    position: { default: 'relative', '@media (max-width: 900px)': 'fixed' },
    insetBlock: 0,
    insetInlineStart: 0,
    transform: { default: 'none', '@media (max-width: 900px)': 'translateX(-110%)' },
    visibility: { default: 'visible', '@media (max-width: 900px)': 'hidden' },
    transition: 'transform 180ms',
  },
  sidebarHidden: { display: { default: 'none', '@media (max-width: 900px)': 'flex' } },
  sidebarRTL: { transform: { default: 'none', '@media (max-width: 900px)': 'translateX(110%)' } },
  sidebarOpen: { transform: 'none', visibility: 'visible' },
  mobileBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 49,
    backgroundColor: colors.overlay,
    borderWidth: 0,
    borderStyle: 'solid',
    display: { default: 'none', '@media (max-width: 900px)': 'block' },
  },
  brand: {
    whiteSpace: 'nowrap',
    height: 64,
    paddingInline: 22,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.9px',
  },
  brandMark: {
    flexShrink: 0,
    backgroundColor: colors.accent,
    color: colors.accentText,
    width: 29,
    height: 29,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 23,
  },
  brandDot: { fontSize: 10, verticalAlign: 'super', paddingInlineStart: 2 },
  workspace: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    marginInline: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.secondary,
    textAlign: 'start',
  },
  workspaceAvatar: {
    flexShrink: 0,
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: colors.accentSubtle,
    color: colors.accent,
    borderRadius: 6,
    fontWeight: 600,
  },
  brandBadge: { display: { default: 'inline', '@media (max-width: 1100px)': 'none' } },
  workspaceName: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  workspaceText: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    gap: 2,
    color: colors.muted,
  },
  search: {
    marginInline: 16,
    marginBottom: 18,
    paddingInline: 8,
    height: 32,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    color: colors.muted,
    fontSize: 11,
  },
  kbd: {
    marginInlineStart: 'auto',
    fontSize: 9,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 3,
    paddingInline: 4,
    fontFamily: 'inherit',
  },
  navScroll: { flex: 1, overflowY: 'auto', paddingInline: 12 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '1.3px',
    color: colors.muted,
    paddingInline: 12,
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 0,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 },
  navItem: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingInline: 12,
    borderRadius: 6,
    color: { default: colors.secondary, ':hover': colors.text },
    backgroundColor: { default: 'transparent', ':hover': colors.surface },
    fontSize: 12,
    minWidth: 0,
  },
  navActive: { backgroundColor: colors.accentSubtle, color: colors.accent },
  collectionActive: { backgroundColor: colors.surfaceAlt, color: colors.text },
  navCount: {
    marginInlineStart: 'auto',
    fontSize: 10,
    color: colors.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  aiDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: colors.accent,
    marginInlineStart: 'auto',
  },
  collectionDot: {
    width: 7,
    height: 7,
    backgroundColor: colors.accent,
    borderRadius: 2,
    flexShrink: 0,
  },
  greenDot: { backgroundColor: colors.success },
  blueDot: { backgroundColor: colors.info },
  ellipsis: { whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' },
  sidebarBottom: { padding: 12, paddingTop: 0 },
  storage: { marginTop: 20, marginBottom: 16, paddingInline: 12 },
  storageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    color: colors.muted,
    fontSize: 9,
  },
  storageTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginBlock: 9 },
  storageFill: { height: '100%', width: 8, backgroundColor: colors.accent, borderRadius: 2 },
  profile: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 0,
    borderStyle: 'solid',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: 'transparent',
    textAlign: 'start',
  },
  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    backgroundColor: colors.elevated,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    color: colors.secondary,
  },
  main: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  topbar: {
    height: 56,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: { default: 20, '@media (max-width: 600px)': 10 },
    gap: 8,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 11,
    color: colors.secondary,
    whiteSpace: 'nowrap',
  },
  topActions: { display: 'flex', alignItems: 'center', gap: 6 },
  saved: {
    display: { default: 'flex', '@media (max-width: 1100px)': 'none' },
    alignItems: 'center',
    gap: 6,
    color: colors.muted,
    fontSize: 10,
    marginInlineEnd: 8,
  },
  liveDot: {
    display: 'inline-block',
    width: 5,
    height: 5,
    backgroundColor: colors.success,
    borderRadius: '50%',
    flexShrink: 0,
  },
  topDivider: {
    height: 16,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderColor: colors.border,
    marginInline: 6,
  },
  hideMobile: { display: { default: 'inline', '@media (max-width: 600px)': 'none' } },
  workspaceBody: { display: 'flex', flex: 1, minHeight: 0, minWidth: 0, position: 'relative' },
  content: { flex: 1, minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain' },
  statusbar: {
    height: 28,
    paddingInline: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
    flexShrink: 0,
    color: colors.muted,
    fontSize: 9,
    gap: 10,
  },
  statusText: { display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' },
  statusSeparator: { color: colors.borderStrong },
  mono: { fontFamily: 'ui-monospace,monospace' },
  floatingImport: { display: 'none' },
  toast: {
    position: 'fixed',
    bottom: 44,
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    zIndex: 110,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingInline: 16,
    paddingBlock: 8,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,.3)',
    fontSize: 12,
    maxWidth: 'calc(100vw - 32px)',
  },
  dropzone: {
    width: '100%',
    minHeight: 220,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    color: colors.secondary,
    fontSize: 12,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20, fontSize: 12 },
  commandList: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 },
  commandItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: 6,
    backgroundColor: { default: 'transparent', ':hover': colors.surfaceAlt },
    color: colors.secondary,
    textAlign: 'start',
    fontSize: 12,
  },
  muted: { color: colors.muted, fontSize: 12 },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBlock: 12,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    fontSize: 12,
    color: colors.secondary,
  },
});
