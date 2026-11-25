import { expect, paste, sentMessages, test } from './fixtures';

test('a pasted email and CNIC reach the editor as placeholders', async ({ chat }) => {
  await paste(chat, 'Reply to ahmed@acme.pk, CNIC 35202-1234567-1');
  await expect(chat.locator('#prompt-textarea')).toHaveText('Reply to [EMAIL_1], CNIC [CNIC_1]');
});

test('a redacted paste is inserted once and sends', async ({ chat }) => {
  await paste(chat, 'mail ahmed@acme.pk');
  await chat.keyboard.press('Enter');
  await expect.poll(() => sentMessages(chat)).toEqual(['mail [EMAIL_1]']);
});

test('Ctrl+Z undoes a redacted paste', async ({ chat }) => {
  await chat.keyboard.type('hello ');
  await paste(chat, 'ahmed@acme.pk');
  await expect(chat.locator('#prompt-textarea')).toHaveText('hello [EMAIL_1]');
  await chat.keyboard.press('Control+z');
  await expect(chat.locator('#prompt-textarea')).not.toContainText('[EMAIL_1]');
  await expect(chat.locator('#prompt-textarea')).not.toContainText('ahmed@acme.pk');
});

test('clean pastes are left alone', async ({ chat }) => {
  await paste(chat, 'what is a monad?');
  await expect(chat.locator('#prompt-textarea')).toHaveText('what is a monad?');
});
