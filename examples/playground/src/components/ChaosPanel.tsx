import { useState, useSyncExternalStore } from 'react';
import { toast, useConnectionStatus } from 'pingly';
import { chaos } from '../backend/chaos';
import { server } from '../backend/server';
import { clearSettings } from '../persist';
import { inbox } from '../stores';

interface ChaosPanelProps {
  onCrash: () => void;
}

/** Controls that make the fake backend slow, flaky or unreachable. */
export function ChaosPanel({ onCrash }: ChaosPanelProps) {
  const state = useSyncExternalStore(chaos.subscribe, chaos.get);
  const status = useConnectionStatus();
  const [open, setOpen] = useState(false);
  const troubled = state.offline || state.failureRate > 0 || state.latency > 1000;

  return (
    <aside className="chaos" data-open={open || undefined}>
      <button
        className="chaos-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-troubled={troubled || undefined}
      >
        🧪 Chaos {troubled ? '· active' : ''}
      </button>
      {open && (
        <div className="chaos-body">
          <p className="muted">Make the fake backend misbehave and watch the UI recover.</p>
          <label>
            Latency: <strong>{state.latency} ms</strong>
            <input
              type="range"
              min={0}
              max={3000}
              step={50}
              value={state.latency}
              onChange={(e) => chaos.set({ latency: Number(e.target.value) })}
            />
          </label>
          <label>
            Failure rate: <strong>{Math.round(state.failureRate * 100)}%</strong>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.failureRate}
              onChange={(e) => chaos.set({ failureRate: Number(e.target.value) })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.offline}
              onChange={(e) => {
                chaos.set({ offline: e.target.checked });
                if (e.target.checked) server.dropConnections();
              }}
            />
            Server unreachable
          </label>
          <div className="chaos-actions">
            <button onClick={() => chaos.set({ failNext: true })} disabled={state.failNext}>
              {state.failNext ? 'Next call will fail…' : 'Fail next API call'}
            </button>
            <button onClick={() => server.dropConnections()}>Drop connections</button>
            <button onClick={onCrash}>Crash this page</button>
            <button
              onClick={() => {
                server.resetData();
                inbox.reset();
                void inbox.load();
                toast('Demo data reset');
              }}
            >
              Reset demo data
            </button>
            <button
              onClick={() => {
                chaos.reset();
                clearSettings();
                window.location.reload();
              }}
            >
              Reset everything
            </button>
          </div>
          <p className="muted small">
            Client: <strong>{status}</strong> · open server connections: {server.openConnections}
          </p>
        </div>
      )}
    </aside>
  );
}
