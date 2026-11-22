import type { TabStatus } from '../messages';
import type { Mode } from '../settings/mode';
import { SITES } from '../settings/schema';
import { ModePicker } from './ModePicker';

interface Props {
  /** null when Fishnet does not run on the active tab. */
  status: TabStatus | null;
  onModeChange(mode: Mode): void;
  onOpenOptions(): void;
}

export function PopupView({ status, onModeChange, onOpenOptions }: Props) {
  const site = status && SITES.find((s) => s.id === status.site);
  return (
    <main className="popup">
      <header>
        <h1>Fishnet</h1>
        <p className="muted">Checks run on this device. Nothing is sent anywhere.</p>
      </header>

      {!status || !site ? (
        <section className="idle">
          <p>Fishnet does not run on this page.</p>
          <p className="muted">Supported: {SITES.map((s) => s.name).join(', ')}.</p>
        </section>
      ) : (
        <>
          <section>
            <h2>{site.name}</h2>
            {status.editorFound ? (
              <p className="health ok">Watching the message box</p>
            ) : (
              <p className="health warn" role="alert">
                Cannot find the message box. {site.name} may have changed its page, so this tab is
                not protected.
              </p>
            )}
          </section>

          <dl className="stats">
            <div>
              <dt>Found in message</dt>
              <dd>{status.mode === 'off' ? '–' : status.findings}</dd>
            </div>
            <div>
              <dt>Redacted on this page</dt>
              <dd>{status.redacted}</dd>
            </div>
          </dl>

          <section>
            <h3>Mode on {site.host}</h3>
            <ModePicker
              label={`Mode for ${site.name}`}
              value={status.mode}
              onChange={onModeChange}
            />
          </section>
        </>
      )}

      <footer>
        <button type="button" onClick={onOpenOptions}>
          All settings
        </button>
      </footer>
    </main>
  );
}
