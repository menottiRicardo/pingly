import { useState } from 'react';
import { ConnectionStatus, useNotificationClient, useNotificationEvent } from 'pingly';
import { TRANSPORTS, type TransportKind } from '../backend/client';
import {
  EVENT_TYPES,
  type AppEvents,
  type ClientMessages,
  type EventType,
} from '../backend/events';
import { publishRandom, samplePayload } from '../backend/random';
import { server } from '../backend/server';
import { Card, Row, Toggle } from '../components/Card';
import { EventLog } from '../components/EventLog';
import { useSettings } from '../settings';

export function RealtimePage() {
  const { settings, update } = useSettings();
  const client = useNotificationClient<AppEvents, ClientMessages>();
  const [type, setType] = useState<EventType>('comment.created');
  const [payload, setPayload] = useState(() =>
    JSON.stringify(samplePayload('comment.created'), null, 2),
  );
  const [payloadError, setPayloadError] = useState('');
  const [presence, setPresence] = useState<ClientMessages['presence.update']['status']>('online');
  const [lastSend, setLastSend] = useState('');
  const [revenue, setRevenue] = useState(0);

  // Typed subscription: `p.amount` is a number, checked by TypeScript.
  useNotificationEvent<AppEvents, 'invoice.paid'>('invoice.paid', (p) =>
    setRevenue((r) => r + p.amount),
  );

  const chooseType = (next: EventType) => {
    setType(next);
    setPayload(JSON.stringify(samplePayload(next), null, 2));
    setPayloadError('');
  };

  const publish = () => {
    try {
      server.publish(type, JSON.parse(payload) as AppEvents[typeof type]);
      setPayloadError('');
    } catch (e) {
      setPayloadError((e as Error).message);
    }
  };

  return (
    <>
      <Card
        title="Connection"
        description="Switch transports; each one runs pingly's real transport code against the fake server."
      >
        <Row>
          {TRANSPORTS.map((t) => (
            <label key={t.id} className="radio" title={t.description}>
              <input
                type="radio"
                name="transport"
                checked={settings.transport === t.id}
                onChange={() => update('transport', t.id as TransportKind)}
              />
              {t.label}
            </label>
          ))}
        </Row>
        <p className="muted small">
          {TRANSPORTS.find((t) => t.id === settings.transport)?.description}
        </p>
        <Row>
          <ConnectionStatus />
          <button onClick={() => client.reconnect()}>Reconnect</button>
          <button
            onClick={() =>
              client.getStatus() === 'closed' ? client.connect() : client.disconnect()
            }
          >
            {client.getStatus() === 'closed' ? 'Connect' : 'Disconnect'}
          </button>
          <button onClick={() => server.dropConnections()}>Drop (server restart)</button>
        </Row>
      </Card>

      <Card
        title="Publish events"
        description="Events are stored on the server, so anything sent while you're disconnected is replayed when you reconnect."
      >
        <Row>
          <button onClick={() => publishRandom()}>Random event</button>
          <Toggle
            label="Stream"
            checked={settings.streaming}
            onChange={(v) => update('streaming', v)}
          />
          <label>
            every{' '}
            <select
              value={settings.streamEveryMs}
              onChange={(e) => update('streamEveryMs', Number(e.target.value))}
            >
              {[1000, 2000, 4000, 8000].map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000}s
                </option>
              ))}
            </select>
          </label>
        </Row>
        <div className="composer">
          <label>
            Type
            <select value={type} onChange={(e) => chooseType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Payload (JSON)
            <textarea
              rows={6}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
            />
          </label>
          {payloadError && <p className="error small">{payloadError}</p>}
          <Row>
            <button onClick={publish}>Publish</button>
            <button
              onClick={() => {
                setType('invoice.paid');
                setPayload(
                  JSON.stringify(
                    { invoiceId: 'INV-BAD', amount: 'lots', currency: 'USD' },
                    null,
                    2,
                  ),
                );
              }}
            >
              Load an invalid payload
            </button>
          </Row>
          <p className="muted small">
            Invalid payloads are rejected by the client's runtime validation and show in the log.
          </p>
        </div>
      </Card>

      <Card
        title="Send to the server"
        description="Typed client → server messages. Only WebSocket can send; others queue them."
      >
        <Row>
          <select value={presence} onChange={(e) => setPresence(e.target.value as typeof presence)}>
            <option>online</option>
            <option>away</option>
            <option>busy</option>
          </select>
          <button
            onClick={() => {
              const sent = client.send('presence.update', { status: presence });
              setLastSend(
                sent
                  ? 'Sent'
                  : settings.transport === 'websocket'
                    ? 'Queued — sends as soon as the socket reconnects'
                    : 'Queued — SSE and polling are receive-only, so this stays queued',
              );
            }}
          >
            Send presence
          </button>
          {lastSend && <span className="muted small">{lastSend}</span>}
        </Row>
        <p className="muted small">
          Revenue from <code>invoice.paid</code> this session (typed subscription):{' '}
          <strong>
            {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
              revenue,
            )}
          </strong>
        </p>
      </Card>

      <EventLog />
    </>
  );
}
