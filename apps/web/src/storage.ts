import type { Asset } from './data';
import { loadFiles as loadBrowserFiles } from '@z-cloud/storage/browser';
export { saveFile, readLocal, writeLocal } from '@z-cloud/storage/browser';
export const loadFiles = () => loadBrowserFiles<Asset>();
