# Privacy

Fishnet exists to keep sensitive text away from servers you did not mean to send it to. It would make no sense for Fishnet itself to send your data anywhere, so it does not.

## What Fishnet reads

- The text in the message box on supported sites (currently chatgpt.com), while you type, paste or send.
- Text you paste into that message box.

It does not read the conversation history, other tabs, other sites, your browsing history, cookies or files.

## Where that text goes

Nowhere. All detection runs inside the content script in your browser. Fishnet has no server, makes no network requests, and contains no analytics, telemetry, crash reporting or remote configuration. You can check this: the extension's code is in this repository, and its only network-capable permission is access to chatgpt.com, which it needs in order to run on that page.

## What Fishnet stores

| Data | Where | How long |
|---|---|---|
| Settings: mode per site, detectors turned off | `chrome.storage.local` on this device | Until you change them or remove the extension |
| Placeholder map (e.g. `[EMAIL_1]` = the real address) | Memory of the open tab | Until the tab is closed or reloaded |
| Counts shown in the popup and badge | Memory of the open tab | Until the tab is closed or reloaded |

Settings are never written to `chrome.storage.sync`, which would upload them to your Google account. Counts never include the values found. Console messages name the types found (for example `EMAIL, CNIC`), never the values.

The placeholder map does hold real values, because Fishnet needs them to know that the same email is `[EMAIL_1]` every time. It stays in the tab's memory and is not written to disk. A later version will move it to `chrome.storage.session`, which Chrome also keeps in memory only.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your settings on this device |
| `https://chatgpt.com/*` | Run the checks in ChatGPT's message box |

Fishnet does not ask for `tabs`, `history`, `cookies`, `<all_urls>`, `webRequest`, `clipboardRead` or any other permission.

## What Fishnet cannot protect

Fishnet is a safety net, not a guarantee. Anything it misses, or that you choose to send anyway, goes to the AI provider exactly as typed, under that provider's privacy policy. See the limits in the [README](README.md#limits).

## Contact

Questions or a privacy problem: open an issue at https://github.com/uzairharoon-dev/Fishnet/issues.
