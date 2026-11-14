import { toast, type ToastPosition } from 'pingly';
import { sleep } from '../backend/chaos';
import { Card, Row, Toggle } from '../components/Card';
import { useSettings } from '../settings';

const POSITIONS: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

async function flakyUpload(): Promise<string> {
  await sleep(1500);
  if (Math.random() < 0.4) throw new Error('The connection was reset');
  return 'report-q3.pdf';
}

export function ToastsPage() {
  const { settings, update } = useSettings();
  return (
    <>
      <Card title="Types" description="Every toast variant, with descriptions and actions.">
        <Row>
          <button onClick={() => toast('Event created')}>Default</button>
          <button
            onClick={() =>
              toast.success('Profile saved', { description: 'Your changes are live.' })
            }
          >
            Success
          </button>
          <button
            onClick={() =>
              toast.error('Upload failed', { description: 'File is larger than 10 MB.' })
            }
          >
            Error
          </button>
          <button onClick={() => toast.info('A new version is available')}>Info</button>
          <button
            onClick={() =>
              toast.warning('Storage almost full', { description: '92% of 5 GB used' })
            }
          >
            Warning
          </button>
          <button
            onClick={() =>
              toast('Message archived', {
                action: { label: 'Undo', onClick: () => toast.success('Message restored') },
              })
            }
          >
            With undo
          </button>
          <button onClick={() => toast('Pinned until you close it', { duration: Infinity })}>
            Persistent
          </button>
        </Row>
      </Card>

      <Card
        title="Async"
        description="Promise toasts and manual updates. The upload fails 40% of the time."
      >
        <Row>
          <button
            onClick={() =>
              toast
                .promise(flakyUpload, {
                  loading: 'Uploading report…',
                  success: (name) => `${name} uploaded`,
                  error: (e) => `Upload failed: ${(e as Error).message}`,
                })
                .catch(() => {})
            }
          >
            Flaky upload
          </button>
          <button
            onClick={async () => {
              const id = toast.loading('Step 1 of 3: preparing…');
              await sleep(900);
              toast.update(id, { title: 'Step 2 of 3: compressing…' });
              await sleep(900);
              toast.update(id, { title: 'Step 3 of 3: sending…' });
              await sleep(900);
              toast.update(id, { type: 'success', title: 'Export finished' });
            }}
          >
            Multi-step update
          </button>
        </Row>
      </Card>

      <Card title="Behaviour" description="Dedupe, custom content, icons and a second toaster.">
        <Row>
          <button onClick={() => toast('Link copied', { dedupeKey: 'copy' })}>
            Dedupe (click fast)
          </button>
          <button onClick={() => toast('Shipped!', { icon: '🚀' })}>Custom icon</button>
          <button
            onClick={() =>
              toast.custom((id) => (
                <div className="custom-toast">
                  <span>🎉 You unlocked the “Early adopter” badge</span>
                  <button onClick={() => toast.dismiss(id)}>Nice</button>
                </div>
              ))
            }
          >
            Fully custom
          </button>
          <button
            onClick={() => toast.info('I live in the top-left toaster', { toasterId: 'side' })}
          >
            Second toaster
          </button>
          <button
            onClick={() => {
              for (let i = 1; i <= 6; i++) toast(`Queued toast ${i}`);
            }}
          >
            Burst of 6 (queue)
          </button>
          <button onClick={() => toast.dismiss()}>Dismiss all</button>
        </Row>
      </Card>

      <Card
        title="Toaster options"
        description="Saved in this browser. Swipe toasts away, hover to pause, Alt+T to focus."
      >
        <Row>
          <label>
            Position{' '}
            <select
              value={settings.position}
              onChange={(e) => update('position', e.target.value as ToastPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <Toggle
            label="Stacked"
            checked={settings.stacked}
            onChange={(v) => update('stacked', v)}
          />
          <Toggle
            label="Rich colors"
            checked={settings.richColors}
            onChange={(v) => update('richColors', v)}
          />
          <Toggle
            label="Progress bar"
            checked={settings.progress}
            onChange={(v) => update('progress', v)}
          />
          <Toggle
            label="Close button"
            checked={settings.closeButton}
            onChange={(v) => update('closeButton', v)}
          />
        </Row>
      </Card>
    </>
  );
}
