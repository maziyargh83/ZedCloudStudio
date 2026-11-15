import { For, Show, createMemo, createSignal, createEffect, onCleanup } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { createStore, reconcile } from 'solid-js/store';
import {
  Plus,
  Upload,
  Image,
  Video,
  AudioLines,
  X,
  ArrowRight,
  Check,
  Server,
  Files,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { Button, IconButton, Badge, Dialog, TextField, Textarea } from '@z-cloud/ui';
import { uploadMetadataSchema, type UploadMetadata } from '@z-cloud/contracts';
import { useTransfers, type ImportDraft } from '../transfers';
import { useStudio } from '../state';
import { formatBytes } from '../data';

export function MetadataFields(props: {
  value: UploadMetadata;
  onChange: (patch: Partial<UploadMetadata>) => void;
  compact?: boolean;
}) {
  const studio = useStudio();
  const [key, setKey] = createSignal('');
  const [value, setValue] = createSignal('');
  return (
    <div {...stylex.attrs(form.fields)}>
      <label {...stylex.attrs(form.label)}>
        Title
        <TextField
          aria-label="Import title"
          value={props.value.title}
          maxLength={200}
          onInput={(event) => props.onChange({ title: event.currentTarget.value })}
        />
      </label>
      <label {...stylex.attrs(form.label)}>
        Description
        <Textarea
          aria-label="Import description"
          value={props.value.description}
          maxLength={10000}
          placeholder="The story behind this file…"
          onInput={(event) => props.onChange({ description: event.currentTarget.value })}
        />
      </label>
      <div {...stylex.attrs(form.twoColumns)}>
        <label {...stylex.attrs(form.label)}>
          Location
          <TextField
            aria-label="Import location"
            value={props.value.location}
            maxLength={300}
            placeholder="Place or location"
            onInput={(event) => props.onChange({ location: event.currentTarget.value })}
          />
        </label>
        <label {...stylex.attrs(form.label)}>
          Captured date
          <TextField
            aria-label="Import captured date"
            type="date"
            value={props.value.capturedAt.slice(0, 10)}
            onInput={(event) => {
              if (event.currentTarget.value)
                props.onChange({ capturedAt: `${event.currentTarget.value}T12:00:00.000Z` });
            }}
          />
        </label>
      </div>
      <label {...stylex.attrs(form.label)}>
        Tags
        <TextField
          aria-label="Import tags"
          value={props.value.tags.join(', ')}
          placeholder="travel, personal, project"
          onChange={(event) =>
            props.onChange({
              tags: event.currentTarget.value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 50),
            })
          }
        />
        <span {...stylex.attrs(form.hint)}>Separate tags with commas.</span>
      </label>
      <label {...stylex.attrs(form.label)}>
        Collection
        <select
          aria-label="Import collection"
          {...stylex.attrs(form.select)}
          value={props.value.collectionId ?? ''}
          onChange={(event) => {
            const collection = studio.collections.find(
              (collection) => collection.id === event.currentTarget.value,
            );
            props.onChange({ collectionId: collection?.id, collectionName: collection?.name });
          }}
        >
          <option value="">Unsorted</option>
          <For each={studio.collections}>
            {(collection) => (
              <option selected={props.value.collectionId === collection.id} value={collection.id}>
                {collection.name}
              </option>
            )}
          </For>
        </select>
      </label>
      <div>
        <div {...stylex.attrs(form.fieldHeading)}>
          <span>YOUR OWN FIELDS</span>
          <Badge>{Object.keys(props.value.customMetadata).length}/20</Badge>
        </div>
        <For each={Object.entries(props.value.customMetadata)}>
          {([field, data]) => (
            <div {...stylex.attrs(form.customRow)}>
              <span {...stylex.attrs(form.customKey)}>{field}</span>
              <span {...stylex.attrs(form.customValue)}>{data}</span>
              <IconButton
                label={`Remove custom field ${field}`}
                onClick={() => {
                  const fields = { ...props.value.customMetadata };
                  delete fields[field];
                  props.onChange({ customMetadata: fields });
                }}
              >
                <X size={12} />
              </IconButton>
            </div>
          )}
        </For>
        <div {...stylex.attrs(form.customInputs)}>
          <TextField
            aria-label="Custom field name"
            placeholder="e.g. Client"
            maxLength={64}
            value={key()}
            onInput={(event) => setKey(event.currentTarget.value)}
          />
          <TextField
            aria-label="Custom field value"
            placeholder="Your value"
            maxLength={2000}
            value={value()}
            onInput={(event) => setValue(event.currentTarget.value)}
          />
          <IconButton
            label="Add custom field"
            disabled={!key().trim() || Object.keys(props.value.customMetadata).length >= 20}
            onClick={() => {
              props.onChange({
                customMetadata: { ...props.value.customMetadata, [key().trim()]: value() },
              });
              setKey('');
              setValue('');
            }}
          >
            <Plus size={14} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
export function ImportDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
}) {
  const studio = useStudio();
  const queue = useTransfers();
  const navigate = useNavigate();
  const go = (to: string) => navigate({ to });
  const [drafts, setDrafts] = createStore<ImportDraft[]>([]);
  const [selected, setSelected] = createSignal('');
  const [destination, setDestination] = createSignal('');
  const [start, setStart] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [dragging, setDragging] = createSignal(false);
  const active = createMemo(() => drafts.find((draft) => draft.id === selected()));
  const total = createMemo(() => drafts.reduce((sum, draft) => sum + draft.file.size, 0));
  createEffect(() => {
    if (props.open) {
      void queue.refreshServers();
      if (!destination())
        setDestination(
          queue.servers().find((server) => server.kind === 's3' && server.enabled && server.bucket)
            ?.id ??
            queue.servers()[0]?.id ??
            '',
        );
    }
  });
  let input!: HTMLInputElement;
  function addFiles(files: FileList | File[]) {
    let unsupported = 0;
    const collection = studio.collections.find(
      (collection) => collection.id === props.collectionId,
    );
    for (const file of Array.from(files)) {
      if (
        !file.size ||
        !/^(image\/(jpeg|png|webp|avif|gif|heic|heif|tiff)|video\/|audio\/)/i.test(file.type)
      ) {
        unsupported++;
        continue;
      }
      if (
        drafts.some(
          (draft) =>
            draft.file.name === file.name &&
            draft.file.size === file.size &&
            draft.file.lastModified === file.lastModified,
        )
      )
        continue;
      const id = crypto.randomUUID();
      const type = file.type.startsWith('image/')
        ? 'photo'
        : file.type.startsWith('video/')
          ? 'video'
          : 'audio';
      setDrafts(drafts.length, {
        id,
        file,
        metadata: uploadMetadataSchema.parse({
          title: file.name.replace(/\.[^.]+$/, ''),
          filename: file.name,
          type,
          mime: file.type,
          size: file.size,
          capturedAt: new Date(file.lastModified).toISOString(),
          collectionId: collection?.id,
          collectionName: collection?.name,
        }),
      });
      if (!selected()) setSelected(id);
    }
    setError(unsupported ? `${unsupported} empty or unsupported files were skipped.` : '');
  }
  function reset() {
    setDrafts(reconcile([]));
    setSelected('');
    setError('');
  }
  async function submit() {
    const server = queue.servers().find((server) => server.id === destination());
    if (!server) {
      setError('Select a storage destination.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await queue.enqueue(
        drafts.map((draft) => ({
          id: draft.id,
          file: draft.file,
          metadata: JSON.parse(JSON.stringify(draft.metadata)),
        })),
        server,
        start(),
      );
      reset();
      props.onOpenChange(false);
      void go('/imports');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!saving()) props.onOpenChange(open);
      }}
      title="Bring your world in"
      description="Choose files, add the details that matter, and send them to your storage destination."
      wide
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,video/*,audio/*"
        onChange={(event) => {
          if (event.currentTarget.files) addFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <Show
        when={drafts.length}
        fallback={
          <button
            type="button"
            {...stylex.attrs(form.dropzone, dragging() && form.dragging)}
            onClick={() => input.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
            }}
          >
            <span {...stylex.attrs(form.uploadIcon)}>
              <Upload size={28} />
            </span>
            <strong>Drop your files here</strong>
            <span>Photos, videos, and audio. Pick as many as you need.</span>
            <Badge>Choose files from your device</Badge>
          </button>
        }
      >
        <div {...stylex.attrs(form.workspace)}>
          <section {...stylex.attrs(form.filePane)}>
            <div {...stylex.attrs(form.fileListHeading)}>
              <span>
                {drafts.length} FILES · {formatBytes(total())}
              </span>
              <Button size="sm" onClick={() => input.click()}>
                <Plus size={12} />
                Add files
              </Button>
            </div>
            <div {...stylex.attrs(form.fileList)}>
              <For each={drafts}>
                {(draft) => (
                  <div
                    {...stylex.attrs(form.fileRow, selected() === draft.id && form.fileSelected)}
                  >
                    <button
                      {...stylex.attrs(form.fileButton)}
                      onClick={() => setSelected(draft.id)}
                    >
                      <span {...stylex.attrs(form.fileIcon)}>
                        {draft.metadata.type === 'photo' ? (
                          <Image size={18} />
                        ) : draft.metadata.type === 'video' ? (
                          <Video size={18} />
                        ) : (
                          <AudioLines size={18} />
                        )}
                      </span>
                      <span {...stylex.attrs(form.fileNames)}>
                        <strong>{draft.file.name}</strong>
                        <span>
                          {formatBytes(draft.file.size)} · {draft.metadata.type}
                        </span>
                      </span>
                    </button>
                    <IconButton
                      label={`Remove ${draft.file.name} from import`}
                      onClick={() => {
                        const id = draft.id;
                        setDrafts(reconcile(drafts.filter((draft) => draft.id !== id)));
                        if (selected() === id) setSelected(drafts[0]?.id ?? '');
                      }}
                    >
                      <X size={12} />
                    </IconButton>
                  </div>
                )}
              </For>
            </div>
            <div {...stylex.attrs(form.batchHint)}>
              <Files size={16} />
              <p>
                Each file keeps its own title. Apply shared details to the whole batch from the
                editor.
              </p>
            </div>
          </section>
          <section {...stylex.attrs(form.editor)}>
            <Show when={active()}>
              {(draft) => (
                <>
                  <div {...stylex.attrs(form.editorHeading)}>
                    <span>FILE DETAILS</span>
                    <Badge>
                      {drafts.findIndex((item) => item.id === draft().id) + 1} of {drafts.length}
                    </Badge>
                  </div>
                  <MetadataFields
                    value={draft().metadata}
                    onChange={(patch) =>
                      setDrafts((item) => item.id === draft().id, 'metadata', patch)
                    }
                  />
                  <Show when={drafts.length > 1}>
                    <Button
                      onClick={() => {
                        const {
                          title: _title,
                          filename: _filename,
                          type: _type,
                          mime: _mime,
                          size: _size,
                          ...shared
                        } = draft().metadata;
                        const value = JSON.parse(JSON.stringify(shared));
                        setDrafts(() => true, 'metadata', value);
                        studio.notify(
                          'Description, date, tags, location, collection and custom fields applied to all files.',
                        );
                      }}
                    >
                      <Check size={13} />
                      Apply shared details to all files
                    </Button>
                  </Show>
                </>
              )}
            </Show>
          </section>
        </div>
      </Show>
      <Show when={error()}>
        <p role="alert" {...stylex.attrs(form.error)}>
          {error()}
        </p>
      </Show>
      <div {...stylex.attrs(form.destination)}>
        <div {...stylex.attrs(form.destinationLabel)}>
          <Server size={16} />
          <span>Upload destination</span>
        </div>
        <select
          aria-label="Upload destination"
          {...stylex.attrs(form.select)}
          value={destination()}
          onChange={(event) => setDestination(event.currentTarget.value)}
        >
          <option value="" disabled>
            Select a server
          </option>
          <For each={queue.servers()}>
            {(server) => (
              <option
                selected={server.id === destination()}
                value={server.id}
                disabled={!server.enabled || (server.kind === 's3' && !server.bucket)}
              >
                {server.name}
                {server.bucket ? ` / ${server.bucket}` : ''}
                {!server.enabled ? ' — disabled' : ''}
              </option>
            )}
          </For>
        </select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            props.onOpenChange(false);
            void go('/servers');
          }}
        >
          Manage servers
          <ArrowRight size={12} />
        </Button>
      </div>
      <Show when={queue.connectionError()}>
        <p {...stylex.attrs(form.hint)}>{queue.connectionError()}</p>
      </Show>
      <div {...stylex.attrs(form.dialogFooter)}>
        <label {...stylex.attrs(form.checkbox)}>
          <input
            type="checkbox"
            checked={start()}
            onChange={(event) => setStart(event.currentTarget.checked)}
          />
          Start uploading after adding to queue
        </label>
        <Button
          variant="primary"
          disabled={
            !drafts.length ||
            !destination() ||
            saving() ||
            drafts.some((draft) => !draft.metadata.title.trim())
          }
          onClick={() => void submit()}
        >
          <Upload size={14} />
          {saving()
            ? 'Saving files…'
            : `Add ${drafts.length || ''} ${drafts.length === 1 ? 'file' : 'files'} to queue`}
        </Button>
      </div>
    </Dialog>
  );
}
export const form = stylex.create({
  fields: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 11,
    color: colors.secondary,
  },
  hint: { fontSize: 10, color: colors.muted, lineHeight: '18px' },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: { default: '1fr 1fr', '@media (max-width: 600px)': '1fr' },
    gap: 12,
  },
  select: {
    minWidth: 0,
    width: '100%',
    backgroundColor: colors.canvas,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    padding: 9,
    fontSize: 12,
  },
  fieldHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 9,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 8,
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBlock: 6,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    fontSize: 11,
  },
  customKey: { color: colors.muted, minWidth: 64 },
  customValue: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  customInputs: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 },
  dropzone: {
    width: '100%',
    minHeight: 250,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.canvas,
    color: colors.secondary,
    borderRadius: 8,
    fontSize: 12,
  },
  dragging: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  uploadIcon: {
    padding: 16,
    borderRadius: 12,
    color: colors.accent,
    backgroundColor: colors.accentSubtle,
  },
  workspace: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, .8fr) minmax(0, 1.2fr)',
      '@media (max-width: 700px)': '1fr',
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  filePane: { minWidth: 0, backgroundColor: colors.canvas, padding: 16 },
  fileListHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.muted,
    marginBottom: 14,
  },
  fileList: {
    maxHeight: { default: 420, '@media (max-width: 700px)': 180 },
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 6,
    padding: 4,
  },
  fileSelected: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  fileButton: {
    flex: 1,
    minWidth: 0,
    padding: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'start',
  },
  fileIcon: {
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    color: colors.muted,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
  },
  fileNames: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 10,
    color: colors.secondary,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  batchHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    color: colors.muted,
    fontSize: 10,
    lineHeight: '18px',
    marginTop: 20,
  },
  editor: {
    padding: 20,
    minWidth: 0,
    maxHeight: 530,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  editorHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1,
  },
  destination: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'auto minmax(0, 1fr) auto',
      '@media (max-width: 700px)': '1fr',
    },
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  destinationLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: colors.secondary,
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  dialogFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
    flexWrap: 'wrap',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: colors.secondary,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    borderRadius: 6,
    marginTop: 12,
    fontSize: 12,
  },
});
