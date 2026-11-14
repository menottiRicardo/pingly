import { PermissionPrompt, createSound, notify, toast, usePermission } from 'pingly';
import { useMemo } from 'react';
import { Card, Row, Toggle } from '../components/Card';
import { useSettings } from '../settings';

export function BrowserPage() {
  const { settings, update } = useSettings();
  const { permission, request } = usePermission();
  const sound = useMemo(() => createSound(), []);

  return (
    <>
      <Card title="Permission" description={`Current permission: ${permission}`}>
        <PermissionPrompt storageKey={false} onResult={(p) => toast.info(`Permission: ${p}`)} />
        {permission === 'denied' && (
          <p className="muted small">
            Notifications are blocked. Re-enable them in your browser's site settings.
          </p>
        )}
        {permission === 'default' && (
          <button onClick={() => void request()}>Ask the browser directly</button>
        )}
      </Card>

      <Card title="What the provider does for new notifications">
        <Row>
          <Toggle
            label="Desktop notifications while this tab is hidden"
            checked={settings.systemNotifications}
            onChange={(v) => update('systemNotifications', v)}
          />
          <Toggle
            label="Play a sound"
            checked={settings.sound}
            onChange={(v) => update('sound', v)}
          />
          <Toggle
            label="Unread count in tab title"
            checked={settings.titleBadge}
            onChange={(v) => update('titleBadge', v)}
          />
          <Toggle
            label="Unread count on favicon"
            checked={settings.faviconBadge}
            onChange={(v) => update('faviconBadge', v)}
          />
        </Row>
        <p className="muted small">
          Tip: start the event stream on the Realtime page, then switch to another tab.
        </p>
      </Card>

      <Card title="Try each piece directly">
        <Row>
          <button
            onClick={async () => {
              const n = await notify({
                title: 'Hello from pingly',
                body: 'This is a desktop notification.',
                onlyWhenHidden: false,
              });
              if (!n) toast.warning('Not shown — permission is not granted.');
            }}
          >
            Desktop notification now
          </button>
          <button
            onClick={async () => {
              if (!(await sound.play()))
                toast.warning('The browser blocked audio. Click anywhere, then try again.');
            }}
          >
            Play chime
          </button>
        </Row>
      </Card>
    </>
  );
}
