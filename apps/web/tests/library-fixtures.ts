import type { Page } from '@playwright/test';
/** Test-only media. The product never imports or seeds these records. */
export async function installLibraryFixtures(page: Page) {
  const titles = [
    'The quiet before sunrise',
    'Closer to the clouds',
    'A slower kind of morning',
    'Unexpected company',
    'Where the forest breathes',
    'Taking the long way home',
    'Nothing but the horizon',
    'The last of the light',
    'A sky worth staying up for',
    'Somewhere in between',
    'Follow the green',
    'Let it all flow',
  ];
  const data = titles.map((title, i) => ({
    id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`,
    title,
    filename: `fixture-${i + 1}.png`,
    type: 'photo',
    mime: 'image/png',
    size: 68,
    source: 'upload',
    capturedAt: '2026-10-24T12:00:00.000Z',
    location: 'Test location',
    tags: ['test'],
    description: 'Test fixture metadata',
    favorite: [0, 4, 8].includes(i),
    collectionId: 'test-collection',
    collectionName: 'Test collection',
    customMetadata: {},
  }));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBw8AAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('**/api/v1/media**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/content')) return route.fulfill({ contentType: 'image/png', body: png });
    const id = path.split('/').pop();
    const asset = data.find((a) => a.id === id);
    if (route.request().method() === 'PATCH' && asset) {
      Object.assign(asset, route.request().postDataJSON());
      return route.fulfill({ json: { data: asset } });
    }
    return route.fulfill({ json: { data: asset ?? data } });
  });
  await page.route('**/api/v1/uploads', (route) => route.fulfill({ json: { data: [] } }));
}
