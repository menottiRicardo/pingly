import { NotificationPreferences, usePreferences } from 'pingly';
import { publishRandom } from '../backend/random';
import { Card, Row } from '../components/Card';
import { preferences } from '../stores';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function PreferencesPage() {
  const state = usePreferences(preferences);
  const quietNow = preferences.isQuiet();

  return (
    <>
      <NotificationPreferences store={preferences} />
      <Card
        title="Try it"
        description="Preferences are enforced by the provider before every delivery. Saving goes through the chaos panel too."
      >
        <Row>
          <button
            onClick={() => {
              const now = new Date();
              preferences.setQuietHours({
                enabled: true,
                start: hhmm(now),
                end: hhmm(new Date(now.getTime() + 60 * 60_000)),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                days: undefined,
              });
            }}
          >
            Quiet hours for the next hour
          </button>
          <button onClick={() => preferences.setQuietHours({ enabled: false })}>
            End quiet hours
          </button>
          <button onClick={() => publishRandom()}>Send a test event</button>
        </Row>
        <p className="muted small">
          Quiet hours are <strong>{quietNow ? 'on' : 'off'}</strong> right now. While on, toasts,
          sounds and desktop alerts are held back but the inbox still updates.
        </p>
        <table className="matrix">
          <thead>
            <tr>
              <th>Category</th>
              {preferences.channels.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
              <th>Toast now?</th>
            </tr>
          </thead>
          <tbody>
            {preferences.categories.map((cat) => (
              <tr key={cat.id}>
                <th>{cat.label}</th>
                {preferences.channels.map((ch) => (
                  <td key={ch.id}>{preferences.isEnabled(cat.id, ch.id) ? '✓' : '—'}</td>
                ))}
                <td>
                  {preferences.allows(cat.id, 'inApp', { interruptive: true }) ? 'yes' : 'held'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Status: {state.status}
          {state.dirty ? ' · unsaved changes' : ''}
        </p>
      </Card>
    </>
  );
}
