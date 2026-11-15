import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('explicit AI submission, generated text, error recovery and responsive layout', async ({
  page,
}) => {
  await page.route('**/api/v1/media', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/uploads', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v1/ai/status', (route) =>
    route.fulfill({ json: { configured: true, model: 'test/model' } }),
  );
  let calls = 0;
  await page.route('**/api/v1/ai/generate', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ prompt: 'A test caption' });
    if (calls === 1)
      await route.fulfill({
        json: { text: 'Test provider response. <script>throw new Error()</script>' },
      });
    else await route.fulfill({ status: 429, json: { error: 'Test provider rate limit.' } });
  });
  await page.goto('/ai');
  const send = page.getByRole('button', { name: 'Generate', exact: true });
  await expect(send).toBeDisabled();
  expect(calls).toBe(0);
  await page.getByRole('textbox', { name: 'AI prompt', exact: true }).fill('A test caption');
  await send.click();
  await expect(page.getByRole('region', { name: 'AI response' })).toContainText('<script>');
  expect(calls).toBe(1);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await send.click();
  await expect(page.getByRole('alert')).toContainText('Test provider rate limit.');
  await expect(send).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('region', { name: 'AI response' })).toHaveCount(0);
});

test('unconfigured AI is disabled and makes no generation requests', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/ai/status', (route) =>
    route.fulfill({ json: { configured: false, model: null } }),
  );
  await page.route('**/api/v1/ai/generate', (route) => {
    calls++;
    return route.abort();
  });
  await page.goto('/ai');
  await expect(page.getByText('PROVIDER NOT CONNECTED', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'AI prompt', exact: true }).fill('A prompt');
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeDisabled();
  expect(calls).toBe(0);
});
