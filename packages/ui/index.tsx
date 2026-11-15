import { For, Show, splitProps, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Dialog as ArkDialog } from '@ark-ui/solid/dialog';
import { Tabs as ArkTabs } from '@ark-ui/solid/tabs';
import { Menu as ArkMenu } from '@ark-ui/solid/menu';
import { Tooltip as ArkTooltip } from '@ark-ui/solid/tooltip';
import { X, ChevronDown } from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '../design-tokens/colors.stylex';

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};
export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'children']);
  return (
    <button
      {...stylex.attrs(ui.button, ui[local.variant ?? 'secondary'], ui[local.size ?? 'md'])}
      {...rest}
    >
      {local.children}
    </button>
  );
}
export function IconButton(props: ButtonProps & { label: string; active?: boolean }) {
  const [local, rest] = splitProps(props, ['label', 'active', 'children', 'variant', 'size']);
  return (
    <button
      type="button"
      {...stylex.attrs(ui.button, ui.icon, ui.ghost, local.active && ui.active)}
      aria-label={local.label}
      title={local.label}
      {...rest}
    >
      {local.children}
    </button>
  );
}
export function Badge(props: {
  children: JSX.Element;
  tone?: 'neutral' | 'accent' | 'success' | 'info';
}) {
  return (
    <span
      {...stylex.attrs(
        ui.badge,
        props.tone === 'accent' && ui.accentBadge,
        props.tone === 'success' && ui.successBadge,
        props.tone === 'info' && ui.infoBadge,
      )}
    >
      {props.children}
    </span>
  );
}
export function TextField(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...stylex.attrs(ui.input)} {...props} />;
}
export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...stylex.attrs(ui.input, ui.textarea)} {...props} />;
}
export function Surface(props: { children: JSX.Element }) {
  return <section {...stylex.attrs(ui.surface)}>{props.children}</section>;
}
export function Dialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: JSX.Element;
  wide?: boolean;
}) {
  return (
    <ArkDialog.Root
      open={props.open}
      onOpenChange={(e) => props.onOpenChange(e.open)}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <ArkDialog.Backdrop {...stylex.attrs(ui.backdrop)} />
        <ArkDialog.Positioner {...stylex.attrs(ui.positioner)}>
          <ArkDialog.Content {...stylex.attrs(ui.dialog, props.wide && ui.dialogWide)}>
            <div {...stylex.attrs(ui.dialogHeading)}>
              <ArkDialog.Title {...stylex.attrs(ui.dialogTitle)}>{props.title}</ArkDialog.Title>
              <ArkDialog.CloseTrigger
                {...stylex.attrs(ui.button, ui.icon, ui.ghost)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </ArkDialog.CloseTrigger>
            </div>
            <Show when={props.description}>
              <ArkDialog.Description {...stylex.attrs(ui.description)}>
                {props.description}
              </ArkDialog.Description>
            </Show>
            {props.children}
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
export function Tabs(props: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  label: string;
  children?: JSX.Element;
}) {
  return (
    <ArkTabs.Root
      value={props.value}
      onValueChange={(e) => props.onChange(e.value)}
      {...stylex.attrs(ui.tabsRoot)}
    >
      <ArkTabs.List aria-label={props.label} {...stylex.attrs(ui.tabList)}>
        <For each={props.items}>
          {(item) => (
            <ArkTabs.Trigger
              value={item.value}
              {...stylex.attrs(ui.tab, props.value === item.value && ui.selectedTab)}
            >
              {item.label}
            </ArkTabs.Trigger>
          )}
        </For>
      </ArkTabs.List>
      <ArkTabs.Content value={props.value} {...stylex.attrs(ui.tabContent)}>
        {props.children}
      </ArkTabs.Content>
    </ArkTabs.Root>
  );
}
export function Dropdown(props: {
  label: string;
  icon?: JSX.Element;
  items: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <ArkMenu.Root onSelect={(e) => props.onSelect(e.value)}>
      <ArkMenu.Trigger {...stylex.attrs(ui.button, ui.secondary, ui.md)}>
        {props.icon}
        {props.label}
        <ChevronDown size={12} />
      </ArkMenu.Trigger>
      <Portal>
        <ArkMenu.Positioner>
          <ArkMenu.Content {...stylex.attrs(ui.menu)}>
            <For each={props.items}>
              {(item) => (
                <ArkMenu.Item {...stylex.attrs(ui.menuItem)} value={item.value}>
                  {item.label}
                </ArkMenu.Item>
              )}
            </For>
          </ArkMenu.Content>
        </ArkMenu.Positioner>
      </Portal>
    </ArkMenu.Root>
  );
}
export function Tooltip(props: { label: string; children: JSX.Element }) {
  return (
    <ArkTooltip.Root openDelay={400}>
      <ArkTooltip.Trigger {...stylex.attrs(ui.tooltipTrigger)}>{props.children}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content {...stylex.attrs(ui.tooltip)}>{props.label}</ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
}
export function EmptyState(props: {
  icon: JSX.Element;
  title: string;
  description: string;
  action?: JSX.Element;
}) {
  return (
    <div {...stylex.attrs(ui.empty)}>
      <div {...stylex.attrs(ui.emptyIcon)}>{props.icon}</div>
      <h2 {...stylex.attrs(ui.dialogTitle)}>{props.title}</h2>
      <p {...stylex.attrs(ui.description)}>{props.description}</p>
      {props.action}
    </div>
  );
}

export const ui = stylex.create({
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    fontWeight: 500,
    fontSize: 12,
    whiteSpace: 'nowrap',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: '120ms',
    ':disabled': { opacity: 0.45 },
    ':focus-visible': { outlineColor: colors.accent },
  },
  primary: {
    backgroundColor: { default: colors.accent, ':hover': colors.accentHover },
    color: colors.accentText,
    borderColor: colors.accent,
  },
  secondary: {
    backgroundColor: { default: colors.surface, ':hover': colors.surfaceAlt },
    borderColor: colors.border,
    color: colors.secondary,
  },
  ghost: {
    backgroundColor: { default: 'transparent', ':hover': colors.surfaceAlt },
    color: { default: colors.muted, ':hover': colors.text },
    borderColor: 'transparent',
  },
  danger: { backgroundColor: colors.surface, color: colors.danger, borderColor: colors.border },
  active: { color: colors.text, backgroundColor: colors.surfaceAlt },
  sm: { height: 28, paddingInline: 10 },
  md: { height: 34, paddingInline: 12 },
  lg: { height: 40, paddingInline: 16 },
  icon: { width: 32, height: 32, padding: 0 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    color: colors.secondary,
    fontSize: 10,
    lineHeight: '18px',
    fontWeight: 500,
    paddingInline: 6,
    whiteSpace: 'nowrap',
  },
  accentBadge: { backgroundColor: colors.accentSubtle, color: colors.accent },
  successBadge: { color: colors.success },
  infoBadge: { color: colors.info },
  input: {
    width: '100%',
    minWidth: 0,
    backgroundColor: colors.canvas,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    paddingInline: 10,
    paddingBlock: 8,
    fontSize: 12,
    lineHeight: '18px',
    ':focus': { borderColor: colors.accent, outline: 'none' },
    '::placeholder': { color: colors.muted },
  },
  textarea: { resize: 'vertical', minHeight: 88 },
  surface: {
    padding: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  backdrop: { position: 'fixed', inset: 0, backgroundColor: colors.overlay, zIndex: 80 },
  positioner: {
    position: 'fixed',
    inset: 0,
    zIndex: 81,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'auto',
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90dvh',
    overflowY: 'auto',
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
  },
  dialogWide: { maxWidth: 960 },
  dialogHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: 600, letterSpacing: '-0.4px' },
  description: { fontSize: 13, color: colors.secondary, lineHeight: '21px', marginBottom: 16 },
  tabList: {
    display: 'flex',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderColor: colors.border,
    gap: 20,
    paddingInline: 20,
    overflowX: 'auto',
  },
  tab: {
    height: 44,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    backgroundColor: 'transparent',
    color: { default: colors.muted, ':hover': colors.text },
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  selectedTab: { borderBottomColor: colors.accent, color: colors.text },
  tabsRoot: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  tabContent: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  menu: {
    zIndex: 100,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    padding: 4,
    minWidth: 160,
    boxShadow: '0 8px 32px rgba(0,0,0,.25)',
  },
  menuItem: {
    paddingInline: 12,
    paddingBlock: 9,
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    backgroundColor: { default: 'transparent', ':is([data-highlighted])': colors.hover },
  },
  tooltipTrigger: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    padding: 0,
    color: colors.secondary,
  },
  tooltip: {
    padding: 8,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6,
    fontSize: 11,
    zIndex: 100,
  },
  empty: {
    minHeight: 320,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    color: colors.accent,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accentSubtle,
  },
});
