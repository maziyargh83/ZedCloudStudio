import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
let child: ChildProcess;
let root: string;
const base = 'http://127.0.0.1:4882';
let mediaId: string;
const headers = { 'Content-Type': 'application/json' };
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'zcloud-travel-browser-'));
  child = spawn(process.execPath, [resolve('../api/dist/server.js')], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      ZCLOUD_DATA_FILE: join(root, 'library.json'),
      ZCLOUD_STORAGE_ROOT: root,
      PORT: '4882',
      LIARA_API_KEY: '',
      LIARA_BASE_URL: '',
    },
    stdio: 'pipe',
  });
  await expect
    .poll(async () => {
      try {
        return (await fetch(base + '/health')).ok;
      } catch {
        return false;
      }
    })
    .toBe(true);
});
test.afterAll(async () => {
  child?.kill('SIGTERM');
  if (child && child.exitCode === null) await new Promise((r) => child.once('exit', r));
  await rm(root, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: base + url.pathname.replace(/^\/api/, '') + url.search,
    });
    await route.fulfill({ response });
  });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});
test('no demos; metadata questions save a durable draft and apply only after review', async ({
  page,
}) => {
  await page.goto('/library');
  await expect(page.getByText('PERSONAL LIBRARY', { exact: true })).toBeVisible();
  await expect(page.getByTestId('media-card')).toHaveCount(0);
  const response = await fetch(base + '/v1/media', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'IMG_001',
      filename: 'IMG_001.png',
      type: 'photo',
      mime: 'image/png',
      size: 68,
      source: 'local',
      capturedAt: '2026-10-01T12:00:00.000Z',
    }),
  });
  mediaId = (await response.json()).data.id;
  await page.goto('/reviews');
  await expect(page.getByRole('heading', { name: 'IMG_001', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('First day on the trail');
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('We set up camp near the trail.');
  await page.getByRole('textbox', { name: 'Tags', exact: true }).fill('hiking, camp');
  await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Shiraz');
  await page.getByRole('button', { name: 'Save answers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply reviewed changes' })).toBeVisible();
  expect((await (await fetch(base + '/v1/media/' + mediaId)).json()).data.title).toBe('IMG_001');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Apply reviewed changes' })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/review-inbox.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Apply reviewed changes' }).click();
  await expect(page.getByRole('heading', { name: 'All clear here' })).toBeVisible();
  expect((await (await fetch(base + '/v1/media/' + mediaId)).json()).data.title).toBe(
    'First day on the trail',
  );
});
test('trip wiki, journal, gear, GPX date filtering, planned route and exports persist', async ({
  page,
}) => {
  await page.goto('/adventures');
  await page.getByRole('button', { name: 'New trip', exact: true }).click();
  await page.getByLabel('Trip title', { exact: true }).fill('A real trip notebook');
  await page.getByLabel('Trip destination', { exact: true }).fill('Shiraz');
  await page.getByLabel('Trip start date', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Trip end date', { exact: true }).fill('2026-10-03');
  await page.getByRole('button', { name: 'Create trip', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A real trip notebook', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Journal & plans', exact: true }).click();
  await page.getByLabel('Log date', { exact: true }).fill('2026-10-02');
  await page.getByLabel('Log title', { exact: true }).fill('Camp by the trail');
  await page
    .getByLabel('Log details', { exact: true })
    .fill('A quiet evening, repairing the stove.');
  await page.getByLabel('Log latitude', { exact: true }).fill('29.61');
  await page.getByLabel('Log longitude', { exact: true }).fill('52.53');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Camp by the trail', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gear', exact: true }).click();
  await page.getByLabel('Gear name', { exact: true }).fill('Stove');
  await page.getByLabel('Gear weight', { exact: true }).fill('300');
  await page.getByRole('button', { name: 'Add gear', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Stove × 1', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Stove × 1', exact: true }).check();
  await page.getByRole('button', { name: 'Map & GPX', exact: true }).click();
  const xml =
    '<gpx version="1.1"><trk><name>Test recorded trail</name><trkseg><trkpt lat="29.6" lon="52.5"><time>2026-10-01T09:00:00Z</time><ele>1500</ele></trkpt><trkpt lat="29.601" lon="52.501"><time>2026-10-01T10:00:00Z</time></trkpt></trkseg><trkseg><trkpt lat="29.62" lon="52.54"><time>2026-10-02T09:00:00Z</time></trkpt></trkseg></trk></gpx>';
  await page
    .getByLabel('Import GPX', { exact: true })
    .setInputFiles({
      name: 'recording.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from(xml),
    });
  await expect(page.getByTestId('travel-map')).toHaveAttribute('data-visible-points', '3');
  await page.getByLabel('Map to date', { exact: true }).fill('2026-10-01');
  await expect(page.getByTestId('travel-map')).toHaveAttribute('data-visible-points', '2');
  await page.screenshot({ path: '../../docs/screenshots/trip-map.png', fullPage: true });
  const trackRow = page.getByRole('article').filter({ hasText: 'Test recorded trail' });
  const downloadEvent = page.waitForEvent('download');
  await trackRow.getByRole('button', { name: 'Export GPX' }).click();
  const gpx = await readFile((await (await downloadEvent).path())!, 'utf8');
  expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
  expect(gpx).toContain('2026-10-02T09:00:00.000Z');
  await page.getByRole('button', { name: 'All dates', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Next route');
  for (const [lat, lng] of [
    ['29.63', '52.55'],
    ['29.64', '52.56'],
  ]) {
    await page.getByLabel('Waypoint latitude', { exact: true }).fill(lat);
    await page.getByLabel('Waypoint longitude', { exact: true }).fill(lng);
    await page.getByRole('button', { name: 'Add waypoint', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save planned route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Next route', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Gear', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Stove × 1', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Wiki', exact: true }).click();
  await page.screenshot({ path: '../../docs/screenshots/trip-wiki.png', fullPage: true });
  const wikiDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export wiki', exact: true }).click();
  const wiki = await readFile((await (await wikiDownload).path())!, 'utf8');
  expect(wiki).toContain('Camp by the trail');
  expect(wiki).toContain('Stove');
  expect(wiki).toContain('Next route [planned]');
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../../docs/screenshots/trip-wiki-mobile.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.goto('/map');
  await expect(page.getByTestId('travel-map')).toHaveAttribute('data-visible-points', '3');
  await page.getByRole('checkbox', { name: 'Show plans too' }).check();
  await expect(page.getByTestId('travel-map')).toHaveAttribute('data-visible-points', '5');
});
