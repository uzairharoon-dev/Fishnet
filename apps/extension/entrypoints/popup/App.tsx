import { useCallback, useEffect, useState } from 'react';
import type { TabStatus } from '../../src/messages';
import { PopupView } from '../../src/pages/PopupView';
import type { Mode } from '../../src/settings/mode';
import { withSiteMode } from '../../src/settings/schema';
import { loadSettings, saveSettings } from '../../src/settings/store';

const REFRESH_MS = 1000;

/** Asks the active tab's content script for its status; null if none is running there. */
async function fetchStatus(): Promise<TabStatus | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  try {
    return (
      ((await browser.tabs.sendMessage(tab.id, { type: 'fishnet:status' })) as TabStatus) ?? null
    );
  } catch {
    return null; // No content script on this tab.
  }
}

function App() {
  const [status, setStatus] = useState<TabStatus | null>(null);

  const refresh = useCallback(() => {
    void fetchStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const onModeChange = async (mode: Mode) => {
    if (!status) return;
    setStatus({ ...status, mode });
    await saveSettings(withSiteMode(await loadSettings(), status.site, mode));
  };

  return (
    <PopupView
      status={status}
      onModeChange={(mode) => void onModeChange(mode)}
      onOpenOptions={() => void browser.runtime.openOptionsPage()}
    />
  );
}

export default App;
