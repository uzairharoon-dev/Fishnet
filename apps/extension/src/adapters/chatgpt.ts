import { indexEditor, isPlainEnter, queryFirst, type SiteAdapter } from './types';

// Known chatgpt.com composer markup; not yet verified on the live site. Most specific first.
const EDITOR = [
  '#prompt-textarea[contenteditable="true"]',
  'form div.ProseMirror[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]',
  'textarea#prompt-textarea',
  'form textarea',
] as const;

const SEND_BUTTON = [
  'button[data-testid="send-button"]',
  '#composer-submit-button',
  'form button[aria-label*="send" i]',
] as const;

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  matches: (url) => url.hostname === 'chatgpt.com' || url.hostname.endsWith('.chatgpt.com'),
  findEditor: () => queryFirst(EDITOR),
  getText: indexEditor,
  findSendButton: () => queryFirst(SEND_BUTTON),
  isSubmitKey: isPlainEnter,
  conversationId: (url) => url.pathname.match(/\/c\/([\w-]+)/)?.[1] ?? null,
};
