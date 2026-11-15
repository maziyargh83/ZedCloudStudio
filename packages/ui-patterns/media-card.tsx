import { Show, createSignal } from 'solid-js';
import { AudioLines, Video, Image, Check, Heart, Expand } from 'lucide-solid';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
export interface MediaCardAsset {
  id: string;
  title: string;
  src: string;
  type: 'photo' | 'video' | 'audio';
  demo: boolean;
  favorite: boolean;
  location: string;
  filename: string;
}

export function MediaCard(props: {
  asset: MediaCardAsset;
  selected: boolean;
  list?: boolean;
  dateLabel?: string;
  onSelect: (multiple: boolean) => void;
  onPreview: () => void;
  onFavorite: () => void;
}) {
  const [broken, setBroken] = createSignal(false);
  return (
    <article
      data-testid="media-card"
      {...stylex.attrs(card.card, props.selected && card.cardSelected, props.list && card.cardList)}
    >
      <button
        type="button"
        aria-label={`Select ${props.asset.title}`}
        aria-pressed={props.selected}
        {...stylex.attrs(card.cardMain, props.list && card.cardMainList)}
        onClick={(e) => props.onSelect(e.metaKey || e.ctrlKey || e.shiftKey)}
        onDblClick={props.onPreview}
      >
        <div {...stylex.attrs(card.thumbnail, props.list && card.listThumbnail)}>
          <Show
            when={props.asset.type === 'photo' && !broken()}
            fallback={
              <div {...stylex.attrs(card.thumbnailFallback)}>
                {props.asset.type === 'audio' ? (
                  <AudioLines size={30} />
                ) : props.asset.type === 'video' ? (
                  <Video size={30} />
                ) : (
                  <Image size={30} />
                )}
                <span>{broken() ? 'Preview unavailable' : props.asset.type.toUpperCase()}</span>
              </div>
            }
          >
            <img
              src={props.asset.src}
              alt={props.asset.title}
              loading="lazy"
              onError={() => setBroken(true)}
              {...stylex.attrs(card.cardImage)}
            />
          </Show>
          <Show when={props.asset.demo}>
            <span {...stylex.attrs(card.demoLabel)}>DEMO</span>
          </Show>
          <span {...stylex.attrs(card.photoType)}>
            {props.asset.type === 'photo' ? (
              <Image size={11} />
            ) : props.asset.type === 'video' ? (
              <Video size={11} />
            ) : (
              <AudioLines size={11} />
            )}
          </span>
        </div>
        <div {...stylex.attrs(card.cardInfo)}>
          <span {...stylex.attrs(card.cardTitle)}>{props.asset.title}</span>
          <span {...stylex.attrs(card.cardMetadata)}>
            {props.asset.location || props.asset.filename}
          </span>
          <Show when={props.list}>
            <span {...stylex.attrs(card.listDate)}>{props.dateLabel}</span>
          </Show>
        </div>
      </button>
      <button
        type="button"
        aria-label={`${props.selected ? 'Deselect' : 'Add to selection'} ${props.asset.title}`}
        aria-pressed={props.selected}
        {...stylex.attrs(
          card.selectBox,
          props.selected && card.selectBoxChecked,
          props.list && card.listSelect,
        )}
        onClick={() => props.onSelect(true)}
      >
        <Show when={props.selected}>
          <Check size={11} />
        </Show>
      </button>
      <Show when={!props.list}>
        <div {...stylex.attrs(card.cardTools)}>
          <button
            {...stylex.attrs(card.mediaTool, props.asset.favorite && card.favorite)}
            aria-label={`${props.asset.favorite ? 'Unfavorite' : 'Favorite'} ${props.asset.title}`}
            aria-pressed={props.asset.favorite}
            onClick={props.onFavorite}
          >
            <Heart size={12} fill={props.asset.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            {...stylex.attrs(card.mediaTool)}
            aria-label={`Preview ${props.asset.title}`}
            onClick={props.onPreview}
          >
            <Expand size={12} />
          </button>
        </div>
      </Show>
    </article>
  );
}
const card = stylex.create({
  card: {
    position: 'relative',
    borderRadius: 8,
    outline: '1px solid transparent',
    outlineOffset: 3,
    minWidth: 0,
  },
  cardSelected: { outlineColor: colors.accent },
  cardMain: {
    display: 'block',
    width: '100%',
    textAlign: 'start',
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    aspectRatio: '1.48',
    overflow: 'hidden',
    borderRadius: 6,
    position: 'relative',
    backgroundColor: colors.surfaceAlt,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 180ms',
    ':hover': { transform: 'scale(1.025)' },
  },
  thumbnailFallback: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    fontSize: 9,
    color: colors.muted,
  },
  cardInfo: {
    paddingBlockStart: 9,
    paddingInline: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMetadata: {
    fontSize: 9,
    color: colors.muted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  demoLabel: {
    position: 'absolute',
    insetInlineStart: 8,
    bottom: 7,
    backgroundColor: colors.mediaScrim,
    color: colors.mediaText,
    fontSize: 7,
    lineHeight: '14px',
    paddingInline: 4,
    borderRadius: 3,
    letterSpacing: '0.7px',
  },
  photoType: {
    position: 'absolute',
    insetInlineEnd: 8,
    bottom: 8,
    color: colors.mediaText,
    display: 'flex',
  },
  selectBox: {
    width: 16,
    height: 16,
    position: 'absolute',
    insetBlockStart: 8,
    insetInlineStart: 8,
    backgroundColor: colors.mediaScrim,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,.5)',
    borderRadius: 4,
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    color: colors.accentText,
  },
  selectBoxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardTools: {
    position: 'absolute',
    insetBlockStart: 7,
    insetInlineEnd: 7,
    display: 'flex',
    gap: 4,
  },
  mediaTool: {
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: 4,
    width: 22,
    height: 22,
    backgroundColor: colors.mediaScrim,
    color: colors.mediaText,
    display: 'grid',
    placeItems: 'center',
    padding: 0,
  },
  favorite: { color: colors.accent },
  cardList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    padding: 7,
  },
  cardMainList: { display: 'flex', alignItems: 'center', gap: 14, paddingInlineStart: 28 },
  listThumbnail: { width: 64, aspectRatio: '1.48', flexShrink: 0 },
  listSelect: { insetBlockStart: 'calc(50% - 8px)', insetInlineStart: 10 },
  listDate: { fontSize: 9, color: colors.muted },
});
