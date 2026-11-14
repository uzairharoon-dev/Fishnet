export default defineBackground(() => {
  // Content scripts need session storage for placeholder maps (v2).
  browser.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
});
