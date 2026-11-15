import { For, Show, createMemo, createResource, createSignal, createEffect } from 'solid-js';
import * as stylex from '@stylexjs/stylex';
import { Button, Badge, TextField, Textarea, EmptyState } from '@z-cloud/ui';
import { CheckCheck, Sparkles, RefreshCw } from 'lucide-solid';
import type { MediaAsset, ReviewRecord, ReviewField } from '@z-cloud/contracts';
import { reviewLabels } from '@z-cloud/core';
import { api, API_BASE } from '../api';
import { useStudio } from '../state';
import { flow } from './workflow-styles';
type Item = { asset: MediaAsset; review: ReviewRecord };
export function ReviewInbox() {
  const studio = useStudio();
  const [items, { refetch }] = createResource(() =>
    api<{ data: Item[] }>('/v1/reviews').then((r) => r.data),
  );
  const [selected, setSelected] = createSignal('');
  const [filter, setFilter] = createSignal('open');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [values, setValues] = createSignal<Partial<Record<ReviewField, string>>>({});
  const [skipped, setSkipped] = createSignal<ReviewField[]>([]);
  const current = createMemo(() => items()?.find((i) => i.asset.id === selected()));
  const shown = createMemo(() =>
    (items() ?? []).filter(
      (i) =>
        filter() === 'all' ||
        (filter() === 'open'
          ? !['complete', 'later'].includes(i.review.status)
          : i.review.status === filter()),
    ),
  );
  createEffect(() => {
    if (!selected() && shown()[0]) setSelected(shown()[0].asset.id);
  });
  createEffect(() => {
    const i = current();
    if (!i) return;
    const draft = i.review.answers;
    setValues(
      Object.fromEntries(
        i.review.questions.map((q) => {
          const value = draft[q.field] ?? i.asset[q.field];
          return [
            q.field,
            Array.isArray(value)
              ? value.join(', ')
              : q.field === 'capturedAt'
                ? String(value).slice(0, 10)
                : String(value ?? ''),
          ];
        }),
      ),
    );
    setSkipped(i.review.skipped);
  });
  async function action(name: string) {
    const item = current();
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      if (name === 'questions')
        await api(`/v1/reviews/${item.asset.id}/questions`, { method: 'POST', body: '{}' });
      else {
        const answers = Object.fromEntries(
          Object.entries(name === 'save' ? values() : {})
            .filter(([field]) => !skipped().includes(field as ReviewField))
            .map(([field, value]) => [
              field,
              field === 'tags'
                ? value!
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                : field === 'capturedAt'
                  ? value === item.asset.capturedAt.slice(0, 10)
                    ? item.asset.capturedAt
                    : new Date(value! + 'T12:00:00Z').toISOString()
                  : value,
            ]),
        );
        await api(`/v1/reviews/${item.asset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            action: name,
            revision: item.review.revision,
            ...(name === 'save' ? { answers, skipped: skipped() } : {}),
          }),
        });
      }
      await refetch();
      if (name === 'apply') {
        await studio.refreshMedia();
        studio.notify('Metadata updated. Original files are unchanged.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div {...stylex.attrs(flow.page)}>
      <header {...stylex.attrs(flow.header)}>
        <div>
          <div {...stylex.attrs(flow.eyebrow)}>A LITTLE CONTEXT GOES A LONG WAY</div>
          <h1 {...stylex.attrs(flow.title)}>Review inbox</h1>
          <p {...stylex.attrs(flow.muted)}>
            Find missing details. Remember the moment. Keep every answer under your control.
          </p>
        </div>
        <Button onClick={() => void refetch()}>
          <RefreshCw size={14} />
          Scan library
        </Button>
      </header>
      <div {...stylex.attrs(flow.row)}>
        <For
          each={[
            ['open', 'Needs attention'],
            ['later', 'Later'],
            ['complete', 'Reviewed'],
            ['all', 'All items'],
          ]}
        >
          {([id, label]) => (
            <button
              {...stylex.attrs(flow.tab, filter() === id && flow.active)}
              onClick={() => setFilter(id)}
            >
              {label}{' '}
              {id === 'open'
                ? (items() ?? []).filter((i) => !['complete', 'later'].includes(i.review.status))
                    .length
                : ''}
            </button>
          )}
        </For>
      </div>
      <Show when={items.error}>
        <p role="alert" {...stylex.attrs(flow.error)}>
          The review service is unavailable. Your files are safe. Retry the scan.
        </p>
      </Show>
      <Show when={items.loading}>
        <p role="status">Checking metadata…</p>
      </Show>
      <p {...stylex.attrs(flow.muted)}>
        Uploaded and registered media appear here automatically. Files waiting in the import queue
        remain there until upload finishes. Missing information is never guessed.
      </p>
      <Show
        when={shown().length}
        fallback={
          !items.loading && !items.error ? (
            <EmptyState
              icon={<CheckCheck />}
              title="All clear here"
              description="Import your media or switch filters to revisit completed reviews."
            />
          ) : null
        }
      >
        <div {...stylex.attrs(flow.columns)}>
          <aside {...stylex.attrs(flow.list)} aria-label="Items to review">
            <For each={shown()}>
              {(item) => (
                <button
                  {...stylex.attrs(flow.item, selected() === item.asset.id && flow.active)}
                  onClick={() => setSelected(item.asset.id)}
                >
                  <strong>{item.asset.title}</strong>
                  <p {...stylex.attrs(flow.muted)}>{item.asset.filename}</p>
                  <Badge>
                    {item.review.status === 'complete'
                      ? 'Reviewed'
                      : `${item.review.questions.length} details to check`}
                  </Badge>
                </button>
              )}
            </For>
          </aside>
          <Show when={current()}>
            {(item) => (
              <section {...stylex.attrs(flow.card)} aria-label="Metadata review">
                <h2 {...stylex.attrs(flow.heading)}>{item().asset.title}</h2>
                <Show when={item().asset.source === 'upload' && item().asset.type === 'photo'}>
                  <img
                    src={`${API_BASE}/v1/media/${item().asset.id}/content`}
                    alt={item().asset.title}
                    {...stylex.attrs(flow.cover)}
                  />
                </Show>
                <Badge>
                  {item().review.questionSource === 'liara'
                    ? 'Questions by Liara'
                    : item().review.questionSource === 'mixed'
                      ? 'Liara + guided questions'
                      : 'Guided questions'}
                </Badge>
                <p {...stylex.attrs(flow.muted)}>
                  “Ask Liara” sends this item's existing text metadata to Liara to personalize the
                  questions. Originals are not sent.
                </p>
                <Show when={error()}>
                  <p role="alert" {...stylex.attrs(flow.error)}>
                    {error()}
                  </p>
                </Show>
                <Show
                  when={item().review.status !== 'complete'}
                  fallback={
                    <>
                      <p {...stylex.attrs(flow.muted)}>
                        Reviewed {new Date(item().review.updatedAt).toLocaleDateString()}. Skipped
                        details remain unknown.
                      </p>
                      <Button onClick={() => void action('reopen')} disabled={busy()}>
                        Review again
                      </Button>
                    </>
                  }
                >
                  <form
                    {...stylex.attrs(flow.form)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action('save');
                    }}
                  >
                    <For each={item().review.questions}>
                      {(q) => (
                        <div {...stylex.attrs(flow.divider)}>
                          <label {...stylex.attrs(flow.label)}>
                            <strong>{q.question}</strong>
                            <span>{q.hint}</span>
                            <Show
                              when={q.field === 'description'}
                              fallback={
                                <TextField
                                  aria-label={reviewLabels[q.field]}
                                  type={q.field === 'capturedAt' ? 'date' : 'text'}
                                  value={values()[q.field] ?? ''}
                                  disabled={skipped().includes(q.field) || busy()}
                                  required={!skipped().includes(q.field)}
                                  maxLength={
                                    q.field === 'title' ? 200 : q.field === 'location' ? 300 : 4000
                                  }
                                  onInput={(e) =>
                                    setValues({ ...values(), [q.field]: e.currentTarget.value })
                                  }
                                />
                              }
                            >
                              <Textarea
                                aria-label="Description"
                                value={values().description ?? ''}
                                disabled={skipped().includes(q.field) || busy()}
                                required={!skipped().includes(q.field)}
                                maxLength={10000}
                                onInput={(e) =>
                                  setValues({ ...values(), description: e.currentTarget.value })
                                }
                              />
                            </Show>
                          </label>
                          <label {...stylex.attrs(flow.check)}>
                            <input
                              type="checkbox"
                              checked={skipped().includes(q.field)}
                              onChange={(e) =>
                                setSkipped(
                                  e.currentTarget.checked
                                    ? [...skipped(), q.field]
                                    : skipped().filter((f) => f !== q.field),
                                )
                              }
                            />
                            Skip {reviewLabels[q.field]} for now
                          </label>
                        </div>
                      )}
                    </For>
                    <div {...stylex.attrs(flow.row)}>
                      <Button type="submit" variant="primary" disabled={busy()}>
                        Save answers
                      </Button>
                      <Button
                        type="button"
                        disabled={busy()}
                        onClick={() => void action('questions')}
                      >
                        <Sparkles size={14} />
                        Ask Liara
                      </Button>
                      <Button type="button" disabled={busy()} onClick={() => void action('later')}>
                        Later
                      </Button>
                    </div>
                  </form>
                  <Show when={item().review.status === 'draft'}>
                    <div {...stylex.attrs(flow.divider)}>
                      <h3 {...stylex.attrs(flow.heading)}>Review changes</h3>
                      <For each={item().review.questions}>
                        {(q) => (
                          <div {...stylex.attrs(flow.card)}>
                            <strong>{reviewLabels[q.field]}</strong>
                            <p {...stylex.attrs(flow.muted)}>
                              Current: {String(item().asset[q.field]) || 'Empty'}
                            </p>
                            <p {...stylex.attrs(flow.text)}>
                              New:{' '}
                              {item().review.skipped.includes(q.field)
                                ? 'Skipped — keep current value'
                                : String(item().review.answers[q.field] ?? '')}
                            </p>
                          </div>
                        )}
                      </For>
                      <Button
                        variant="primary"
                        disabled={busy()}
                        onClick={() => void action('apply')}
                      >
                        Apply reviewed changes
                      </Button>
                    </div>
                  </Show>
                </Show>
              </section>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
