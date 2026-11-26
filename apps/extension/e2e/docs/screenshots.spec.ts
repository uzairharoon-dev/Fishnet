/**
 * Captures the README screenshots from the local fixture, not the live site.
 * Run with `pnpm screenshots`; images land in docs/images.
 */
import { join } from 'node:path';
import { expect, setSettings, test } from '../fixtures';

const OUT = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'images');
const MESSAGE =
  'Draft a reply to ahmed@acme.pk. My CNIC is 35202-1234567-1 and the card is 4111 1111 1111 1111.';

test.beforeEach(async ({ chat }) => {
  await chat.setViewportSize({ width: 1000, height: 560 });
});

test('banner and highlights', async ({ chat }) => {
  await chat.keyboard.type(MESSAGE);
  await expect(chat.locator('fishnet-banner')).toBeAttached();
  await chat.waitForTimeout(400); // Highlights paint after the rescan delay.
  await chat.screenshot({ path: join(OUT, 'banner.png') });
});

test('review dialog', async ({ chat, worker }) => {
  await setSettings(worker, { siteModes: { chatgpt: 'block' }, disabledTypes: [] });
  await chat.keyboard.type(MESSAGE);
  await chat.keyboard.press('Enter');
  await expect(chat.locator('fishnet-review')).toBeAttached();
  await chat.screenshot({ path: join(OUT, 'review.png') });
});

test('redacted message', async ({ chat }) => {
  await chat.keyboard.type(MESSAGE);
  await chat.keyboard.press('Enter');
  await expect(chat.locator('#sent li')).toHaveCount(1);
  await chat.screenshot({ path: join(OUT, 'sent.png') });
});

test('options page', async ({ context, worker, chat: _chat }) => {
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.setViewportSize({ width: 760, height: 620 });
  await page.goto(`chrome-extension://${id}/options.html`);
  await expect(page.locator('h1')).toHaveText('Fishnet settings');
  await page.screenshot({ path: join(OUT, 'options.png') });
});
