import { Show, For, createSignal, createEffect } from 'solid-js';
import {
  Image,
  X,
  Expand,
  Heart,
  MapPin,
  CalendarDays,
  HardDrive,
  Folder,
  Plus,
  ArrowUpRight,
  FileImage,
  Check,
  Sparkles,
  BookOpen,
  Send,
  Download,
  Video,
  AudioLines,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { Button, IconButton, Badge, Tabs, TextField, Textarea, Dialog } from '@z-cloud/ui';
import { useStudio } from '../state';
import { formatDate, formatBytes } from '../data';
import { MediaPreview } from './library';

export function Inspector(props: { onClose: () => void }) {
  const s = useStudio();
  const [tab, setTab] = createSignal('details');
  const [edit, setEdit] = createSignal(false);
  const [preview, setPreview] = createSignal(false);
  const [tag, setTag] = createSignal('');
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [location, setLocation] = createSignal('');
  createEffect(() => {
    if (s.active()) {
      setTitle(s.active()!.title);
      setDescription(s.active()!.description);
      setLocation(s.active()!.location);
    }
  });
  function addTag() {
    const a = s.active();
    const t = tag().trim().slice(0, 64);
    if (a && t && !a.tags.includes(t)) s.update(a.id, { tags: [...a.tags, t] });
    setTag('');
  }
  return (
    <aside {...stylex.attrs(ins.panel)} aria-label="Media inspector">
      <Show when={s.active()}>
        {(a) => (
          <>
            <header {...stylex.attrs(ins.header)}>
              <span {...stylex.attrs(ins.headerTitle)}>Inspector</span>
              <span {...stylex.attrs(ins.selectionCount)}>
                {s.selected().length > 1 ? `${s.selected().length} selected` : '1 selected'}
              </span>
              <IconButton label="Close inspector" onClick={props.onClose}>
                <X size={14} />
              </IconButton>
            </header>
            <Tabs
              value={tab()}
              onChange={setTab}
              label="Inspector sections"
              items={[
                { value: 'details', label: 'Details' },
                { value: 'memories', label: 'Memories' },
                { value: 'ai', label: 'AI' },
                { value: 'publish', label: 'Publish' },
              ]}
            >
              <div {...stylex.attrs(ins.body)}>
                <div {...stylex.attrs(ins.preview)}>
                  <Show
                    when={a().type === 'photo'}
                    fallback={
                      <div {...stylex.attrs(ins.mediaPlaceholder)}>
                        {a().type === 'video' ? <Video size={40} /> : <AudioLines size={40} />}
                      </div>
                    }
                  >
                    <img src={a().src} alt={a().title} {...stylex.attrs(ins.previewImage)} />
                  </Show>
                  <button
                    {...stylex.attrs(ins.expand)}
                    aria-label="Open media preview"
                    onClick={() => setPreview(true)}
                  >
                    <Expand size={13} />
                  </button>
                  <Show when={a().demo}>
                    <span {...stylex.attrs(ins.demo)}>DEMO ASSET</span>
                  </Show>
                </div>
                <div {...stylex.attrs(ins.assetHeading)}>
                  <div {...stylex.attrs(ins.fileType)}>
                    {a().type === 'photo' ? (
                      <Image size={12} />
                    ) : a().type === 'video' ? (
                      <Video size={12} />
                    ) : (
                      <AudioLines size={12} />
                    )}
                    <span>{a().type.toUpperCase()}</span>
                    <span>·</span>
                    <span>{a().mime.split('/')[1].toUpperCase()}</span>
                  </div>
                  <IconButton
                    label={a().favorite ? 'Remove from favorites' : 'Add to favorites'}
                    active={a().favorite}
                    onClick={() => s.update(a().id, { favorite: !a().favorite })}
                  >
                    <Heart size={14} fill={a().favorite ? 'currentColor' : 'none'} />
                  </IconButton>
                </div>
                <h2 {...stylex.attrs(ins.assetTitle)}>{a().title}</h2>
                <p {...stylex.attrs(ins.filename)}>{a().filename}</p>
                <Show when={tab() === 'details'}>
                  <Show when={a().description}>
                    <p {...stylex.attrs(ins.description)}>{a().description}</p>
                  </Show>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.sectionHeader)}>
                    <h3 {...stylex.attrs(ins.sectionTitle)}>FILE DETAILS</h3>
                    <button {...stylex.attrs(ins.textAction)} onClick={() => setEdit(true)}>
                      Edit details
                      <ArrowUpRight size={10} />
                    </button>
                  </div>
                  <dl {...stylex.attrs(ins.metadata)}>
                    <div {...stylex.attrs(ins.metaRow)}>
                      <dt {...stylex.attrs(ins.metaKey)}>
                        <CalendarDays size={12} />
                        Captured
                      </dt>
                      <dd {...stylex.attrs(ins.metaValue)}>{formatDate(a().date)}</dd>
                    </div>
                    <div {...stylex.attrs(ins.metaRow)}>
                      <dt {...stylex.attrs(ins.metaKey)}>
                        <MapPin size={12} />
                        Location
                      </dt>
                      <dd {...stylex.attrs(ins.metaValue)}>{a().location || 'Not set'}</dd>
                    </div>
                    <div {...stylex.attrs(ins.metaRow)}>
                      <dt {...stylex.attrs(ins.metaKey)}>
                        <FileImage size={12} />
                        Dimensions
                      </dt>
                      <dd {...stylex.attrs(ins.metaValue)}>
                        {a().width && a().height
                          ? `${a().width} × ${a().height}`
                          : a().demo
                            ? 'Sample photograph'
                            : 'Not indexed'}
                      </dd>
                    </div>
                    <div {...stylex.attrs(ins.metaRow)}>
                      <dt {...stylex.attrs(ins.metaKey)}>
                        <HardDrive size={12} />
                        File size
                      </dt>
                      <dd {...stylex.attrs(ins.metaValue)}>
                        {a().size ? formatBytes(a().size) : 'Sample asset'}
                      </dd>
                    </div>
                  </dl>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.sectionHeader)}>
                    <h3 {...stylex.attrs(ins.sectionTitle)}>TAGS</h3>
                    <span {...stylex.attrs(ins.smallMuted)}>{a().tags.length}</span>
                  </div>
                  <div {...stylex.attrs(ins.tags)}>
                    <For each={a().tags}>
                      {(t) => (
                        <span {...stylex.attrs(ins.tag)}>
                          {t}
                          <button
                            {...stylex.attrs(ins.removeTag)}
                            aria-label={`Remove tag ${t}`}
                            onClick={() =>
                              s.update(a().id, { tags: a().tags.filter((x) => x !== t) })
                            }
                          >
                            <X size={9} />
                          </button>
                        </span>
                      )}
                    </For>
                  </div>
                  <form
                    {...stylex.attrs(ins.tagForm)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTag();
                    }}
                  >
                    <input
                      aria-label="New tag"
                      value={tag()}
                      onInput={(e) => setTag(e.currentTarget.value)}
                      placeholder="Add a tag…"
                      maxLength={64}
                      {...stylex.attrs(ins.tagInput)}
                    />
                    <IconButton label="Add tag" disabled={!tag().trim()} type="submit">
                      <Plus size={12} />
                    </IconButton>
                  </form>
                  <div {...stylex.attrs(ins.divider)} />
                  <h3 {...stylex.attrs(ins.sectionTitle)}>COLLECTION</h3>
                  <label {...stylex.attrs(ins.collection)}>
                    <Folder size={15} />
                    <select
                      aria-label="Asset collection"
                      value={a().collection}
                      onChange={(e) => {
                        s.update(a().id, { collection: e.currentTarget.value });
                        s.notify('Collection updated.');
                      }}
                      {...stylex.attrs(ins.select)}
                    >
                      <option value="">Unsorted</option>
                      <For each={s.collections}>
                        {(c) => <option value={c.id}>{c.name}</option>}
                      </For>
                    </select>
                  </label>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.sourceBox)}>
                    <div {...stylex.attrs(ins.sourceIcon)}>
                      <HardDrive size={15} />
                    </div>
                    <div>
                      <strong {...stylex.attrs(ins.sourceTitle)}>
                        {a().demo
                          ? 'Bundled sample'
                          : a().serverId
                            ? 'Uploaded original'
                            : 'Saved on this device'}
                      </strong>
                      <p {...stylex.attrs(ins.smallMuted)}>
                        {a().demo
                          ? 'Explore freely. Your originals stay yours.'
                          : a().serverId
                            ? 'Available through managed storage.'
                            : 'Stored locally in this browser.'}
                      </p>
                    </div>
                    <Check size={12} {...stylex.attrs(ins.success)} />
                  </div>
                  <div {...stylex.attrs(ins.actionRow)}>
                    <Button onClick={() => setPreview(true)}>
                      <Expand size={12} />
                      Open preview
                    </Button>
                    <a
                      href={a().src}
                      download={a().filename}
                      {...stylex.attrs(ins.download)}
                      aria-label="Download original"
                      title="Download original"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </Show>
                <Show when={tab() === 'memories'}>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.noteHeading)}>
                    <BookOpen size={16} />
                    <h3>A moment worth keeping</h3>
                  </div>
                  <p {...stylex.attrs(ins.description)}>
                    What was happening beyond the frame? Your note is private and saved on this
                    device.
                  </p>
                  <Textarea
                    aria-label="Memory note"
                    placeholder="I remember…"
                    value={a().memory}
                    onInput={(e) => s.update(a().id, { memory: e.currentTarget.value })}
                  />
                  <span {...stylex.attrs(ins.autosaved)}>
                    <Check size={11} />
                    Saved as you write
                  </span>
                </Show>
                <Show when={tab() === 'ai'}>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.noteHeading)}>
                    <Sparkles size={16} />
                    <h3>A little creative company</h3>
                  </div>
                  <p {...stylex.attrs(ins.description)}>
                    Open the AI workspace to draft text with Liara. Your media is never sent to a
                    model automatically.
                  </p>
                  <div {...stylex.attrs(ins.actionRow)}>
                    <a href="/ai">Open AI workspace</a>
                  </div>
                </Show>
                <Show when={tab() === 'publish'}>
                  <div {...stylex.attrs(ins.divider)} />
                  <div {...stylex.attrs(ins.noteHeading)}>
                    <Send size={16} />
                    <h3>Start with a draft</h3>
                  </div>
                  <p {...stylex.attrs(ins.description)}>
                    Work on a caption here. Publishing to YouTube requires a connected account and
                    is not available yet.
                  </p>
                  <Textarea
                    aria-label="Publication draft"
                    value={a().draft}
                    onInput={(e) => s.update(a().id, { draft: e.currentTarget.value })}
                    placeholder="Every story starts somewhere…"
                  />
                  <span {...stylex.attrs(ins.autosaved)}>
                    <Check size={11} />
                    Draft saved locally
                  </span>
                  <div {...stylex.attrs(ins.actionRow)}>
                    <Button variant="primary" disabled>
                      Publish to YouTube
                    </Button>
                  </div>
                </Show>
              </div>
            </Tabs>
            <div {...stylex.attrs(ins.footer)}>
              <span {...stylex.attrs(ins.success)}>
                <Check size={11} />
              </span>
              Private to your workspace
            </div>
            <Dialog
              open={edit()}
              onOpenChange={setEdit}
              title="Edit the details"
              description="Changes are saved on this device."
            >
              <form
                {...stylex.attrs(ins.editForm)}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!title().trim()) return;
                  s.update(a().id, {
                    title: title().trim(),
                    description: description().trim(),
                    location: location().trim(),
                  });
                  setEdit(false);
                  s.notify('Details updated.');
                }}
              >
                <label>
                  Title
                  <TextField
                    aria-label="Asset title"
                    value={title()}
                    onInput={(e) => setTitle(e.currentTarget.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  Location
                  <TextField
                    aria-label="Asset location"
                    value={location()}
                    onInput={(e) => setLocation(e.currentTarget.value)}
                    maxLength={200}
                  />
                </label>
                <label>
                  Description
                  <Textarea
                    aria-label="Asset description"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                  />
                </label>
                <Button variant="primary" type="submit">
                  <Check size={13} />
                  Save changes
                </Button>
              </form>
            </Dialog>
            <MediaPreview asset={preview() ? a() : undefined} onClose={() => setPreview(false)} />
          </>
        )}
      </Show>
    </aside>
  );
}
const ins = stylex.create({
  panel: {
    width: {
      default: 304,
      '@media (max-width: 1250px)': 280,
      '@media (max-width: 1023px)': 352,
      '@media (max-width: 600px)': '100%',
    },
    flexShrink: 0,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.sidebar,
    display: 'flex',
    position: { default: 'relative', '@media (max-width: 1023px)': 'absolute' },
    insetBlock: 0,
    insetInlineEnd: 0,
    zIndex: 40,
    flexDirection: 'column',
    minHeight: 0,
  },
  header: {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingInline: 20,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
  },
  headerTitle: { fontSize: 11, fontWeight: 500 },
  selectionCount: { fontSize: 9, color: colors.muted, marginInlineStart: 'auto' },
  body: { padding: 20, flex: 1, overflowY: 'auto' },
  preview: {
    position: 'relative',
    aspectRatio: '1.36',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  previewImage: { width: '100%', height: '100%', objectFit: 'cover' },
  mediaPlaceholder: { height: '100%', display: 'grid', placeItems: 'center', color: colors.muted },
  expand: {
    position: 'absolute',
    bottom: 8,
    insetInlineEnd: 8,
    width: 24,
    height: 24,
    display: 'grid',
    placeItems: 'center',
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: 4,
    backgroundColor: colors.mediaScrim,
    color: colors.mediaText,
  },
  demo: {
    position: 'absolute',
    bottom: 10,
    insetInlineStart: 10,
    color: colors.mediaText,
    fontSize: 7,
    letterSpacing: '1px',
    backgroundColor: colors.mediaScrim,
    paddingInline: 4,
    borderRadius: 3,
  },
  assetHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  fileType: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: '0.8px',
  },
  assetTitle: {
    fontSize: 17,
    lineHeight: 1.5,
    fontWeight: 500,
    letterSpacing: '-0.5px',
    marginTop: 4,
    overflowWrap: 'anywhere',
  },
  filename: {
    fontFamily: 'ui-monospace,monospace',
    fontSize: 9,
    color: colors.muted,
    marginTop: 4,
    overflowWrap: 'anywhere',
  },
  description: {
    fontSize: 11,
    lineHeight: '19px',
    color: colors.secondary,
    marginTop: 14,
    marginBottom: 14,
  },
  divider: { height: 1, backgroundColor: colors.border, marginBlock: 20 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 8, fontWeight: 500, letterSpacing: '1.2px', color: colors.muted },
  textAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: colors.accent,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    padding: 0,
    fontSize: 9,
  },
  metadata: { display: 'flex', flexDirection: 'column', gap: 14, margin: 0 },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    fontSize: 9,
    color: colors.secondary,
  },
  metaKey: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, color: colors.muted },
  metaValue: { margin: 0, textAlign: 'end', overflowWrap: 'anywhere', minWidth: 0 },
  smallMuted: { fontSize: 9, color: colors.muted, lineHeight: '17px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    paddingInline: 7,
    paddingBlock: 3,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.secondary,
    fontSize: 9,
  },
  removeTag: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    padding: 0,
    color: colors.muted,
    display: 'grid',
    placeItems: 'center',
  },
  tagForm: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 5,
    paddingInline: 7,
  },
  tagInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    paddingBlock: 8,
    color: colors.text,
    minWidth: 0,
    width: '100%',
    fontSize: 10,
    outline: 'none',
  },
  collection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    color: colors.accent,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
  },
  select: {
    backgroundColor: colors.sidebar,
    color: colors.secondary,
    borderWidth: 0,
    borderStyle: 'solid',
    fontSize: 10,
    minWidth: 0,
    width: '100%',
  },
  sourceBox: { display: 'flex', gap: 10, alignItems: 'center' },
  sourceIcon: {
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    color: colors.secondary,
  },
  sourceTitle: { fontSize: 10, fontWeight: 500 },
  success: { color: colors.success },
  actionRow: { display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' },
  download: {
    display: 'grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    color: colors.secondary,
  },
  footer: {
    height: 40,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
    paddingInline: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 9,
    color: colors.muted,
  },
  noteHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: colors.accent,
  },
  autosaved: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 9,
    color: colors.muted,
    marginTop: 10,
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: 16, fontSize: 12 },
});
