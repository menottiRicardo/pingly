import type { ReactNode } from 'react';
import { useEffect, useId, useMemo } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import type { PreferencesStore } from './store';
import { usePreferences } from './usePreferences';

export interface PreferencesLabels {
  title: string;
  description: string;
  category: string;
  mute: string;
  quietHours: string;
  quietHoursDescription: string;
  from: string;
  to: string;
  timeZone: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  locked: string;
}

const DEFAULT_LABELS: PreferencesLabels = {
  title: 'Notification preferences',
  description: 'Choose what you hear about and where.',
  category: 'Notification',
  mute: 'Mute',
  quietHours: 'Quiet hours',
  quietHoursDescription:
    'Pause pop-ups, sounds and desktop alerts. Notifications still reach your inbox.',
  from: 'From',
  to: 'To',
  timeZone: 'Time zone',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save your preferences",
  locked: 'Required',
};

export interface NotificationPreferencesProps {
  store: PreferencesStore<ReactNode>;
  labels?: Partial<PreferencesLabels>;
  /** Show a mute switch per category. Defaults to `true`. */
  showMute?: boolean;
  /** Show the quiet hours editor. Defaults to `true`. */
  showQuietHours?: boolean;
  theme?: Theme;
  className?: string;
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="pingly-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="pingly-switch-thumb" aria-hidden="true" />
    </button>
  );
}

const text = (node: ReactNode) =>
  typeof node === 'string' || typeof node === 'number' ? String(node) : '';

function timeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

/** A settings panel: categories × channels switches, mute and quiet hours. */
export function NotificationPreferences({
  store,
  labels: labelOverrides,
  showMute = true,
  showQuietHours = true,
  theme: themeProp,
  className,
}: NotificationPreferencesProps) {
  const theme = useTheme(themeProp);
  const state = usePreferences(store);
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const titleId = useId();
  const quietId = useId();
  const zones = useMemo(() => timeZones(), []);
  const { quietHours, muted } = state.values;
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (store.getSnapshot().status === 'idle') void store.load();
  }, [store]);

  const statusText =
    state.status === 'saving'
      ? labels.saving
      : state.status === 'error'
        ? labels.error
        : state.savedAt && !state.dirty
          ? labels.saved
          : '';

  return (
    <section
      className={cx('pingly-root pingly-prefs', className)}
      data-theme={theme}
      aria-labelledby={titleId}
    >
      <header className="pingly-prefs-header">
        <h2 id={titleId} className="pingly-panel-title">
          {labels.title}
        </h2>
        <p className="pingly-state-text">{labels.description}</p>
      </header>

      <table className="pingly-prefs-table">
        <thead>
          <tr>
            <th scope="col">{labels.category}</th>
            {store.channels.map((ch) => (
              <th key={ch.id} scope="col">
                {ch.label}
              </th>
            ))}
            {showMute && <th scope="col">{labels.mute}</th>}
          </tr>
        </thead>
        <tbody>
          {store.categories.map((cat) => {
            const isMuted = Boolean(muted[cat.id]);
            return (
              <tr key={cat.id} data-muted={isMuted || undefined}>
                <th scope="row">
                  <span className="pingly-prefs-name">{cat.label}</span>
                  {cat.description != null && (
                    <span className="pingly-prefs-desc">{cat.description}</span>
                  )}
                </th>
                {store.channels.map((ch) => {
                  const applies = !cat.channels || cat.channels.includes(ch.id);
                  const locked = store.isLocked(cat.id, ch.id);
                  return (
                    <td key={ch.id}>
                      {applies ? (
                        <Switch
                          checked={store.isEnabled(cat.id, ch.id)}
                          disabled={locked || isMuted}
                          label={`${text(cat.label)} – ${text(ch.label)}${locked ? ` (${labels.locked})` : ''}`}
                          onChange={(value) => store.set(cat.id, ch.id, value)}
                        />
                      ) : (
                        <span aria-hidden="true">–</span>
                      )}
                    </td>
                  );
                })}
                {showMute && (
                  <td>
                    <Switch
                      checked={isMuted}
                      label={`${labels.mute} ${text(cat.label)}`}
                      onChange={(value) => store.mute(cat.id, value)}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {showQuietHours && (
        <fieldset className="pingly-prefs-quiet" aria-describedby={quietId}>
          <legend className="pingly-prefs-name">
            <Switch
              checked={quietHours.enabled}
              label={labels.quietHours}
              onChange={(enabled) => store.setQuietHours({ enabled })}
            />
            {labels.quietHours}
          </legend>
          <p id={quietId} className="pingly-prefs-desc">
            {labels.quietHoursDescription}
          </p>
          <div className="pingly-prefs-row">
            <label>
              {labels.from}
              <input
                type="time"
                value={quietHours.start}
                disabled={!quietHours.enabled}
                onChange={(e) => store.setQuietHours({ start: e.target.value })}
              />
            </label>
            <label>
              {labels.to}
              <input
                type="time"
                value={quietHours.end}
                disabled={!quietHours.enabled}
                onChange={(e) => store.setQuietHours({ end: e.target.value })}
              />
            </label>
            <label>
              {labels.timeZone}
              {zones.length ? (
                <select
                  value={quietHours.timeZone ?? localZone}
                  disabled={!quietHours.enabled}
                  onChange={(e) => store.setQuietHours({ timeZone: e.target.value })}
                >
                  {zones.map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={quietHours.timeZone ?? localZone}
                  disabled={!quietHours.enabled}
                  onChange={(e) => store.setQuietHours({ timeZone: e.target.value })}
                />
              )}
            </label>
          </div>
        </fieldset>
      )}

      <footer className="pingly-prefs-footer">
        <span role="status" className="pingly-state-text">
          {statusText}
        </span>
        <button
          type="button"
          className="pingly-button"
          data-variant="primary"
          disabled={!state.dirty || state.status === 'saving'}
          onClick={() => void store.save()}
        >
          {labels.save}
        </button>
      </footer>
    </section>
  );
}
