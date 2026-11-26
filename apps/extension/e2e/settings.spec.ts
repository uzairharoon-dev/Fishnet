import { badgeText, expect, paste, setSettings, test } from './fixtures';

test('the badge counts findings in the editor', async ({ chat, worker }) => {
  await chat.keyboard.type('mail ahmed@acme.pk card 4111 1111 1111 1111');
  await expect.poll(() => badgeText(worker)).toBe('2');
});

test('the banner appears when something is found', async ({ chat }) => {
  await chat.keyboard.type('mail ahmed@acme.pk');
  await expect(chat.locator('fishnet-banner')).toBeAttached();
});

test('turning a mode off applies without a reload', async ({ chat, worker }) => {
  await setSettings(worker, { siteModes: { chatgpt: 'off' }, disabledTypes: [] });
  await paste(chat, 'mail ahmed@acme.pk');
  await expect(chat.locator('#prompt-textarea')).toHaveText('mail ahmed@acme.pk');
  await expect.poll(() => badgeText(worker)).toBe('');
});

test('a disabled detector is skipped', async ({ chat, worker }) => {
  await chat.keyboard.type('mail ahmed@acme.pk ');
  await expect.poll(() => badgeText(worker)).toBe('1');
  await setSettings(worker, { siteModes: {}, disabledTypes: ['EMAIL'] });
  // The mode did not change, so wait for the rescan that drops the email.
  await expect.poll(() => badgeText(worker)).toBe('');
  await chat.keyboard.press('Control+a');
  await chat.keyboard.press('Delete');
  await paste(chat, 'mail ahmed@acme.pk, CNIC 35202-1234567-1');
  await expect(chat.locator('#prompt-textarea')).toHaveText('mail ahmed@acme.pk, CNIC [CNIC_1]');
});
