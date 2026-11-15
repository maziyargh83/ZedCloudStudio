import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
let root: string;
let child: ChildProcess;
const base = 'http://127.0.0.1:8789';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBw8AAAAASUVORK5CYII=',
  'base64',
);
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'zcloud-browser-import-'));
  child = spawn(process.execPath, [resolve('../api/dist/server.js')], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      ZCLOUD_DATA_FILE: join(root, 'library.json'),
      ZCLOUD_STORAGE_ROOT: root,
      PORT: '8789',
    },
    stdio: 'pipe',
  });
  await expect
    .poll(async () => {
      try {
        return (await fetch(`${base}/health`)).ok;
      } catch {
        return false;
      }
    })
    .toBe(true);
});
test.afterAll(async () => {
  child?.kill('SIGTERM');
  if (child && child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
  await rm(root, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${base}${url.pathname.replace(/^\/api/, '')}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
test('batch details, paused persistence, resume, actual server bytes and metadata', async ({
  page,
}) => {
  await page.goto('/imports');
  await page.getByRole('button', { name: 'Add media', exact: true }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles([
      { name: 'first-moment.png', mimeType: 'image/png', buffer: png },
      { name: 'second-moment.png', mimeType: 'image/png', buffer: png },
    ]);
  await page.getByRole('textbox', { name: 'Import description' }).fill('My own description');
  await page.getByRole('textbox', { name: 'Import location' }).fill('Shiraz');
  await page.getByRole('textbox', { name: 'Import tags' }).fill('travel, personal');
  await page.getByRole('textbox', { name: 'Custom field name' }).fill('Client');
  await page.getByRole('textbox', { name: 'Custom field value' }).fill('My project');
  await page.getByRole('button', { name: 'Add custom field', exact: true }).click();
  await page.getByRole('button', { name: 'Apply shared details to all files' }).click();
  await page.getByRole('checkbox', { name: 'Start uploading after adding to queue' }).uncheck();
  await page.getByRole('button', { name: 'Add 2 files to queue', exact: true }).click();
  await expect(page.getByTestId('transfer-row')).toHaveCount(2);
  await expect(page.getByTestId('transfer-row').first()).toHaveAttribute('data-status', 'paused');
  await page.screenshot({ path: '../../docs/screenshots/import-queue-paused.png' });
  await page.reload();
  await expect(page.getByTestId('transfer-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Resume first-moment', exact: true }).click();
  await page.getByRole('button', { name: 'Resume second-moment', exact: true }).click();
  await expect(
    page.getByTestId('transfer-row').filter({ hasText: 'first-moment' }),
  ).toHaveAttribute('data-status', 'completed');
  await expect(
    page.getByTestId('transfer-row').filter({ hasText: 'second-moment' }),
  ).toHaveAttribute('data-status', 'completed');
  const catalog = await (await fetch(`${base}/v1/media`)).json();
  expect(catalog.data).toHaveLength(2);
  for (const asset of catalog.data) {
    expect(asset.description).toBe('My own description');
    expect(asset.location).toBe('Shiraz');
    expect(asset.tags).toEqual(['travel', 'personal']);
    expect(asset.customMetadata.Client).toBe('My project');
    expect(
      Buffer.from(await (await fetch(`${base}/v1/media/${asset.id}/content`)).arrayBuffer()),
    ).toEqual(png);
  }
  await page.screenshot({ path: '../../docs/screenshots/import-queue-completed.png' });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
});
test('network failure, retry, cancellation and mobile layout keep the queue usable', async ({
  page,
}) => {
  await page.goto('/imports');
  await page.getByRole('button', { name: 'Add media', exact: true }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'retry-moment.png', mimeType: 'image/png', buffer: png });
  let fail = true;
  await page.route('**/api/v1/uploads/*/chunks/*', async (route) => {
    if (fail) {
      await route.fulfill({ status: 503, json: { error: 'Connection interrupted for test.' } });
      return;
    }
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${base}${url.pathname.replace(/^\/api/, '')}` });
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Add 1 file to queue', exact: true }).click();
  const row = page.getByTestId('transfer-row').filter({ hasText: 'retry-moment' });
  await expect(row).toHaveAttribute('data-status', 'failed');
  fail = false;
  await page.getByRole('button', { name: 'Retry retry-moment', exact: true }).click();
  await expect(row).toHaveAttribute('data-status', 'completed');
  await page.getByRole('button', { name: 'Add media', exact: true }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'cancel-moment.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('checkbox', { name: 'Start uploading after adding to queue' }).uncheck();
  await page.getByRole('button', { name: 'Add 1 file to queue', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel cancel-moment', exact: true }).click();
  await expect(
    page.getByTestId('transfer-row').filter({ hasText: 'cancel-moment' }),
  ).toHaveAttribute('data-status', 'cancelled');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/import-queue-mobile.png' });
});
test('server settings never expose saved access keys; import editor works on mobile', async ({
  page,
}) => {
  await page.goto('/servers');
  await page.getByRole('button', { name: 'Add server', exact: true }).click();
  await page.getByRole('textbox', { name: 'Server name' }).fill('Test destination');
  await page.getByRole('textbox', { name: 'S3 endpoint' }).fill('https://example.invalid');
  await page.getByLabel('Server bucket').fill('test-bucket');
  await page.getByRole('textbox', { name: 'S3 access key' }).fill('FAKE_ACCESS_KEY');
  await page.getByLabel('S3 secret key').fill('FAKE_SECRET_KEY');
  await page.getByRole('button', { name: 'Save server', exact: true }).click();
  const profiles = await (await fetch(`${base}/v1/servers`)).json();
  expect(JSON.stringify(profiles)).not.toContain('FAKE_ACCESS_KEY');
  expect(JSON.stringify(profiles)).not.toContain('FAKE_SECRET_KEY');
  await expect(
    page.getByTestId('storage-server').filter({ hasText: 'Test destination' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/library');
  await page.getByRole('button', { name: 'Import media', exact: true }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'mobile-moment.png', mimeType: 'image/png', buffer: png });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/import-editor-mobile.png' });
});
