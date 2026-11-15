import { For, Show, createResource, createSignal, createMemo, createEffect } from 'solid-js';
import { useLocation, useNavigate } from '@tanstack/solid-router';
import * as stylex from '@stylexjs/stylex';
import { Button, Badge, TextField, Textarea, Dialog, EmptyState } from '@z-cloud/ui';
import { Compass, Plus, Download, MapPin, BookOpen, Backpack, Sparkles } from 'lucide-solid';
import type { Trip, TripTrack, GeoPoint } from '@z-cloud/contracts';
import { api } from '../api';
import { useStudio } from '../state';
import { parseGPX, exportGPX, trackDistance, download, tripWiki, recallPrompts } from '../travel';
import { TripMap } from './trip-map';
import { flow } from './workflow-styles';
const today = () => new Date().toISOString().slice(0, 10);
type TripPatch = Partial<Omit<Trip, 'id' | 'revision' | 'createdAt' | 'updatedAt'>>;

export function TripsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [trips, { refetch, mutate }] = createResource(() =>
    api<{ data: Trip[] }>('/v1/trips').then((r) => r.data),
  );
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal('');
  const [destination, setDestination] = createSignal('');
  const [start, setStart] = createSignal('');
  const [end, setEnd] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const current = createMemo(() =>
    trips()?.find((t) => location().pathname === `/adventures/${t.id}`),
  );
  const planning = createMemo(() => location().pathname === '/planner');
  async function create() {
    setBusy(true);
    setError('');
    try {
      const { data } = await api<{ data: Trip }>('/v1/trips', {
        method: 'POST',
        body: JSON.stringify({
          title: title(),
          destination: destination(),
          startDate: start(),
          endDate: end(),
        }),
      });
      await refetch();
      setOpen(false);
      setTitle('');
      setDestination('');
      setStart('');
      setEnd('');
      void navigate({ to: '/adventures/$tripId', params: { tripId: data.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(patch: TripPatch, story = false) {
    const trip = current();
    if (!trip) return false;
    setBusy(true);
    setError('');
    try {
      const { data } = await api<{ data: Trip }>(`/v1/trips/${trip.id}${story ? '/story' : ''}`, {
        method: story ? 'POST' : 'PATCH',
        body: JSON.stringify(story ? {} : { revision: trip.revision, patch }),
      });
      mutate((trips() ?? []).map((t) => (t.id === data.id ? data : t)));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div {...stylex.attrs(flow.page)}>
      <header {...stylex.attrs(flow.header)}>
        <div>
          <div {...stylex.attrs(flow.eyebrow)}>YOUR FIELD NOTES, CONNECTED</div>
          <h1 {...stylex.attrs(flow.title)}>
            {current()?.title ?? (planning() ? 'Trip planner' : 'Adventure wiki')}
          </h1>
          <p {...stylex.attrs(flow.muted)}>
            A living record of where you went, what you carried, and what you learned.
          </p>
        </div>
        <div {...stylex.attrs(flow.row)}>
          <Show when={current()}>
            <Button onClick={() => void navigate({ to: '/adventures' })}>All trips</Button>
          </Show>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={14} />
            New trip
          </Button>
          <Button onClick={() => void refetch()}>Refresh</Button>
        </div>
      </header>
      <Show when={error() || trips.error}>
        <p role="alert" {...stylex.attrs(flow.error)}>
          {error() || 'Trips could not be loaded. Refresh to retry.'}
        </p>
      </Show>
      <Show when={trips.loading}>
        <p role="status">Opening your field notes…</p>
      </Show>
      <Show
        when={current()}
        fallback={
          <>
            <Show
              when={trips()?.length}
              fallback={
                !trips.loading && !trips.error ? (
                  <EmptyState
                    icon={<Compass />}
                    title="Your next story starts here"
                    description="Create a trip, add a few memories, or import a GPX recording. No example trips are added."
                    action={<Button onClick={() => setOpen(true)}>Create your first trip</Button>}
                  />
                ) : null
              }
            >
              <div {...stylex.attrs(flow.grid)}>
                <For each={(trips() ?? []).filter((t) => !planning() || t.status === 'planning')}>
                  {(trip) => (
                    <button
                      {...stylex.attrs(flow.item)}
                      onClick={() =>
                        void navigate({ to: '/adventures/$tripId', params: { tripId: trip.id } })
                      }
                    >
                      <Badge>{trip.status}</Badge>
                      <h2 {...stylex.attrs(flow.heading)}>{trip.title}</h2>
                      <p {...stylex.attrs(flow.muted)}>
                        {trip.destination || 'Destination not recorded'} ·{' '}
                        {trip.startDate || 'Dates to decide'}
                      </p>
                      <p {...stylex.attrs(flow.muted)}>
                        {trip.logs.filter((l) => l.kind !== 'plan').length} logs ·{' '}
                        {trip.mediaIds.length} media · {trip.gear.filter((g) => g.packed).length}/
                        {trip.gear.length} packed
                      </p>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </>
        }
      >
        <TripDetail trip={current()!} busy={busy()} save={save} />
      </Show>
      <Dialog
        open={open()}
        onOpenChange={setOpen}
        title="Start a trip wiki"
        description="Add what you know. Dates and plans can change."
      >
        <form
          {...stylex.attrs(flow.form)}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label {...stylex.attrs(flow.label)}>
            Trip title
            <TextField
              aria-label="Trip title"
              required
              maxLength={200}
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </label>
          <label {...stylex.attrs(flow.label)}>
            Destination
            <TextField
              aria-label="Trip destination"
              value={destination()}
              maxLength={300}
              onInput={(e) => setDestination(e.currentTarget.value)}
            />
          </label>
          <div {...stylex.attrs(flow.grid)}>
            <label {...stylex.attrs(flow.label)}>
              Start date
              <TextField
                aria-label="Trip start date"
                type="date"
                value={start()}
                onInput={(e) => setStart(e.currentTarget.value)}
              />
            </label>
            <label {...stylex.attrs(flow.label)}>
              End date
              <TextField
                aria-label="Trip end date"
                type="date"
                value={end()}
                min={start()}
                onInput={(e) => setEnd(e.currentTarget.value)}
              />
            </label>
          </div>
          <Show when={error()}>
            <p role="alert" {...stylex.attrs(flow.error)}>
              {error()}
            </p>
          </Show>
          <Button type="submit" variant="primary" disabled={busy()}>
            Create trip
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

function TripDetail(props: {
  trip: Trip;
  busy: boolean;
  save: (patch: TripPatch, story?: boolean) => Promise<boolean>;
}) {
  const studio = useStudio();
  const [tab, setTab] = createSignal('wiki');
  const [localError, setLocalError] = createSignal('');
  const [name, setName] = createSignal('');
  const [destination, setDestination] = createSignal('');
  const [summary, setSummary] = createSignal('');
  const [start, setStart] = createSignal('');
  const [end, setEnd] = createSignal('');
  const [status, setStatus] = createSignal<Trip['status']>('planning');
  createEffect(() => {
    const t = props.trip;
    setName(t.title);
    setDestination(t.destination);
    setSummary(t.summary);
    setStart(t.startDate);
    setEnd(t.endDate);
    setStatus(t.status);
  });
  const [logTitle, setLogTitle] = createSignal('');
  const [body, setBody] = createSignal('');
  const [date, setDate] = createSignal(today());
  const [kind, setKind] = createSignal<Trip['logs'][number]['kind']>('journal');
  const [lat, setLat] = createSignal('');
  const [lng, setLng] = createSignal('');
  const [editingLog, setEditingLog] = createSignal('');
  const [gear, setGear] = createSignal('');
  const [quantity, setQuantity] = createSignal('1');
  const [grams, setGrams] = createSignal('0');
  const [gearNotes, setGearNotes] = createSignal('');
  const [editingGear, setEditingGear] = createSignal('');
  const [from, setFrom] = createSignal('');
  const [to, setTo] = createSignal('');
  const [undated, setUndated] = createSignal(true);
  const [importKind, setImportKind] = createSignal<TripTrack['kind']>('recorded');
  const [drawing, setDrawing] = createSignal(false);
  const [draft, setDraft] = createSignal<GeoPoint[]>([]);
  const [routeName, setRouteName] = createSignal('');
  const [manualLat, setManualLat] = createSignal('');
  const [manualLng, setManualLng] = createSignal('');
  const totalWeight = createMemo(() =>
    props.trip.gear.reduce((n, g) => n + g.grams * g.quantity, 0),
  );
  const media = createMemo(() => studio.assets.filter((a) => props.trip.mediaIds.includes(a.id)));
  const prompts = createMemo(() => recallPrompts(props.trip));
  async function addLog(e: SubmitEvent) {
    e.preventDefault();
    setLocalError('');
    if ((lat() === '') !== (lng() === '')) {
      setLocalError('Enter both coordinates, or leave both blank.');
      return;
    }
    const log = {
      id: editingLog() || crypto.randomUUID(),
      title: logTitle(),
      body: body(),
      date: date(),
      kind: kind(),
      done: props.trip.logs.find((l) => l.id === editingLog())?.done ?? false,
      ...(lat() !== '' ? { lat: Number(lat()), lng: Number(lng()) } : {}),
    };
    if (
      await props.save({
        logs: editingLog()
          ? props.trip.logs.map((l) => (l.id === editingLog() ? log : l))
          : [...props.trip.logs, log],
      })
    ) {
      setEditingLog('');
      setLogTitle('');
      setBody('');
      setLat('');
      setLng('');
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setLocalError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Use a GPX file under 10 MB.');
      const tracks = parseGPX(await file.text(), importKind());
      await props.save({ tracks: [...props.trip.tracks, ...tracks] });
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  const addPoint = (lat: number, lng: number) => {
    if (drawing() && draft().length < 20000) setDraft([...draft(), { lat, lng, segment: 0 }]);
  };
  async function saveRoute() {
    if (!draft().length) return;
    const route = {
      id: crypto.randomUUID(),
      title: routeName().trim() || 'Planned route',
      kind: 'planned' as const,
      points: draft(),
    };
    if (await props.save({ tracks: [...props.trip.tracks, route] })) {
      setDraft([]);
      setDrawing(false);
      setRouteName('');
    }
  }
  function recall(date: string, question: string, kind: Trip['logs'][number]['kind'] = 'journal') {
    setDate(date);
    setLogTitle(kind === 'challenge' ? 'A challenge to remember' : 'A moment to remember');
    setBody('');
    setKind(kind);
    setTab('journal');
    studio.notify(question);
  }
  return (
    <>
      <div {...stylex.attrs(flow.row)} role="group" aria-label="Trip sections">
        <For
          each={[
            ['wiki', 'Wiki'],
            ['journal', 'Journal & plans'],
            ['gear', 'Gear'],
            ['media', 'Media'],
            ['map', 'Map & GPX'],
            ['recall', 'Recall inbox'],
          ]}
        >
          {([id, label]) => (
            <button
              {...stylex.attrs(flow.tab, tab() === id && flow.active)}
              aria-pressed={tab() === id}
              onClick={() => {
                setTab(id);
                setLocalError('');
              }}
            >
              {label}
              {id === 'recall' && prompts().length ? ` · ${prompts().length}` : ''}
            </button>
          )}
        </For>
      </div>
      <Show when={localError()}>
        <p role="alert" {...stylex.attrs(flow.error)}>
          {localError()}
        </p>
      </Show>
      <div {...stylex.attrs(flow.divider)}>
        <Show when={tab() === 'wiki'}>
          <div {...stylex.attrs(flow.columns)}>
            <aside {...stylex.attrs(flow.list)}>
              <div {...stylex.attrs(flow.card)}>
                <Badge>{props.trip.status}</Badge>
                <h2 {...stylex.attrs(flow.heading)}>Trip readiness</h2>
                <p {...stylex.attrs(flow.muted)}>
                  {props.trip.gear.filter((g) => g.packed).length} of {props.trip.gear.length} gear
                  items packed · {(totalWeight() / 1000).toFixed(2)} kg listed
                </p>
                <p {...stylex.attrs(flow.muted)}>
                  {props.trip.logs.filter((l) => l.kind === 'plan' && !l.done).length} open plans ·{' '}
                  {props.trip.logs.filter((l) => l.kind === 'challenge').length} challenges logged
                </p>
                <p {...stylex.attrs(flow.muted)}>
                  {props.trip.tracks
                    .filter((t) => t.kind === 'recorded')
                    .reduce((n, t) => n + trackDistance(t), 0)
                    .toFixed(2)}{' '}
                  km in imported recordings
                </p>
                <Button
                  onClick={() =>
                    download(`${props.trip.title}.md`, tripWiki(props.trip, studio.assets))
                  }
                >
                  <Download size={14} />
                  Export wiki
                </Button>
              </div>
              <div {...stylex.attrs(flow.card)}>
                <h2 {...stylex.attrs(flow.heading)}>Keep the small details</h2>
                <p {...stylex.attrs(flow.muted)}>
                  What surprised you? Which tool earned its place? What would you change next time?
                </p>
                <Button onClick={() => setTab('recall')}>Open recall inbox</Button>
              </div>
            </aside>
            <section {...stylex.attrs(flow.list)}>
              <Show when={props.trip.summary || props.trip.logs.length || media().length}>
                <article {...stylex.attrs(flow.card, flow.list)}>
                  <div {...stylex.attrs(flow.row)}>
                    <BookOpen size={18} />
                    <h2 {...stylex.attrs(flow.heading)}>Field notes</h2>
                  </div>
                  <Show when={media().find((a) => a.type === 'photo' && a.src)}>
                    {(photo) => (
                      <img src={photo().src} alt={photo().title} {...stylex.attrs(flow.cover)} />
                    )}
                  </Show>
                  <Show when={props.trip.summary}>
                    <p dir="auto" {...stylex.attrs(flow.text)}>
                      {props.trip.summary}
                    </p>
                  </Show>
                  <For
                    each={props.trip.logs
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(-4)}
                  >
                    {(log) => (
                      <section {...stylex.attrs(flow.divider)}>
                        <Badge>{log.kind}</Badge>
                        <h3 {...stylex.attrs(flow.heading)}>
                          {log.date} · {log.title}
                        </h3>
                        <p dir="auto" {...stylex.attrs(flow.text)}>
                          {log.body.length > 400 ? log.body.slice(0, 400) + '…' : log.body}
                        </p>
                      </section>
                    )}
                  </For>
                  <Show when={props.trip.logs.length}>
                    <Button onClick={() => setTab('journal')}>Open full timeline</Button>
                  </Show>
                </article>
              </Show>
              <form
                {...stylex.attrs(flow.card, flow.form)}
                onSubmit={(e) => {
                  e.preventDefault();
                  void props.save({
                    title: name(),
                    destination: destination(),
                    summary: summary(),
                    startDate: start(),
                    endDate: end(),
                    status: status(),
                  });
                }}
              >
                <h2 {...stylex.attrs(flow.heading)}>The living wiki</h2>
                <label {...stylex.attrs(flow.label)}>
                  Title
                  <TextField
                    aria-label="Wiki title"
                    value={name()}
                    required
                    maxLength={200}
                    onInput={(e) => setName(e.currentTarget.value)}
                  />
                </label>
                <label {...stylex.attrs(flow.label)}>
                  Destination
                  <TextField
                    aria-label="Wiki destination"
                    value={destination()}
                    maxLength={300}
                    onInput={(e) => setDestination(e.currentTarget.value)}
                  />
                </label>
                <div {...stylex.attrs(flow.grid)}>
                  <label {...stylex.attrs(flow.label)}>
                    Start
                    <TextField
                      type="date"
                      aria-label="Wiki start date"
                      value={start()}
                      onInput={(e) => setStart(e.currentTarget.value)}
                    />
                  </label>
                  <label {...stylex.attrs(flow.label)}>
                    End
                    <TextField
                      type="date"
                      aria-label="Wiki end date"
                      min={start()}
                      value={end()}
                      onInput={(e) => setEnd(e.currentTarget.value)}
                    />
                  </label>
                </div>
                <label {...stylex.attrs(flow.label)}>
                  Status
                  <select
                    {...stylex.attrs(flow.select)}
                    aria-label="Trip status"
                    value={status()}
                    onChange={(e) => setStatus(e.currentTarget.value as Trip['status'])}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="finished">Finished</option>
                  </select>
                </label>
                <label {...stylex.attrs(flow.label)}>
                  Overview
                  <Textarea
                    aria-label="Trip overview"
                    rows={5}
                    value={summary()}
                    maxLength={10000}
                    onInput={(e) => setSummary(e.currentTarget.value)}
                  />
                </label>
                <Button type="submit" disabled={props.busy} variant="primary">
                  Save wiki
                </Button>
              </form>
              <section {...stylex.attrs(flow.card)}>
                <h2 {...stylex.attrs(flow.heading)}>Travelogue</h2>
                <p {...stylex.attrs(flow.muted)}>
                  Generate a draft from your saved overview, logs and gear notes. This text is sent
                  to Liara only when you choose Generate. Plans are labeled separately; originals
                  and coordinates are excluded.
                </p>
                <Button
                  disabled={props.busy || !props.trip.logs.some((l) => l.kind !== 'plan')}
                  onClick={() => void props.save({}, true)}
                >
                  <Sparkles size={14} />
                  {props.busy ? 'Working…' : 'Generate travelogue'}
                </Button>
                <Show when={props.trip.story}>
                  {(story) => (
                    <>
                      <Badge>AI DRAFT</Badge>
                      <Show when={props.trip.revision > story().sourceRevision + 1}>
                        <p {...stylex.attrs(flow.muted)}>
                          Notes changed after this draft. Generate again to include updates.
                        </p>
                      </Show>
                      <p dir="auto" {...stylex.attrs(flow.text)}>
                        {story().text}
                      </p>
                    </>
                  )}
                </Show>
              </section>
            </section>
          </div>
        </Show>
        <Show when={tab() === 'journal'}>
          <div {...stylex.attrs(flow.columns)}>
            <form {...stylex.attrs(flow.card, flow.form)} onSubmit={(e) => void addLog(e)}>
              <h2 {...stylex.attrs(flow.heading)}>Capture a detail</h2>
              <label {...stylex.attrs(flow.label)}>
                Date
                <TextField
                  aria-label="Log date"
                  type="date"
                  required
                  value={date()}
                  onInput={(e) => setDate(e.currentTarget.value)}
                />
              </label>
              <label {...stylex.attrs(flow.label)}>
                Entry type
                <select
                  {...stylex.attrs(flow.select)}
                  aria-label="Entry type"
                  value={kind()}
                  onChange={(e) =>
                    setKind(e.currentTarget.value as typeof kind extends () => infer T ? T : never)
                  }
                >
                  <option value="journal">Journal</option>
                  <option value="challenge">Challenge</option>
                  <option value="lesson">Lesson learned</option>
                  <option value="plan">Plan / checklist</option>
                </select>
              </label>
              <label {...stylex.attrs(flow.label)}>
                Title
                <TextField
                  aria-label="Log title"
                  value={logTitle()}
                  required
                  maxLength={200}
                  onInput={(e) => setLogTitle(e.currentTarget.value)}
                />
              </label>
              <label {...stylex.attrs(flow.label)}>
                What happened / what is planned?
                <Textarea
                  aria-label="Log details"
                  value={body()}
                  required
                  rows={5}
                  maxLength={10000}
                  onInput={(e) => setBody(e.currentTarget.value)}
                />
              </label>
              <div {...stylex.attrs(flow.grid)}>
                <label {...stylex.attrs(flow.label)}>
                  Latitude (optional)
                  <TextField
                    aria-label="Log latitude"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={lat()}
                    onInput={(e) => setLat(e.currentTarget.value)}
                  />
                </label>
                <label {...stylex.attrs(flow.label)}>
                  Longitude (optional)
                  <TextField
                    aria-label="Log longitude"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={lng()}
                    onInput={(e) => setLng(e.currentTarget.value)}
                  />
                </label>
              </div>
              <Button type="submit" disabled={props.busy} variant="primary">
                Save entry
              </Button>
            </form>
            <section {...stylex.attrs(flow.list)} aria-label="Trip timeline">
              <h2 {...stylex.attrs(flow.heading)}>Timeline</h2>
              <Show
                when={props.trip.logs.length}
                fallback={
                  <p {...stylex.attrs(flow.muted)}>
                    Your first entry can be one sentence. What is worth remembering?
                  </p>
                }
              >
                <For each={props.trip.logs.slice().sort((a, b) => b.date.localeCompare(a.date))}>
                  {(log) => (
                    <article {...stylex.attrs(flow.card)}>
                      <Badge>
                        {log.kind === 'plan' ? (log.done ? 'Plan · done' : 'Planned') : log.kind}
                      </Badge>
                      <h3 {...stylex.attrs(flow.heading)}>{log.title}</h3>
                      <p {...stylex.attrs(flow.muted)}>
                        {log.date}
                        {log.lat !== undefined
                          ? ` · ${log.lat.toFixed(4)}, ${log.lng!.toFixed(4)}`
                          : ''}
                      </p>
                      <p dir="auto" {...stylex.attrs(flow.text)}>
                        {log.body}
                      </p>
                      <Button
                        disabled={props.busy}
                        onClick={() => {
                          setEditingLog(log.id);
                          setLogTitle(log.title);
                          setBody(log.body);
                          setDate(log.date);
                          setKind(log.kind);
                          setLat(log.lat === undefined ? '' : String(log.lat));
                          setLng(log.lng === undefined ? '' : String(log.lng));
                        }}
                      >
                        Edit entry
                      </Button>
                      <Show when={log.kind === 'plan' || log.kind === 'challenge'}>
                        <label {...stylex.attrs(flow.check)}>
                          <input
                            type="checkbox"
                            checked={log.done}
                            disabled={props.busy}
                            onChange={(e) =>
                              void props.save({
                                logs: props.trip.logs.map((l) =>
                                  l.id === log.id ? { ...l, done: e.currentTarget.checked } : l,
                                ),
                              })
                            }
                          />
                          {log.kind === 'challenge' ? 'Resolved' : 'Completed'}
                        </label>
                      </Show>
                    </article>
                  )}
                </For>
              </Show>
            </section>
          </div>
        </Show>
        <Show when={tab() === 'gear'}>
          <div {...stylex.attrs(flow.columns)}>
            <form
              {...stylex.attrs(flow.card, flow.form)}
              onSubmit={(e) => {
                e.preventDefault();
                void props
                  .save({
                    gear: [
                      ...props.trip.gear.filter((g) => g.id !== editingGear()),
                      {
                        id: editingGear() || crypto.randomUUID(),
                        name: gear(),
                        quantity: Number(quantity()),
                        grams: Number(grams()),
                        packed:
                          props.trip.gear.find((g) => g.id === editingGear())?.packed ?? false,
                        notes: gearNotes(),
                      },
                    ],
                  })
                  .then((ok) => {
                    if (ok) {
                      setGear('');
                      setGearNotes('');
                      setEditingGear('');
                    }
                  });
              }}
            >
              <h2 {...stylex.attrs(flow.heading)}>Your kit</h2>
              <label {...stylex.attrs(flow.label)}>
                Item / tool
                <TextField
                  aria-label="Gear name"
                  value={gear()}
                  required
                  maxLength={200}
                  onInput={(e) => setGear(e.currentTarget.value)}
                />
              </label>
              <label {...stylex.attrs(flow.label)}>
                Quantity
                <TextField
                  aria-label="Gear quantity"
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={quantity()}
                  onInput={(e) => setQuantity(e.currentTarget.value)}
                />
              </label>
              <label {...stylex.attrs(flow.label)}>
                Weight per item (grams)
                <TextField
                  aria-label="Gear weight"
                  type="number"
                  min={0}
                  max={100000}
                  required
                  value={grams()}
                  onInput={(e) => setGrams(e.currentTarget.value)}
                />
              </label>
              <label {...stylex.attrs(flow.label)}>
                Notes / how it helped
                <Textarea
                  aria-label="Gear notes"
                  value={gearNotes()}
                  maxLength={1000}
                  onInput={(e) => setGearNotes(e.currentTarget.value)}
                />
              </label>
              <Button type="submit" disabled={props.busy}>
                {editingGear() ? 'Save gear' : 'Add gear'}
              </Button>
            </form>
            <section {...stylex.attrs(flow.list)}>
              <h2 {...stylex.attrs(flow.heading)}>
                Packing list · {(totalWeight() / 1000).toFixed(2)} kg
              </h2>
              <For each={props.trip.gear}>
                {(g) => (
                  <article {...stylex.attrs(flow.card)}>
                    <label {...stylex.attrs(flow.check)}>
                      <input
                        type="checkbox"
                        checked={g.packed}
                        disabled={props.busy}
                        onChange={(e) =>
                          void props.save({
                            gear: props.trip.gear.map((item) =>
                              item.id === g.id
                                ? { ...item, packed: e.currentTarget.checked }
                                : item,
                            ),
                          })
                        }
                      />
                      <strong>
                        {g.name} × {g.quantity}
                      </strong>
                    </label>
                    <p {...stylex.attrs(flow.muted)}>
                      {g.grams * g.quantity} g · {g.notes}
                    </p>
                    <Button
                      disabled={props.busy}
                      onClick={() => {
                        setEditingGear(g.id);
                        setGear(g.name);
                        setQuantity(String(g.quantity));
                        setGrams(String(g.grams));
                        setGearNotes(g.notes);
                      }}
                    >
                      Edit gear
                    </Button>
                  </article>
                )}
              </For>
              <Show when={!props.trip.gear.length}>
                <p {...stylex.attrs(flow.muted)}>
                  Start with the essentials: sleep, shelter, water, navigation, repair and your
                  camera kit.
                </p>
              </Show>
            </section>
          </div>
        </Show>
        <Show when={tab() === 'media'}>
          <section {...stylex.attrs(flow.card)}>
            <h2 {...stylex.attrs(flow.heading)}>Moments in this trip</h2>
            <p {...stylex.attrs(flow.muted)}>
              Choose media explicitly. Files with dates inside the trip are marked as possible
              matches; dates alone do not prove a connection.
            </p>
            <div {...stylex.attrs(flow.grid)}>
              <For each={studio.assets}>
                {(a) => (
                  <label {...stylex.attrs(flow.card, flow.check)}>
                    <input
                      type="checkbox"
                      checked={props.trip.mediaIds.includes(a.id)}
                      disabled={props.busy || !a.serverId}
                      onChange={(e) =>
                        void props.save({
                          mediaIds: e.currentTarget.checked
                            ? [...props.trip.mediaIds, a.id]
                            : props.trip.mediaIds.filter((id) => id !== a.id),
                        })
                      }
                    />
                    <Show when={a.src}>
                      <img src={a.src} alt="" {...stylex.attrs(flow.thumb)} />
                    </Show>
                    <span>
                      {a.title}
                      <small>
                        {!a.serverId
                          ? ' · Upload first'
                          : props.trip.startDate &&
                              a.date >= props.trip.startDate &&
                              (!props.trip.endDate || a.date <= props.trip.endDate)
                            ? ' · Date match'
                            : ''}
                      </small>
                    </span>
                  </label>
                )}
              </For>
            </div>
            <Show when={!studio.assets.length}>
              <p {...stylex.attrs(flow.muted)}>Import media into the library first.</p>
            </Show>
          </section>
        </Show>
        <Show when={tab() === 'recall'}>
          <section {...stylex.attrs(flow.list)}>
            <h2 {...stylex.attrs(flow.heading)}>A few questions for future you</h2>
            <p {...stylex.attrs(flow.muted)}>
              These prompts come from trip dates and recorded GPX days that have no journal entry.
              They stay here for your next visit; no notifications are scheduled.
            </p>
            <For each={prompts()}>
              {(p) => (
                <article {...stylex.attrs(flow.card)}>
                  <p {...stylex.attrs(flow.text)}>{p.question}</p>
                  <Button onClick={() => recall(p.date, p.question)}>Log this day</Button>
                </article>
              )}
            </For>
            <article {...stylex.attrs(flow.card)}>
              <h3 {...stylex.attrs(flow.heading)}>What was harder than expected?</h3>
              <p {...stylex.attrs(flow.muted)}>
                The obstacle, what you tried, what helped, and what you would do differently.
              </p>
              <Button
                onClick={() =>
                  recall(
                    props.trip.endDate || today(),
                    'What was harder than expected?',
                    'challenge',
                  )
                }
              >
                Log a challenge
              </Button>
            </article>
            <article {...stylex.attrs(flow.card)}>
              <h3 {...stylex.attrs(flow.heading)}>Which tools earned their place?</h3>
              <Button onClick={() => setTab('gear')}>Review your kit</Button>
            </article>
            <Show when={!media().length}>
              <article {...stylex.attrs(flow.card)}>
                <h3 {...stylex.attrs(flow.heading)}>Which photos tell the story?</h3>
                <Button onClick={() => setTab('media')}>Connect your media</Button>
              </article>
            </Show>
          </section>
        </Show>
        <Show when={tab() === 'map'}>
          <section {...stylex.attrs(flow.list)}>
            <div {...stylex.attrs(flow.card, flow.form)}>
              <div {...stylex.attrs(flow.row)}>
                <label {...stylex.attrs(flow.label)}>
                  From (UTC)
                  <TextField
                    aria-label="Map from date"
                    type="date"
                    value={from()}
                    onInput={(e) => {
                      setFrom(e.currentTarget.value);
                      setUndated(false);
                    }}
                  />
                </label>
                <label {...stylex.attrs(flow.label)}>
                  To (UTC)
                  <TextField
                    aria-label="Map to date"
                    type="date"
                    value={to()}
                    onInput={(e) => {
                      setTo(e.currentTarget.value);
                      setUndated(false);
                    }}
                  />
                </label>
                <label {...stylex.attrs(flow.check)}>
                  <input
                    type="checkbox"
                    checked={undated()}
                    onChange={(e) => setUndated(e.currentTarget.checked)}
                  />
                  Include undated points
                </label>
                <Button
                  onClick={() => {
                    setFrom('');
                    setTo('');
                    setUndated(true);
                  }}
                >
                  All dates
                </Button>
              </div>
              <TripMap
                tracks={props.trip.tracks}
                logs={props.trip.logs}
                from={from()}
                to={to()}
                undated={undated()}
                draft={draft()}
                onPoint={addPoint}
              />
            </div>
            <div {...stylex.attrs(flow.grid)}>
              <section {...stylex.attrs(flow.card, flow.form)}>
                <h2 {...stylex.attrs(flow.heading)}>Bring your GPX</h2>
                <label {...stylex.attrs(flow.label)}>
                  Import as
                  <select
                    {...stylex.attrs(flow.select)}
                    aria-label="GPX type"
                    value={importKind()}
                    onChange={(e) => setImportKind(e.currentTarget.value as TripTrack['kind'])}
                  >
                    <option value="recorded">Recorded trip</option>
                    <option value="planned">Planned route</option>
                  </select>
                </label>
                <label {...stylex.attrs(flow.label)}>
                  GPX file
                  <input
                    aria-label="Import GPX"
                    type="file"
                    accept=".gpx,application/gpx+xml"
                    disabled={props.busy}
                    onChange={(e) => {
                      void importFile(e.currentTarget.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                <p {...stylex.attrs(flow.muted)}>
                  Track segments, timestamps and elevation are preserved. Original GPX files are
                  read locally; only parsed coordinates are saved. Up to 20,000 points per import.
                </p>
              </section>
              <section {...stylex.attrs(flow.card, flow.form)}>
                <h2 {...stylex.attrs(flow.heading)}>Sketch the next route</h2>
                <p {...stylex.attrs(flow.muted)}>
                  Click the map to add waypoints, or enter coordinates. Lines connect points
                  directly; this is not turn-by-turn routing or a terrain/safety assessment.
                </p>
                <Button onClick={() => setDrawing(!drawing())}>
                  {drawing() ? 'Stop adding points' : 'Draw planned route'}
                </Button>
                <TextField
                  aria-label="Route name"
                  placeholder="Route name"
                  value={routeName()}
                  maxLength={200}
                  onInput={(e) => setRouteName(e.currentTarget.value)}
                />
                <form
                  {...stylex.attrs(flow.form)}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDraft([
                      ...draft(),
                      { lat: Number(manualLat()), lng: Number(manualLng()), segment: 0 },
                    ]);
                    setManualLat('');
                    setManualLng('');
                  }}
                >
                  <div {...stylex.attrs(flow.grid)}>
                    <TextField
                      aria-label="Waypoint latitude"
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      required
                      placeholder="Latitude"
                      value={manualLat()}
                      onInput={(e) => setManualLat(e.currentTarget.value)}
                    />
                    <TextField
                      aria-label="Waypoint longitude"
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      required
                      placeholder="Longitude"
                      value={manualLng()}
                      onInput={(e) => setManualLng(e.currentTarget.value)}
                    />
                  </div>
                  <Button type="submit" disabled={draft().length >= 20000}>
                    Add waypoint
                  </Button>
                </form>
                <div {...stylex.attrs(flow.row)}>
                  <span {...stylex.attrs(flow.muted)}>{draft().length} waypoints</span>
                  <Button disabled={!draft().length} onClick={() => setDraft(draft().slice(0, -1))}>
                    Undo point
                  </Button>
                  <Button
                    variant="primary"
                    disabled={props.busy || draft().length < 2}
                    onClick={() => void saveRoute()}
                  >
                    Save planned route
                  </Button>
                </div>
              </section>
            </div>
            <For each={props.trip.tracks}>
              {(track) => (
                <article {...stylex.attrs(flow.card, flow.row)}>
                  <div>
                    <Badge>{track.kind}</Badge>
                    <h3>{track.title}</h3>
                    <p {...stylex.attrs(flow.muted)}>
                      {track.points.length} points · {trackDistance(track).toFixed(2)} km ·{' '}
                      {track.points.filter((p) => !p.time).length} undated
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      download(
                        `${track.title}-${track.kind}.gpx`,
                        exportGPX(track),
                        'application/gpx+xml;charset=utf-8',
                      )
                    }
                  >
                    <Download size={14} />
                    Export GPX
                  </Button>
                </article>
              )}
            </For>
          </section>
        </Show>
      </div>
    </>
  );
}

export function TravelMapPage() {
  const [trips, { refetch }] = createResource(() =>
    api<{ data: Trip[] }>('/v1/trips').then((r) => r.data),
  );
  const [from, setFrom] = createSignal('');
  const [to, setTo] = createSignal('');
  const [undated, setUndated] = createSignal(true);
  const [plans, setPlans] = createSignal(false);
  return (
    <div {...stylex.attrs(flow.page)}>
      <header {...stylex.attrs(flow.header)}>
        <div>
          <div {...stylex.attrs(flow.eyebrow)}>THE PLACES THAT STAY WITH YOU</div>
          <h1 {...stylex.attrs(flow.title)}>Your travel atlas</h1>
          <p {...stylex.attrs(flow.muted)}>
            Recorded routes and logged places across all your trips, by date.
          </p>
        </div>
        <Button onClick={() => void refetch()}>Refresh map</Button>
      </header>
      <Show when={trips.error}>
        <p role="alert" {...stylex.attrs(flow.error)}>
          Trips could not be loaded. Retry to open the atlas.
        </p>
      </Show>
      <section {...stylex.attrs(flow.card, flow.form)}>
        <div {...stylex.attrs(flow.row)}>
          <label {...stylex.attrs(flow.label)}>
            From
            <TextField
              aria-label="Atlas from date"
              type="date"
              value={from()}
              onInput={(e) => {
                setFrom(e.currentTarget.value);
                setUndated(false);
              }}
            />
          </label>
          <label {...stylex.attrs(flow.label)}>
            To
            <TextField
              aria-label="Atlas to date"
              type="date"
              value={to()}
              onInput={(e) => {
                setTo(e.currentTarget.value);
                setUndated(false);
              }}
            />
          </label>
          <label {...stylex.attrs(flow.check)}>
            <input
              type="checkbox"
              checked={undated()}
              onChange={(e) => setUndated(e.currentTarget.checked)}
            />
            Include undated points
          </label>
          <label {...stylex.attrs(flow.check)}>
            <input
              type="checkbox"
              checked={plans()}
              onChange={(e) => setPlans(e.currentTarget.checked)}
            />
            Show plans too
          </label>
          <Button
            onClick={() => {
              setFrom('');
              setTo('');
              setUndated(true);
            }}
          >
            All dates
          </Button>
        </div>
        <TripMap
          tracks={(trips() ?? []).flatMap((t) =>
            t.tracks.filter((r) => plans() || r.kind === 'recorded'),
          )}
          logs={(trips() ?? []).flatMap((t) => t.logs.filter((l) => plans() || l.kind !== 'plan'))}
          from={from()}
          to={to()}
          undated={undated()}
        />
        <Show
          when={
            !(trips() ?? []).some((t) => t.tracks.length || t.logs.some((l) => l.lat !== undefined))
          }
        >
          <p {...stylex.attrs(flow.muted)}>
            No locations yet. Open a trip to import GPX or add coordinates to a journal entry.
            Locations are never guessed from place names.
          </p>
        </Show>
        <For each={trips() ?? []}>
          {(trip) => (
            <a href={`/adventures/${trip.id}`}>
              {trip.title} · {trip.startDate || 'Dates unknown'} · {trip.tracks.length} tracks
            </a>
          )}
        </For>
      </section>
    </div>
  );
}
