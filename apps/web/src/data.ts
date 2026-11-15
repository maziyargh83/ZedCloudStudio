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
export const initialCollections: Collection[] = [];
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
