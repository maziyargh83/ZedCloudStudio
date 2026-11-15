import { For, Show, createMemo, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate } from '@tanstack/solid-router';
import { createQuery } from '@tanstack/solid-query';
import {
  Upload,
  Plus,
  Pause,
  Play,
  RotateCcw,
  X,
  Check,
  Server,
  HardDrive,
  Cloud,
  ArrowUpRight,
  Settings2,
  ShieldCheck,
  AlertCircle,
  FileImage,
  ListFilter,
  Eye,
  FolderOpen,
} from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { Button, IconButton, Badge, Dialog, TextField, EmptyState } from '@z-cloud/ui';
import {
  serverInputSchema,
  type StorageServer,
  type ServerInput,
  type TransferJob,
  type PublicUploadSession,
  type UploadMetadata,
} from '@z-cloud/contracts';
import { api } from '../api';
import { useStudio } from '../state';
import { useTransfers } from '../transfers';
import { openImport } from '../shell';
import { formatBytes } from '../data';
import { lib } from './library';
import { MetadataFields, form } from './import-dialog';

export function TransferQueue() {
  const queue = useTransfers();
  const studio = useStudio();
  const navigate = useNavigate();
  const go = (to: string) => navigate({ to });
  const [filter, setFilter] = createSignal('all');
  const serverJobs = createQuery(() => ({
    queryKey: ['server-transfers'],
    queryFn: () => api<{ data: PublicUploadSession[] }>('/v1/uploads'),
    refetchInterval: 2000,
    retry: false,
  }));
  const [details, setDetails] = createSignal<string>();
  const [edited, setEdited] = createStore<UploadMetadata>({} as UploadMetadata);
  const [editingError, setEditingError] = createSignal('');
  const all = createMemo(() => {
    const local = [...queue.jobs];
    const ids = new Set(local.map((job) => job.id));
    for (const session of serverJobs.data?.data ?? [])
      if (!ids.has(session.id))
        local.push({
          id: session.id,
          metadata: session.metadata,
          destinationId: session.destinationId,
          destinationName: session.destinationName,
          status: session.status,
          phase: session.phase,
          receivedBytes: session.receivedBytes,
          destinationBytes: session.destinationBytes,
          attempts: 0,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          error: session.error,
        });
    return local.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  const filtered = createMemo(() =>
    all().filter(
      (job) =>
        filter() === 'all' ||
        (filter() === 'active'
          ? ['queued', 'uploading'].includes(job.status)
          : job.status === filter()),
    ),
  );
  const current = createMemo(() => all().find((job) => job.id === details()));
  const canEdit = createMemo(
    () =>
      current() &&
      queue.jobs.some((job) => job.id === current()!.id) &&
      ['paused', 'failed'].includes(current()!.status) &&
      ['receiving', 'waiting', 'preparing'].includes(current()!.phase),
  );
  const busy = createMemo(() =>
    all().filter((job) => ['queued', 'uploading'].includes(job.status)),
  );
  const completed = createMemo(() => all().filter((job) => job.status === 'completed').length);
  async function control(job: TransferJob, action: 'pause' | 'resume' | 'cancel') {
    if (queue.jobs.some((local) => local.id === job.id)) await queue.control(job.id, action);
    else
      try {
        await api(`/v1/uploads/${job.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
        await serverJobs.refetch();
      } catch (error) {
        studio.notify((error as Error).message);
      }
  }
  const phaseLabel = (job: TransferJob) =>
    job.status === 'completed'
      ? 'Delivered'
      : job.status === 'paused'
        ? 'Paused'
        : job.status === 'failed'
          ? 'Needs attention'
          : job.status === 'cancelled'
            ? 'Cancelled'
            : job.status === 'queued'
              ? 'Waiting in queue'
              : job.phase === 'receiving'
                ? 'Sending to upload service'
                : job.phase === 'preparing'
                  ? 'Verifying original'
                  : job.phase === 'registering'
                    ? 'Saving metadata'
                    : `Uploading to ${job.destinationName}`;
  const percent = (job: TransferJob) =>
    job.status === 'completed'
      ? 100
      : Math.min(
          100,
          Math.floor(((job.receivedBytes + job.destinationBytes) / (2 * job.metadata.size)) * 100),
        );
  let originalInput!: HTMLInputElement;
  const [attachId, setAttachId] = createSignal('');
  return (
    <div {...stylex.attrs(lib.page)}>
      <div {...stylex.attrs(lib.pageHeader)}>
        <div>
          <div {...stylex.attrs(lib.eyebrow)}>YOUR MEDIA, IN MOTION</div>
          <h1 {...stylex.attrs(lib.title)}>
            Import queue <Badge>{all().length}</Badge>
          </h1>
          <p {...stylex.attrs(lib.subtitle)}>
            Every file, every destination, every little detail. All in one place.
          </p>
        </div>
        <Button variant="primary" onClick={openImport}>
          <Plus size={14} />
          Add media
        </Button>
      </div>
      <div {...stylex.attrs(transfers.overview)}>
        <div {...stylex.attrs(transfers.overviewIcon)}>
          <Upload size={22} />
        </div>
        <div {...stylex.attrs(transfers.overviewCopy)}>
          <h2>
            {busy().length
              ? `${busy().length} transfers in motion`
              : all().length
                ? 'A little room for your next story'
                : 'Ready when you are'}
          </h2>
          <p>
            {completed()} delivered · {all().filter((job) => job.status === 'paused').length} paused
            · {all().filter((job) => job.status === 'failed').length} need attention
          </p>
        </div>
        <div {...stylex.attrs(transfers.toolbar)}>
          <Button
            disabled={!busy().length}
            onClick={() => void Promise.all(busy().map((job) => control(job, 'pause')))}
          >
            <Pause size={13} />
            Pause all
          </Button>
          <Button
            disabled={!all().some((job) => job.status === 'paused')}
            onClick={() =>
              void Promise.all(
                all()
                  .filter((job) => job.status === 'paused')
                  .map((job) => control(job, 'resume')),
              )
            }
          >
            <Play size={13} />
            Resume paused
          </Button>
          <Button
            disabled={!all().some((job) => job.status === 'failed')}
            onClick={() =>
              void Promise.all(
                all()
                  .filter((job) => job.status === 'failed')
                  .map((job) => control(job, 'resume')),
              )
            }
          >
            <RotateCcw size={13} />
            Retry failed
          </Button>
          <Button onClick={() => void go('/servers')}>
            <Server size={13} />
            Servers
            <ArrowUpRight size={12} />
          </Button>
        </div>
      </div>
      <div {...stylex.attrs(transfers.filterRow)} role="group" aria-label="Queue status">
        <For
          each={[
            { id: 'all', name: 'All transfers' },
            { id: 'active', name: 'Active' },
            { id: 'paused', name: 'Paused' },
            { id: 'failed', name: 'Needs attention' },
            { id: 'completed', name: 'Completed' },
            { id: 'cancelled', name: 'Cancelled' },
          ]}
        >
          {(item) => (
            <button
              aria-pressed={filter() === item.id}
              {...stylex.attrs(transfers.filter, filter() === item.id && transfers.filterActive)}
              onClick={() => setFilter(item.id)}
            >
              {item.name}
            </button>
          )}
        </For>
      </div>
      <Show when={serverJobs.isError}>
        <div {...stylex.attrs(transfers.info)}>
          <AlertCircle size={15} />
          <p>
            The upload service is unavailable. Files and pending work are saved on this device.
            Resume when it is back.
          </p>
          <Button
            size="sm"
            onClick={() => {
              void serverJobs.refetch();
              void queue.refreshServers();
            }}
          >
            Reconnect
          </Button>
        </div>
      </Show>
      <Show
        when={filtered().length}
        fallback={
          <EmptyState
            icon={<Upload size={28} />}
            title={all().length ? 'Nothing in this view' : 'Give your files a destination'}
            description={
              all().length
                ? 'Choose another status to see the rest of your queue.'
                : 'Add files, fill in your own details, and choose a storage server. Your queue stays with you after you close the app.'
            }
            action={
              <Button variant="primary" onClick={openImport}>
                <Plus size={14} />
                Choose media
              </Button>
            }
          />
        }
      >
        <div {...stylex.attrs(transfers.queueHeader)}>
          <span>FILE & DESTINATION</span>
          <span {...stylex.attrs(transfers.hideMobile)}>TRANSFER STATUS</span>
          <span>ACTIONS</span>
        </div>
        <div {...stylex.attrs(transfers.rows)}>
          <For each={filtered()}>
            {(job) => (
              <article
                data-testid="transfer-row"
                data-status={job.status}
                {...stylex.attrs(transfers.row)}
              >
                <div {...stylex.attrs(transfers.identity)}>
                  <span
                    {...stylex.attrs(
                      transfers.fileType,
                      job.status === 'completed' && transfers.doneIcon,
                    )}
                  >
                    {job.status === 'completed' ? <Check size={20} /> : <FileImage size={20} />}
                  </span>
                  <div {...stylex.attrs(transfers.names)}>
                    <strong>{job.metadata.title}</strong>
                    <span>{job.metadata.filename}</span>
                    <div {...stylex.attrs(transfers.destination)}>
                      <Server size={11} />
                      {job.destinationName}
                      <span>·</span>
                      {formatBytes(job.metadata.size)}
                      <Show when={job.metadata.tags.length}>
                        <span>·</span>
                        <span>{job.metadata.tags.slice(0, 2).join(', ')}</span>
                      </Show>
                    </div>
                  </div>
                </div>
                <div {...stylex.attrs(transfers.progressColumn)}>
                  <div {...stylex.attrs(transfers.progressText)}>
                    <span
                      {...stylex.attrs(
                        job.status === 'failed' && transfers.danger,
                        job.status === 'completed' && transfers.success,
                      )}
                    >
                      {phaseLabel(job)}
                    </span>
                    <span>{percent(job)}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Upload progress for ${job.metadata.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent(job)}
                    {...stylex.attrs(transfers.track)}
                  >
                    <div
                      {...stylex.attrs(
                        transfers.fill,
                        job.status === 'completed' && transfers.fillDone,
                        job.status === 'failed' && transfers.fillError,
                      )}
                      style={{ width: `${percent(job)}%` }}
                    />
                  </div>
                  <Show
                    when={job.error}
                    fallback={
                      <span {...stylex.attrs(transfers.subtext)}>
                        {formatBytes(job.receivedBytes)} received ·{' '}
                        {formatBytes(job.destinationBytes)} delivered
                      </span>
                    }
                  >
                    <p {...stylex.attrs(transfers.errorText)}>{job.error}</p>
                  </Show>
                </div>
                <div {...stylex.attrs(transfers.actions)}>
                  <IconButton
                    label={`Details for ${job.metadata.title}`}
                    onClick={() => {
                      setDetails(job.id);
                      setEdited(reconcile(JSON.parse(JSON.stringify(job.metadata))));
                      setEditingError('');
                    }}
                  >
                    <Eye size={14} />
                  </IconButton>
                  <Show when={['queued', 'uploading'].includes(job.status)}>
                    <IconButton
                      label={`Pause ${job.metadata.title}`}
                      onClick={() => void control(job, 'pause')}
                    >
                      <Pause size={14} />
                    </IconButton>
                  </Show>
                  <Show when={['paused', 'failed'].includes(job.status)}>
                    <IconButton
                      label={`${job.status === 'failed' ? 'Retry' : 'Resume'} ${job.metadata.title}`}
                      onClick={() => void control(job, 'resume')}
                    >
                      {job.status === 'failed' ? <RotateCcw size={14} /> : <Play size={14} />}
                    </IconButton>
                  </Show>
                  <Show when={job.status === 'failed' && job.error?.includes('original')}>
                    <IconButton
                      label={`Select original for ${job.metadata.title}`}
                      onClick={() => {
                        setAttachId(job.id);
                        originalInput.click();
                      }}
                    >
                      <FolderOpen size={14} />
                    </IconButton>
                  </Show>
                  <Show
                    when={
                      !['completed', 'cancelled'].includes(job.status) &&
                      job.phase !== 'registering'
                    }
                  >
                    <IconButton
                      label={`Cancel ${job.metadata.title}`}
                      onClick={() => void control(job, 'cancel')}
                    >
                      <X size={14} />
                    </IconButton>
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
      <div {...stylex.attrs(transfers.footerNote)}>
        <ShieldCheck size={14} />
        <p>
          Your original stays on this device. Once fully received, the upload service continues
          delivery even if you close the page.
        </p>
      </div>
      <input
        hidden
        ref={originalInput}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file)
            void queue.attachFile(attachId(), file).catch((error) => studio.notify(error.message));
          event.currentTarget.value = '';
        }}
      />
      <Dialog
        open={Boolean(current())}
        onOpenChange={(open) => {
          if (!open) setDetails(undefined);
        }}
        title={current()?.metadata.title ?? 'Transfer details'}
        description={`${current()?.destinationName ?? ''} · ${current() ? phaseLabel(current()!) : ''}`}
      >
        <Show when={current()}>
          {(job) => (
            <>
              <fieldset disabled={!canEdit()} {...stylex.attrs(transfers.fieldset)}>
                <MetadataFields value={edited} onChange={(patch) => setEdited(patch)} />
              </fieldset>
              <Show when={!canEdit()}>
                <p {...stylex.attrs(form.hint)}>
                  Pause before transfer to the destination starts to change these details.
                </p>
              </Show>
              <Show when={editingError()}>
                <p role="alert" {...stylex.attrs(form.error)}>
                  {editingError()}
                </p>
              </Show>
              <div {...stylex.attrs(transfers.dialogActions)}>
                <Show when={['queued', 'uploading'].includes(job().status)}>
                  <Button onClick={() => void control(job(), 'pause')}>Pause to edit</Button>
                </Show>
                <Button
                  variant="primary"
                  disabled={!canEdit()}
                  onClick={async () => {
                    try {
                      await queue.edit(job().id, JSON.parse(JSON.stringify(edited)));
                      setDetails(undefined);
                      studio.notify('Transfer details updated.');
                    } catch (error) {
                      setEditingError((error as Error).message);
                    }
                  }}
                >
                  Save details
                </Button>
              </div>
            </>
          )}
        </Show>
      </Dialog>
    </div>
  );
}

export function StorageServers() {
  const queue = useTransfers();
  const studio = useStudio();
  const [open, setOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string>();
  const defaults = {
    name: '',
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    prefix: 'zcloud/',
    forcePathStyle: true,
    enabled: true,
  };
  const [fields, setFields] = createStore<ServerInput>({ ...defaults });
  const [access, setAccess] = createSignal('');
  const [secret, setSecret] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [testing, setTesting] = createSignal('');
  const [buckets, setBuckets] = createSignal<string[]>([]);
  function edit(server?: StorageServer) {
    setFields(reconcile(server ? serverInputSchema.parse(server) : { ...defaults }));
    setEditingId(server?.id);
    setAccess('');
    setSecret('');
    setError('');
    setBuckets([]);
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const input = {
        server: serverInputSchema.parse(fields),
        ...(access() || secret()
          ? { credentials: { accessKeyId: access(), secretAccessKey: secret() } }
          : {}),
      };
      await api(`/v1/servers${editingId() ? `/${editingId()}` : ''}`, {
        method: editingId() ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      await queue.refreshServers();
      setOpen(false);
      setAccess('');
      setSecret('');
      studio.notify('Storage server saved.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div {...stylex.attrs(lib.page)}>
      <div {...stylex.attrs(lib.pageHeader)}>
        <div>
          <div {...stylex.attrs(lib.eyebrow)}>A HOME FOR YOUR ORIGINALS</div>
          <h1 {...stylex.attrs(lib.title)}>
            Storage servers <Badge>{queue.servers().length}</Badge>
          </h1>
          <p {...stylex.attrs(lib.subtitle)}>
            Connect your storage once. Choose the right destination for every import.
          </p>
        </div>
        <Button variant="primary" onClick={() => edit()}>
          <Plus size={14} />
          Add server
        </Button>
      </div>
      <Show when={queue.connectionError()}>
        <div {...stylex.attrs(transfers.info)}>
          <AlertCircle size={16} />
          <p>{queue.connectionError()}</p>
          <Button onClick={() => void queue.refreshServers()}>Reconnect</Button>
        </div>
      </Show>
      <div {...stylex.attrs(transfers.serverGrid)}>
        <For each={queue.servers()}>
          {(server) => (
            <section data-testid="storage-server" {...stylex.attrs(transfers.serverCard)}>
              <div {...stylex.attrs(transfers.serverHeading)}>
                <span {...stylex.attrs(transfers.serverIcon)}>
                  {server.kind === 's3' ? <Cloud size={23} /> : <HardDrive size={23} />}
                </span>
                <div {...stylex.attrs(transfers.names)}>
                  <h2>{server.name}</h2>
                  <span>
                    {server.kind === 's3' ? 'S3-compatible storage' : 'Managed API storage'}
                  </span>
                </div>
                <Badge tone={server.connectionStatus === 'connected' ? 'success' : 'neutral'}>
                  {!server.enabled
                    ? 'DISABLED'
                    : server.connectionStatus === 'connected'
                      ? 'CONNECTED'
                      : server.connectionStatus === 'error'
                        ? 'CHECK CONNECTION'
                        : 'NOT TESTED'}
                </Badge>
              </div>
              <dl {...stylex.attrs(transfers.serverDetails)}>
                <div {...stylex.attrs(transfers.serverDetailRow)}>
                  <dt {...stylex.attrs(transfers.serverKey)}>Endpoint</dt>
                  <dd {...stylex.attrs(transfers.serverValue)}>
                    <bdi>{server.endpoint}</bdi>
                  </dd>
                </div>
                <div {...stylex.attrs(transfers.serverDetailRow)}>
                  <dt {...stylex.attrs(transfers.serverKey)}>Bucket</dt>
                  <dd {...stylex.attrs(transfers.serverValue)}>
                    {server.kind === 'local'
                      ? 'Local originals'
                      : server.bucket || 'Choose a bucket'}
                  </dd>
                </div>
                <div {...stylex.attrs(transfers.serverDetailRow)}>
                  <dt {...stylex.attrs(transfers.serverKey)}>Region</dt>
                  <dd {...stylex.attrs(transfers.serverValue)}>{server.region}</dd>
                </div>
                <div {...stylex.attrs(transfers.serverDetailRow)}>
                  <dt {...stylex.attrs(transfers.serverKey)}>Object prefix</dt>
                  <dd {...stylex.attrs(transfers.serverValue)}>
                    <bdi>{server.prefix || '—'}</bdi>
                  </dd>
                </div>
              </dl>
              <div {...stylex.attrs(transfers.credentialNote)}>
                <ShieldCheck size={13} />
                {server.kind === 'local'
                  ? 'Originals stay on the API server'
                  : server.credentialsConfigured
                    ? 'Credentials stored securely on the API server'
                    : 'Credentials required'}
              </div>
              <div {...stylex.attrs(transfers.serverActions)}>
                <Button
                  disabled={testing() === server.id}
                  onClick={async () => {
                    setTesting(server.id);
                    try {
                      const result = await api<{ data: StorageServer }>(
                        `/v1/servers/${server.id}/test`,
                        { method: 'POST', body: '{}' },
                      );
                      await queue.refreshServers();
                      studio.notify(result.data.connectionMessage ?? 'Connection checked.');
                    } catch (error) {
                      studio.notify((error as Error).message);
                    } finally {
                      setTesting('');
                    }
                  }}
                >
                  <RotateCcw size={12} />
                  {testing() === server.id ? 'Checking…' : 'Test connection'}
                </Button>
                <Show when={server.kind === 's3'}>
                  <Button onClick={() => edit(server)}>
                    <Settings2 size={13} />
                    Settings
                  </Button>
                </Show>
              </div>
            </section>
          )}
        </For>
      </div>
      <div {...stylex.attrs(transfers.footerNote)}>
        <ShieldCheck size={14} />
        <p>
          Access keys stay on the API server. Media is stored under a unique folder with its own
          metadata file.
        </p>
      </div>
      <Dialog
        open={open()}
        onOpenChange={(value) => {
          if (!busy()) {
            setOpen(value);
            if (!value) {
              setAccess('');
              setSecret('');
            }
          }
        }}
        title={editingId() ? 'Storage server settings' : 'Add a storage server'}
        description="Connect S3-compatible storage. Credentials are encrypted on the API server."
      >
        <form
          {...stylex.attrs(form.fields)}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label {...stylex.attrs(form.label)}>
            Server name
            <TextField
              aria-label="Server name"
              required
              value={fields.name}
              maxLength={100}
              onInput={(event) => setFields('name', event.currentTarget.value)}
            />
          </label>
          <label {...stylex.attrs(form.label)}>
            S3 endpoint
            <TextField
              aria-label="S3 endpoint"
              type="url"
              required
              value={fields.endpoint}
              placeholder="https://storage.example.com"
              onInput={(event) => setFields('endpoint', event.currentTarget.value)}
            />
          </label>
          <div {...stylex.attrs(form.twoColumns)}>
            <label {...stylex.attrs(form.label)}>
              Region
              <TextField
                aria-label="Server region"
                required
                value={fields.region}
                onInput={(event) => setFields('region', event.currentTarget.value)}
              />
            </label>
            <label {...stylex.attrs(form.label)}>
              Bucket
              <TextField
                aria-label="Server bucket"
                value={fields.bucket}
                list="storage-buckets"
                onInput={(event) => setFields('bucket', event.currentTarget.value)}
              />
              <datalist id="storage-buckets">
                <For each={buckets()}>{(bucket) => <option value={bucket} />}</For>
              </datalist>
            </label>
          </div>
          <Show when={editingId()}>
            <Button
              type="button"
              onClick={async () => {
                try {
                  setBuckets(
                    (await api<{ data: string[] }>(`/v1/servers/${editingId()}/buckets`)).data,
                  );
                  studio.notify('Available buckets loaded.');
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              Load available buckets
            </Button>
          </Show>
          <label {...stylex.attrs(form.label)}>
            Object prefix
            <TextField
              aria-label="Object prefix"
              value={fields.prefix}
              onInput={(event) => setFields('prefix', event.currentTarget.value)}
            />
          </label>
          <div {...stylex.attrs(form.twoColumns)}>
            <label {...stylex.attrs(form.label)}>
              {editingId() ? 'New access key (optional)' : 'Access key'}
              <TextField
                aria-label="S3 access key"
                autocomplete="off"
                required={!editingId()}
                value={access()}
                onInput={(event) => setAccess(event.currentTarget.value)}
              />
            </label>
            <label {...stylex.attrs(form.label)}>
              {editingId() ? 'New secret key (optional)' : 'Secret key'}
              <TextField
                aria-label="S3 secret key"
                type="password"
                autocomplete="new-password"
                required={!editingId()}
                value={secret()}
                onInput={(event) => setSecret(event.currentTarget.value)}
              />
            </label>
          </div>
          <label {...stylex.attrs(form.checkbox)}>
            <input
              type="checkbox"
              checked={fields.forcePathStyle}
              onChange={(event) => setFields('forcePathStyle', event.currentTarget.checked)}
            />
            Use path-style S3 requests
          </label>
          <label {...stylex.attrs(form.checkbox)}>
            <input
              type="checkbox"
              checked={fields.enabled}
              onChange={(event) => setFields('enabled', event.currentTarget.checked)}
            />
            Available as an upload destination
          </label>
          <Show when={error()}>
            <p role="alert" {...stylex.attrs(form.error)}>
              {error()}
            </p>
          </Show>
          <Button variant="primary" type="submit" disabled={busy()}>
            {busy() ? 'Saving…' : 'Save server'}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
const transfers = stylex.create({
  overview: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 22,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    color: colors.accent,
    backgroundColor: colors.accentSubtle,
    display: 'grid',
    placeItems: 'center',
  },
  overviewCopy: { flex: 1, minWidth: 180, fontSize: 12, color: colors.secondary },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: '100%' },
  filterRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    marginBottom: 20,
  },
  filter: {
    height: 38,
    paddingInline: 12,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderStyle: 'solid',
    borderBottomColor: 'transparent',
    color: colors.muted,
    backgroundColor: 'transparent',
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  filterActive: { color: colors.text, borderBottomColor: colors.accent },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.accentSubtle,
    color: colors.accent,
    fontSize: 11,
    lineHeight: '19px',
    borderRadius: 8,
    marginBottom: 20,
  },
  queueHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) minmax(180px,.65fr) 140px',
    gap: 20,
    paddingInline: 16,
    paddingBottom: 12,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.muted,
    '@media (max-width: 800px)': { gridTemplateColumns: '1fr auto' },
  },
  hideMobile: { display: { default: 'inline', '@media (max-width: 800px)': 'none' } },
  rows: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0,1fr) minmax(180px,.65fr) 140px',
      '@media (max-width: 800px)': 'minmax(0,1fr) auto',
    },
    gap: 20,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  identity: { display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 },
  fileType: {
    display: 'grid',
    placeItems: 'center',
    width: 42,
    height: 48,
    flexShrink: 0,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    color: colors.secondary,
  },
  doneIcon: { backgroundColor: colors.surfaceAlt, color: colors.success },
  names: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    gap: 4,
    fontSize: 11,
    color: colors.text,
    overflowWrap: 'anywhere',
  },
  destination: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: colors.muted,
    fontSize: 9,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  progressColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    gridColumn: { default: 'auto', '@media (max-width: 800px)': '1 / -1' },
    gridRow: { default: 'auto', '@media (max-width: 800px)': 2 },
  },
  progressText: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    fontSize: 10,
    color: colors.secondary,
  },
  track: { height: 4, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, transition: 'width 120ms' },
  fillDone: { backgroundColor: colors.success },
  fillError: { backgroundColor: colors.danger },
  subtext: { fontSize: 9, color: colors.muted },
  errorText: { fontSize: 10, lineHeight: '17px', color: colors.danger },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'start',
    gap: 2,
    gridColumn: { default: 'auto', '@media (max-width: 800px)': 2 },
    gridRow: { default: 'auto', '@media (max-width: 800px)': 1 },
  },
  danger: { color: colors.danger },
  success: { color: colors.success },
  footerNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: colors.muted,
    fontSize: 10,
    lineHeight: '18px',
    marginTop: 28,
    paddingBlock: 16,
  },
  fieldset: { borderWidth: 0, margin: 0, padding: 0, minWidth: 0 },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  serverGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2,minmax(0,1fr))',
      '@media (max-width: 1000px)': '1fr',
    },
    gap: 20,
  },
  serverCard: {
    padding: 24,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    minWidth: 0,
  },
  serverHeading: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  serverIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    color: colors.accent,
    backgroundColor: colors.accentSubtle,
  },
  serverDetailRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  serverKey: { color: colors.muted, flexShrink: 0 },
  serverValue: { margin: 0, minWidth: 0, textAlign: 'end', overflowWrap: 'anywhere' },
  serverDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    fontSize: 11,
    color: colors.secondary,
    marginBlock: 24,
  },
  credentialNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 10,
    color: colors.muted,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderColor: colors.border,
  },
  serverActions: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 },
});
