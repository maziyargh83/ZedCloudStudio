import { Show, createResource, createSignal, onCleanup } from 'solid-js';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, ShieldCheck } from 'lucide-solid';
import { Badge, Button, Textarea } from '@z-cloud/ui';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import { api } from '../api';

export function AIWorkspace() {
  const [status, { refetch }] = createResource(() =>
    api<{ configured: boolean; model: string | null }>('/v1/ai/status'),
  );
  const [prompt, setPrompt] = createSignal('');
  const [answer, setAnswer] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  let controller: AbortController | undefined;
  onCleanup(() => controller?.abort());
  async function generate() {
    if (busy() || !prompt().trim()) return;
    controller = new AbortController();
    setBusy(true);
    setAnswer('');
    setError('');
    try {
      const result = await api<{ text: string }>('/v1/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt().trim() }),
        signal: controller.signal,
      });
      setAnswer(result.text);
    } catch (e) {
      setError(controller.signal.aborted ? 'Generation cancelled.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section {...stylex.attrs(styles.panel)} aria-label="AI workspace">
      <Sparkles size={30} {...stylex.attrs(styles.icon)} />
      <Badge>
        {status.loading
          ? 'CHECKING LIARA'
          : status()?.configured
            ? 'LIARA CONFIGURED'
            : 'PROVIDER NOT CONNECTED'}
      </Badge>
      <h2 {...stylex.attrs(styles.heading)}>
        Your stories.
        <br />A fresh perspective.
      </h2>
      <p {...stylex.attrs(styles.copy)}>
        Shape a caption, explore an idea, or draft a story. Each request starts fresh; replies stay
        here until you leave this page.
      </p>
      <Show when={status.error}>
        <p role="alert">The AI service could not be reached.</p>
        <Button onClick={() => void refetch()}>Check connection</Button>
      </Show>
      <Show when={!status.loading && !status.error && !status()?.configured}>
        <p {...stylex.attrs(styles.copy)}>Configure Liara on the server to start generating.</p>
      </Show>
      <form
        {...stylex.attrs(styles.form)}
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <Textarea
          aria-label="AI prompt"
          maxLength={8000}
          rows={5}
          value={prompt()}
          disabled={busy()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Ask about a moment, a place, or an idea…"
        />
        <div {...stylex.attrs(styles.controls)}>
          <span {...stylex.attrs(styles.copy)}>{status()?.model ?? 'Liara'}</span>
          <Show
            when={busy()}
            fallback={
              <Button
                type="submit"
                variant="primary"
                disabled={!status()?.configured || !prompt().trim()}
              >
                Generate
              </Button>
            }
          >
            <span role="status">Generating…</span>
            <Button type="button" onClick={() => controller?.abort()}>
              Cancel
            </Button>
          </Show>
        </div>
      </form>
      <p {...stylex.attrs(styles.privacy)}>
        <ShieldCheck size={14} />
        Only the text you submit goes to Liara. Media files and library metadata are not included.
      </p>
      <Show when={error()}>
        <p role="alert" {...stylex.attrs(styles.copy)}>
          {error()}
        </p>
      </Show>
      <Show when={answer()}>
        <section aria-label="AI response" {...stylex.attrs(styles.answer)}>
          <Badge>AI GENERATED · LIARA</Badge>
          <p dir="auto" {...stylex.attrs(styles.text)}>
            {answer()}
          </p>
        </section>
      </Show>
    </section>
  );
}

const styles = stylex.create({
  panel: {
    maxWidth: 640,
    width: '100%',
    margin: '32px auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 16,
    minWidth: 0,
  },
  icon: { color: colors.accent },
  heading: { fontSize: 32, lineHeight: 1.2, fontWeight: 500, color: colors.text },
  copy: { fontSize: 12, lineHeight: 1.7, color: colors.secondary },
  form: {
    width: '100%',
    minWidth: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  privacy: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    lineHeight: 1.7,
    color: colors.secondary,
  },
  answer: {
    width: '100%',
    minWidth: 0,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    textAlign: 'start',
  },
  text: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontSize: 14,
    lineHeight: 1.9,
    color: colors.text,
    marginTop: 12,
  },
});
