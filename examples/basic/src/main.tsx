import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'pingly';
import type { ToastPosition, ToastTheme } from 'pingly';
import 'pingly/styles.css';

const positions: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [position, setPosition] = useState<ToastPosition>('bottom-right');
  const [theme, setTheme] = useState<ToastTheme>('light');

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 640 }}>
      <h1>pingly</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => toast('Event created')}>Default</button>
        <button
          onClick={() => toast.success('Profile saved', { description: 'Changes are live.' })}
        >
          Success
        </button>
        <button onClick={() => toast.error('Upload failed', { description: 'File is too large.' })}>
          Error
        </button>
        <button onClick={() => toast.info('New version available')}>Info</button>
        <button onClick={() => toast.warning('Storage almost full')}>Warning</button>
        <button
          onClick={() =>
            toast.promise(
              wait(1500).then(() => 'report.pdf'),
              {
                loading: 'Generating report…',
                success: (name) => `${name} is ready`,
                error: 'Could not generate report',
              },
            )
          }
        >
          Promise
        </button>
        <button
          onClick={() =>
            toast('Message archived', {
              action: { label: 'Undo', onClick: () => toast.success('Restored') },
            })
          }
        >
          With action
        </button>
        <button onClick={() => toast.dismiss()}>Dismiss all</button>
      </div>

      <p>
        <label>
          Position{' '}
          <select value={position} onChange={(e) => setPosition(e.target.value as ToastPosition)}>
            {positions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          Theme{' '}
          <select value={theme} onChange={(e) => setTheme(e.target.value as ToastTheme)}>
            <option>light</option>
            <option>dark</option>
            <option>system</option>
          </select>
        </label>
      </p>

      <Toaster position={position} theme={theme} closeButton />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
