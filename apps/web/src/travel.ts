import {
  trackSchema,
  gpxTimestampSchema,
  type GeoPoint,
  type TripTrack,
  type Trip,
} from '@z-cloud/contracts';

export function parseGPX(xml: string, kind: TripTrack['kind'] = 'recorded'): TripTrack[] {
  if (xml.length > 10 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('Use a GPX file under 10 MB without document/entity declarations.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'gpx')
    throw new Error('This is not a valid GPX document.');
  const elements = (node: Document | Element, name: string) =>
    Array.from(node.getElementsByTagNameNS('*', name));
  const text = (node: Element, name: string) => elements(node, name)[0]?.textContent?.trim();
  let count = 0;
  function point(el: Element, segment: number): GeoPoint {
    if (++count > 20000)
      throw new Error('This import exceeds 20,000 points. Split it into smaller tracks.');
    const lat = el.getAttribute('lat'),
      lng = el.getAttribute('lon');
    if (!lat?.trim() || !lng?.trim()) throw new Error('A GPX point is missing its coordinates.');
    const time = text(el, 'time'),
      ele = text(el, 'ele');
    if (time && !gpxTimestampSchema.safeParse(time).success)
      throw new Error('A GPX point has an invalid timestamp.');
    return {
      lat: Number(lat),
      lng: Number(lng),
      segment,
      ...(time ? { time: new Date(time).toISOString() } : {}),
      ...(ele ? { elevation: Number(ele) } : {}),
    };
  }
  const result: TripTrack[] = [];
  for (const trk of elements(doc, 'trk')) {
    const segments = elements(trk, 'trkseg');
    const points = segments.flatMap((seg, i) => elements(seg, 'trkpt').map((p) => point(p, i)));
    if (points.length)
      result.push(
        trackSchema.parse({
          id: crypto.randomUUID(),
          title: text(trk, 'name') || 'Imported track',
          kind,
          points,
        }),
      );
  }
  for (const rte of elements(doc, 'rte')) {
    const points = elements(rte, 'rtept').map((p) => point(p, 0));
    if (points.length)
      result.push(
        trackSchema.parse({
          id: crypto.randomUUID(),
          title: text(rte, 'name') || 'Imported route',
          kind,
          points,
        }),
      );
  }
  const waypoints = elements(doc, 'wpt').map((p, i) => point(p, i));
  if (waypoints.length)
    result.push(
      trackSchema.parse({
        id: crypto.randomUUID(),
        title: 'GPX waypoints',
        kind,
        points: waypoints,
      }),
    );
  if (!result.length) throw new Error('No track, route or waypoint coordinates were found.');
  return result;
}
export function segments(points: GeoPoint[], from = '', to = '', undated = true): GeoPoint[][] {
  const groups: GeoPoint[][] = [];
  let current: GeoPoint[] = [];
  let previous: number | undefined;
  for (const p of points) {
    const day = p.time?.slice(0, 10);
    const visible = day ? (!from || day >= from) && (!to || day <= to) : undated;
    if (!visible || (previous !== undefined && previous !== p.segment)) {
      if (current.length) groups.push(current);
      current = [];
    }
    if (visible) current.push(p);
    previous = p.segment;
  }
  if (current.length) groups.push(current);
  return groups;
}
export function trackDistance(track: TripTrack) {
  let km = 0;
  for (const group of segments(track.points))
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1],
        b = group[i],
        rad = Math.PI / 180;
      const dLat = (b.lat - a.lat) * rad,
        dLng = (b.lng - a.lng) * rad;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
      km += 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    }
  return km;
}
const xmlEscape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function exportGPX(track: TripTrack) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Z Cloud" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xmlEscape(track.title)} (${track.kind})</name></metadata><trk><name>${xmlEscape(track.title)}</name><type>${track.kind}</type>${segments(
    track.points,
  )
    .map(
      (group) =>
        `<trkseg>${group.map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}">${p.elevation !== undefined ? `<ele>${p.elevation}</ele>` : ''}${p.time ? `<time>${p.time}</time>` : ''}</trkpt>`).join('')}</trkseg>`,
    )
    .join('')}</trk></gpx>`;
}
export function download(name: string, text: string, mime = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function tripWiki(t: Trip, media: { id: string; title: string }[] = []) {
  return [
    `# ${t.title}`,
    `Destination: ${t.destination || 'Not recorded'}\nDates: ${t.startDate || '?'} → ${t.endDate || '?'}\nStatus: ${t.status}`,
    t.summary,
    '## Timeline',
    ...t.logs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (l) =>
          `### ${l.date} · ${l.title} [${l.kind}${l.kind === 'plan' ? (l.done ? ' · done' : ' · planned') : ''}]\n${l.body}${l.lat !== undefined ? `\nLocation: ${l.lat}, ${l.lng}` : ''}`,
      ),
    '## Gear',
    ...t.gear.map(
      (g) =>
        `- [${g.packed ? 'x' : ' '}] ${g.name} × ${g.quantity} · ${g.grams * g.quantity} g${g.notes ? ` — ${g.notes}` : ''}`,
    ),
    '## Tracks',
    ...t.tracks.map(
      (r) =>
        `- ${r.title} [${r.kind}] · ${trackDistance(r).toFixed(2)} km (straight distances between recorded points; not road routing)`,
    ),
    '## Linked media',
    ...media
      .filter((a) => t.mediaIds.includes(a.id))
      .map((a) => `- ${a.title} (media ID: ${a.id})`),
    ...(t.story
      ? [
          '## AI travelogue draft',
          `Generated ${t.story.generatedAt}. ${t.revision > t.story.sourceRevision + 1 ? 'Notes have changed since this draft.' : ''}`,
          t.story.text,
        ]
      : []),
  ]
    .filter(Boolean)
    .join('\n\n');
}
export function recallPrompts(t: Trip) {
  const dates = new Set(
    t.tracks
      .filter((r) => r.kind === 'recorded')
      .flatMap((r) => r.points.flatMap((p) => (p.time ? [p.time.slice(0, 10)] : []))),
  );
  if (t.startDate && t.endDate) {
    let d = new Date(t.startDate + 'T12:00:00Z');
    for (
      let i = 0;
      i < 31 && d.toISOString().slice(0, 10) <= t.endDate;
      i++, d.setUTCDate(d.getUTCDate() + 1)
    )
      dates.add(d.toISOString().slice(0, 10));
  }
  return [...dates]
    .sort()
    .filter(
      (date) =>
        date <= new Date().toISOString().slice(0, 10) &&
        !t.logs.some((l) => l.date === date && l.kind !== 'plan'),
    )
    .slice(0, 14)
    .map((date) => ({
      date,
      question: `${date}: What did you do, who was with you, and what is one detail worth remembering?`,
    }));
}
