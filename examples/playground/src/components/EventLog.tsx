import { useEffect, useState } from 'react';
import { useNotificationClient } from 'pingly';
import type { AppEvents, ClientMessages } from '../backend/events';
import { server } from '../backend/server';

interface Entry {
  key: number;
  at: number;
  kind: 'event' | 'status' | 'error' | 'sent';
  text: string;
}

let key = 0;

/** Live log of everything the client sees: events, status changes, errors and sent messages. */
export function EventLog() {
  const client = useNotificationClient<AppEvents, ClientMessages>();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const add = (kind: Entry['kind'], text: string) =>
      setEntries((prev) => [{ key: ++key, at: Date.now(), kind, text }, ...prev].slice(0, 60));
    const offs = [
      client.onAny((e) => add('event', `${e.type} ${e.id ?? ''}\n${JSON.stringify(e.payload)}`)),
      client.onStatus((s) => add('status', `status → ${s}`)),
      client.onError((e) =>
        add(
          'error',
          `${e.reason}: ${e.error instanceof Error ? e.error.message : String(e.error)}`,
        ),
      ),
      server.onMessage((m) => add('sent', `server received ${JSON.stringify(m.data)}`)),
    ];
    return () => offs.forEach((off) => off());
  }, [client]);

  return (
    <div className="log">
      <div className="log-head">
        <strong>Event log</strong>
        <button onClick={() => setEntries([])} disabled={!entries.length}>
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="muted small">Nothing yet. Publish an event or drop the connection.</p>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.key} data-kind={e.kind}>
              <time>{new Date(e.at).toLocaleTimeString()}</time>
              <pre>{e.text}</pre>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
