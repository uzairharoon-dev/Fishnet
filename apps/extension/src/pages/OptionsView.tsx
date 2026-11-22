import {
  DETECTOR_GROUPS,
  isTypeEnabled,
  modeFor,
  type Settings,
  SITES,
  withSiteMode,
  withTypeEnabled,
} from '../settings/schema';
import { TYPE_LABELS } from '../ui/describe';
import { ModePicker } from './ModePicker';

interface Props {
  settings: Settings;
  onChange(settings: Settings): void;
  onReset(): void;
}

export function OptionsView({ settings, onChange, onReset }: Props) {
  return (
    <main className="options">
      <header>
        <h1>Fishnet settings</h1>
        <p className="muted">
          Saved on this device only, never synced to your Google account. Changes apply to open tabs
          right away.
        </p>
      </header>

      <section>
        <h2>Sites</h2>
        <ul className="sites">
          {SITES.map((site) => (
            <li key={site.id}>
              <div>
                <h3>{site.name}</h3>
                <p className="muted">{site.host}</p>
              </div>
              <ModePicker
                label={`Mode for ${site.name}`}
                value={modeFor(settings, site.id)}
                onChange={(mode) => onChange(withSiteMode(settings, site.id, mode))}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Detectors</h2>
        <p className="muted">Turned-off detectors are skipped on every site.</p>
        <div className="groups">
          {DETECTOR_GROUPS.map((group) => (
            <fieldset key={group.name}>
              <legend>{group.name}</legend>
              {group.types.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={isTypeEnabled(settings, type)}
                    onChange={(e) => onChange(withTypeEnabled(settings, type, e.target.checked))}
                  />
                  {TYPE_LABELS[type]}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </section>

      <footer>
        <button type="button" onClick={onReset}>
          Reset to defaults
        </button>
      </footer>
    </main>
  );
}
