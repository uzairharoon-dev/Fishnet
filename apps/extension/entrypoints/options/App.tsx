import { useEffect, useState } from 'react';
import { OptionsView } from '../../src/pages/OptionsView';
import { DEFAULT_SETTINGS, type Settings } from '../../src/settings/schema';
import { loadSettings, saveSettings, watchSettings } from '../../src/settings/store';

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    // Keep in step with changes made from the popup.
    return watchSettings(setSettings);
  }, []);

  if (!settings) return null;

  const update = (next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  };

  return (
    <OptionsView settings={settings} onChange={update} onReset={() => update(DEFAULT_SETTINGS)} />
  );
}

export default App;
