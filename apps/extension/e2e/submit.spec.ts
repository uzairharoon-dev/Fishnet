import { expect, sentMessages, setSettings, test } from './fixtures';

const MESSAGE = 'mail ahmed@acme.pk card 4111 1111 1111 1111';

test('clean messages send as typed', async ({ chat }) => {
  await chat.keyboard.type('what is a monad?');
  await chat.keyboard.press('Enter');
  await expect.poll(() => sentMessages(chat)).toEqual(['what is a monad?']);
});

test('redact mode replaces findings before sending', async ({ chat }) => {
  await chat.keyboard.type(MESSAGE);
  await chat.keyboard.press('Enter');
  await expect.poll(() => sentMessages(chat)).toEqual(['mail [EMAIL_1] card [CARD_1]']);
});

test('redact mode also guards the send button', async ({ chat }) => {
  await chat.keyboard.type(MESSAGE);
  await chat.getByTestId('send-button').click();
  await expect.poll(() => sentMessages(chat)).toEqual(['mail [EMAIL_1] card [CARD_1]']);
});

test('Shift+Enter still adds a line', async ({ chat }) => {
  await chat.keyboard.type('mail ahmed@acme.pk');
  await chat.keyboard.press('Shift+Enter');
  await chat.keyboard.type('second line');
  await expect(chat.locator('#prompt-textarea p')).toHaveCount(2);
  expect(await sentMessages(chat)).toEqual([]);
});

test('warn mode sends as typed', async ({ chat, worker }) => {
  await setSettings(worker, { siteModes: { chatgpt: 'warn' }, disabledTypes: [] });
  await chat.keyboard.type('mail ahmed@acme.pk');
  await chat.keyboard.press('Enter');
  await expect.poll(() => sentMessages(chat)).toEqual(['mail ahmed@acme.pk']);
});

test.describe('block mode', () => {
  test.beforeEach(async ({ chat, worker }) => {
    await setSettings(worker, { siteModes: { chatgpt: 'block' }, disabledTypes: [] });
    await chat.keyboard.type('mail ahmed@acme.pk');
    await chat.keyboard.press('Enter');
    await expect(chat.locator('fishnet-review')).toBeAttached();
  });

  // The dialog's shadow root is closed, so the tests drive it with the keyboard
  // from its focused primary button: Redact & send, then Send anyway, then Edit.
  test('holds the message until the user decides', async ({ chat }) => {
    expect(await sentMessages(chat)).toEqual([]);
  });

  test('Redact & send', async ({ chat }) => {
    await chat.keyboard.press('Enter');
    await expect.poll(() => sentMessages(chat)).toEqual(['mail [EMAIL_1]']);
  });

  test('Send anyway', async ({ chat }) => {
    await chat.keyboard.press('Shift+Tab');
    await chat.keyboard.press('Enter');
    await expect.poll(() => sentMessages(chat)).toEqual(['mail ahmed@acme.pk']);
  });

  test('Escape goes back to editing', async ({ chat }) => {
    await chat.keyboard.press('Escape');
    await expect(chat.locator('fishnet-review')).not.toBeAttached();
    await expect(chat.locator('#prompt-textarea')).toHaveText('mail ahmed@acme.pk');
    expect(await sentMessages(chat)).toEqual([]);
  });
});
