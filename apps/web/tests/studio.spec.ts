import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installLibraryFixtures } from './library-fixtures';

test.beforeEach(async ({ page }) => {
  await installLibraryFixtures(page);
  await page.goto('/');
  await expect(page.getByTestId('media-card')).toHaveCount(12);
});
test('library search, media filters, view modes and batch selection', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Search media' }).fill('quiet');
  await expect(page.getByTestId('media-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByTestId('media-card')).toHaveCount(12);
  await page.getByRole('button', { name: /^Videos/ }).click();
  await expect(page.getByText('No moments found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Select The quiet before sunrise', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add to selection Closer to the clouds' }).click();
  await expect(page.getByRole('button', { name: '2 selected' })).toBeVisible();
});
test('metadata, notes, drafts and tags survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByRole('textbox', { name: 'Asset title' }).fill('A changed title');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'A changed title' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New tag' }).fill('remember');
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await page.getByRole('tab', { name: 'Memories', exact: true }).click();
  await page.getByRole('textbox', { name: 'Memory note' }).fill('A private memory.');
  await page.getByRole('tab', { name: 'Publish', exact: true }).click();
  await page.getByRole('textbox', { name: 'Publication draft' }).fill('A draft for later.');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A changed title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove tag remember' })).toBeVisible();
  await page.getByRole('tab', { name: 'Memories', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Memory note' })).toHaveValue('A private memory.');
  await page.getByRole('link', { name: 'Publications', exact: true }).click();
  await expect(page.getByText('A draft for later.')).toBeVisible();
});
test('real file imports persist with their blobs after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Import media', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'my-real-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBw8AAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('combobox', { name: 'Upload destination' }).selectOption('local');
  await page.getByRole('checkbox', { name: 'Start uploading after adding to queue' }).uncheck();
  await page.getByRole('button', { name: 'Add 1 file to queue', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/\/imports$/);
  await page.goto('/library');
  await expect(page.getByTestId('media-card')).toHaveCount(13);
  await page.reload();
  await expect(page.getByTestId('media-card')).toHaveCount(13);
  await page.getByRole('textbox', { name: 'Search media' }).fill('my-real-photo');
  await expect(page.getByTestId('media-card')).toHaveCount(1);
  await expect(page.getByTestId('media-card').locator('img')).toHaveJSProperty('naturalWidth', 1);
});
test('command palette, collection creation and theme switching', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New collection', exact: true }).click();
  await page.getByRole('textbox', { name: 'Collection name' }).fill('Weekend away');
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByRole('heading', { name: 'Weekend away', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});
test('responsive layouts, local sample images, accessibility and console health', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await expect(page.getByTestId('media-card')).toHaveCount(12);
    await expect(page.getByTestId('media-card').first().locator('img')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `../../docs/screenshots/library-${width}.png`, fullPage: true });
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test('showcase dialog traps focus, closes with Escape and has no accessibility violations', async ({
  page,
}) => {
  await page.goto('/dev/ui');
  await page.getByRole('button', { name: 'Open accessible dialog' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate((e) => e.contains(document.activeElement))).toBe(
    true,
  );
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('mobile inspector, light theme portals, and RTL remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle inspector' }).click();
  await expect(page.getByRole('complementary', { name: 'Media inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await expect(page.getByRole('complementary', { name: 'Media inspector' })).not.toBeVisible();
  await page.goto('/settings');
  await page
    .getByRole('button', { name: 'Right to left' })
    .isVisible()
    .catch(() => false);
  await page.getByRole('button', { name: 'Left to right', exact: true }).click();
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/library-rtl-390.png' });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Right to left', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: '../../docs/screenshots/library-light-1440.png' });
  const light = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(light.violations).toEqual([]);
  await page.getByRole('button', { name: 'Import media', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
