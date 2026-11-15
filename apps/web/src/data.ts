export type MediaType = 'photo' | 'video' | 'audio';
export interface Asset {
  id: string;
  title: string;
  filename: string;
  type: MediaType;
  src: string;
  size: number;
  width?: number;
  height?: number;
  date: string;
  location: string;
  collection: string;
  tags: string[];
  description: string;
  favorite: boolean;
  demo: boolean;
  memory: string;
  draft: string;
  mime: string;
  serverId?: string;
  customMetadata?: Record<string, string>;
}
export interface Collection {
  id: string;
  name: string;
  description: string;
}
export const initialCollections: Collection[] = [
  {
    id: 'alpine',
    name: 'Alpine escape',
    description: 'A little further from everything. Five days in the Italian Alps.',
  },
  {
    id: 'wild',
    name: 'Into the wild',
    description: 'Small discoveries, somewhere off the beaten path.',
  },
  { id: 'light', name: 'Chasing light', description: 'The moments between golden hour and blue.' },
];
const rows = [
  [
    'lake',
    'The quiet before sunrise',
    'Lago di Braies, Italy',
    'alpine',
    '2026-10-24',
    'landscape,alpine,reflection',
  ],
  [
    'mountains',
    'Closer to the clouds',
    'Dolomites, Italy',
    'alpine',
    '2026-10-24',
    'mountains,alpine,hiking',
  ],
  [
    'travel-1',
    'A slower kind of morning',
    'Lake Como, Italy',
    'alpine',
    '2026-10-24',
    'water,travel,stillness',
  ],
  [
    'ice',
    'Unexpected company',
    'Bavarian Forest, Germany',
    'wild',
    '2026-10-23',
    'wildlife,forest,nature',
  ],
  [
    'maple',
    'Where the forest breathes',
    'Black Forest, Germany',
    'wild',
    '2026-10-23',
    'forest,light,nature',
  ],
  [
    'travel-2',
    'Taking the long way home',
    'Tuscany, Italy',
    'light',
    '2026-10-23',
    'landscape,travel,golden hour',
  ],
  [
    'ice2',
    'Nothing but the horizon',
    'Swiss Alps, Switzerland',
    'alpine',
    '2026-10-22',
    'mountains,alpine,adventure',
  ],
  [
    'travel-4',
    'The last of the light',
    'Val d’Orcia, Italy',
    'light',
    '2026-10-22',
    'sunset,landscape,golden hour',
  ],
  [
    'ocean',
    'A sky worth staying up for',
    'Passo Giau, Italy',
    'alpine',
    '2026-10-22',
    'night,mountains,stars',
  ],
  [
    'travel-13',
    'Somewhere in between',
    'Saxon Switzerland, Germany',
    'wild',
    '2026-10-21',
    'forest,valley,adventure',
  ],
  [
    'sample-3',
    'Follow the green',
    'Bavarian Forest, Germany',
    'wild',
    '2026-10-21',
    'forest,trail,nature',
  ],
  [
    'toronto',
    'Let it all flow',
    'Krka National Park, Croatia',
    'wild',
    '2026-10-21',
    'water,forest,nature',
  ],
];
export const demoAssets: Asset[] = rows.map(
  ([photo, title, location, collection, date, tags], index) => ({
    id: `demo-${index + 1}`,
    title,
    filename: `ZC_${String(1042 + index).padStart(4, '0')}.jpg`,
    type: 'photo',
    src: `/media/${photo}.jpg`,
    size: 0,
    date,
    location,
    collection,
    tags: tags.split(','),
    description:
      index === 0
        ? 'First light on the lake. No plans, no rush. Just this view and a very good reason to put the phone away.'
        : '',
    favorite: index === 0 || index === 4 || index === 8,
    demo: true,
    memory: '',
    draft: '',
    mime: 'image/jpeg',
  }),
);
export const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  );
