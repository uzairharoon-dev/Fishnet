import { MODE_LABELS, MODES, type Mode } from '../settings/mode';

interface Props {
  /** Accessible name, e.g. "Mode for ChatGPT". */
  label: string;
  value: Mode;
  onChange(mode: Mode): void;
}

/** Segmented control for the four modes. Native radios, so keyboard and screen readers work. */
export function ModePicker({ label, value, onChange }: Props) {
  const name = `mode-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="mode-picker">
      <fieldset aria-label={label}>
        {MODES.map((m) => (
          <label
            key={m}
            className={m === value ? 'selected' : undefined}
            title={MODE_LABELS[m].hint}
          >
            <input
              type="radio"
              name={name}
              value={m}
              checked={m === value}
              onChange={() => onChange(m)}
            />
            {MODE_LABELS[m].name}
          </label>
        ))}
      </fieldset>
      <p className="hint">{MODE_LABELS[value].hint}.</p>
    </div>
  );
}
