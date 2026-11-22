import { badgeFor, isFishnetMessage } from '../src/messages';

export default defineBackground(() => {
  // Content scripts need session storage for placeholder maps (v2).
  browser.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

  // Badge per tab. Holds no state, so it survives the service worker being stopped.
  browser.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab?.id;
    if (!isFishnetMessage(message) || message.type !== 'fishnet:findings' || tabId === undefined) {
      return;
    }
    const badge = badgeFor(message.count, message.high);
    void browser.action.setBadgeText({ tabId, text: badge.text });
    void browser.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  });
});
