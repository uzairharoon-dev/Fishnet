import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test';
import { buildSync } from 'esbuild';

/** The parts of the chrome API that the helpers below call inside the service worker. */
declare const chrome: {
  storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
  tabs: {
    query(query: object): Promise<{ id?: number }[]>;
    sendMessage(tabId: number, message: object): Promise<{ mode?: string } | undefined>;
  };
  action: { getBadgeText(details: { tabId: number }): Promise<string> };
};

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION = join(HERE, '..', '.output', 'chrome-mv3');

/** The fixture page with its ProseMirror bundle inlined, built once per worker. */
const FIXTURE_HTML = (() => {
  const bundle = buildSync({
    entryPoints: [join(HERE, 'fixture', 'editor.ts')],
    bundle: true,
    format: 'iife',
    write: false,
  }).outputFiles[0]?.text;
  if (!bundle) throw new Error('fixture bundle is empty');
  return readFileSync(join(HERE, 'fixture', 'index.html'), 'utf8').replace(
    '/*EDITOR_BUNDLE*/',
    () => bundle,
  );
})();

interface Fixtures {
  context: BrowserContext;
  /** The extension's service worker, for reading badges and writing settings. */
  worker: Worker;
  /** chatgpt.com, served from the local fixture with the extension running on it. */
  chat: Page;
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright needs the destructuring.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    // Never reach the real site: every chatgpt.com request gets the fixture.
    await context.route('https://chatgpt.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: FIXTURE_HTML }),
    );
    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  chat: async ({ context, worker }, use) => {
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/');
    await page.locator('#prompt-textarea').waitFor();
    // The content script starts after the page loads; wait until it answers.
    await expect.poll(() => contentMode(worker)).not.toBeNull();
    await use(page);
  },
});

export const expect = test.expect;

/** Messages the fixture site has "sent". */
export const sentMessages = (page: Page) => page.locator('#sent li').allTextContents();

/** Pastes plain text into the editor the way a browser does, with a clipboard event. */
export async function paste(page: Page, text: string) {
  await page.locator('#prompt-textarea').evaluate((editor, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    const target = editor.querySelector('p') ?? editor;
    target.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

interface TestSettings {
  siteModes: { chatgpt?: string };
  disabledTypes: string[];
}

/**
 * Writes Fishnet settings the way the popup and options page do, then waits
 * until the content script reports the new mode (settings apply asynchronously).
 */
export async function setSettings(worker: Worker, settings: TestSettings) {
  await worker.evaluate((value) => chrome.storage.local.set({ settings: value }), settings);
  await expect.poll(() => contentMode(worker)).toBe(settings.siteModes.chatgpt ?? 'redact');
}

/** Mode the content script on the chatgpt.com tab is using, from the popup's status message. */
function contentMode(worker: Worker) {
  return worker.evaluate(async () => {
    for (const tab of await chrome.tabs.query({})) {
      if (tab.id === undefined) continue;
      try {
        const status = await chrome.tabs.sendMessage(tab.id, { type: 'fishnet:status' });
        if (status?.mode) return status.mode;
      } catch {
        // No content script in this tab.
      }
    }
    return null;
  });
}

/** Badge text on the tab showing chatgpt.com. */
export async function badgeText(worker: Worker) {
  return worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const results = await Promise.all(
      tabs.map((t) => (t.id === undefined ? '' : chrome.action.getBadgeText({ tabId: t.id }))),
    );
    return results.find(Boolean) ?? '';
  });
}
