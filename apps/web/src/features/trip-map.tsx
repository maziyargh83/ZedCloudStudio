import { createEffect, createSignal, createMemo, onCleanup, onMount, Show } from 'solid-js';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as stylex from '@stylexjs/stylex';
import { colors } from '@z-cloud/design-tokens/colors.stylex';
import type { GeoPoint, TripTrack, Trip } from '@z-cloud/contracts';
import { segments } from '../travel';
import { flow } from './workflow-styles';

export function TripMap(props: {
  tracks: TripTrack[];
  logs?: Trip['logs'];
  from?: string;
  to?: string;
  undated?: boolean;
  draft?: GeoPoint[];
  onPoint?: (lat: number, lng: number) => void;
}) {
  let container!: HTMLDivElement;
  let map: L.Map | undefined;
  let layer: L.LayerGroup;
  const [ready, setReady] = createSignal(false);
  const [offline, setOffline] = createSignal(false);
  const pointCount = createMemo(() =>
    props.tracks.reduce(
      (n, t) =>
        n +
        segments(t.points, props.from, props.to, props.undated ?? true).reduce(
          (s, g) => s + g.length,
          0,
        ),
      0,
    ),
  );
  onMount(() => {
    map = L.map(container, { worldCopyJump: true, scrollWheelZoom: false }).setView([30, 40], 3);
    layer = L.layerGroup().addTo(map);
    L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    )
      .on('tileerror', () => setOffline(true))
      .addTo(map);
    map.on('click', (event) =>
      props.onPoint?.(event.latlng.lat, ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180),
    );
    const observer = new ResizeObserver(() => map?.invalidateSize());
    observer.observe(container);
    setReady(true);
    onCleanup(() => {
      observer.disconnect();
      map?.remove();
      map = undefined;
    });
  });
  createEffect(() => {
    if (!ready() || !map) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    for (const track of props.tracks) {
      for (const group of segments(track.points, props.from, props.to, props.undated ?? true)) {
        const points = group.map((p) => [p.lat, p.lng] as L.LatLngTuple);
        bounds.push(...points);
        const color = track.kind === 'planned' ? colors.info : colors.accent;
        const geometry =
          points.length === 1
            ? L.circleMarker(points[0], { radius: 6, color })
            : L.polyline(points, {
                color,
                weight: 3,
                ...(track.kind === 'planned' ? { dashArray: '7,7' } : {}),
              });
        const label = document.createElement('span');
        label.textContent = `${track.title} · ${track.kind}`;
        geometry.bindTooltip(label).addTo(layer);
      }
    }
    for (const log of props.logs ?? []) {
      if (
        log.lat === undefined ||
        log.lng === undefined ||
        (props.from && log.date < props.from) ||
        (props.to && log.date > props.to)
      )
        continue;
      const point: [number, number] = [log.lat, log.lng];
      bounds.push(point);
      const label = document.createElement('span');
      label.textContent = `${log.date} · ${log.title} (${log.kind === 'plan' ? 'planned' : 'logged'})`;
      L.circleMarker(point, {
        radius: 7,
        color: log.kind === 'plan' ? colors.info : colors.success,
      })
        .bindTooltip(label)
        .addTo(layer);
    }
    if (props.draft?.length) {
      const points = props.draft.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      bounds.push(...points);
      L.polyline(points, { color: colors.info, dashArray: '4,6' }).addTo(layer);
      points.forEach((p) => L.circleMarker(p, { radius: 4, color: colors.info }).addTo(layer));
    }
    if (bounds.length)
      map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 14, animate: false });
  });
  return (
    <>
      <div
        ref={container}
        {...stylex.attrs(flow.map)}
        role="region"
        aria-label="Travel map"
        data-testid="travel-map"
        data-visible-points={pointCount()}
      />
      <Show when={offline()}>
        <p role="status" {...stylex.attrs(flow.muted)}>
          Basemap tiles are unavailable. Your saved coordinates and routes still appear.
        </p>
      </Show>
      <p {...stylex.attrs(flow.muted)}>
        {pointCount()} track points in view. Solid: recorded GPX · dashed: planned route · dots:
        journal/plan locations. Date filters use UTC point timestamps. Basemap tiles load from
        OpenStreetMap; original media stays on your server.
      </p>
    </>
  );
}
