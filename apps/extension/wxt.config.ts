import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Fishnet',
    description: 'Catch PII and secrets before they reach AI tools. Everything runs locally.',
    permissions: ['storage'],
    host_permissions: ['https://chatgpt.com/*'],
  },
});
