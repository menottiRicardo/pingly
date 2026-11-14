import { Alert, Banner, banner, toast, useBanners } from 'pingly';
import { useState } from 'react';
import { Card, Row } from '../components/Card';
import { useSettings } from '../settings';

export function BannersPage() {
  const { update } = useSettings();
  const banners = useBanners();
  const [alertOpen, setAlertOpen] = useState(true);

  return (
    <>
      <Card title="Page banners" description="Shown at the top of the app, highest priority first.">
        <Row>
          <button onClick={() => banner.info('Scheduled maintenance Sunday 02:00 UTC')}>
            Info
          </button>
          <button
            onClick={() =>
              banner.error('Your card was declined', {
                priority: 10,
                description: 'Update your payment method to avoid interruption.',
                action: { label: 'Update card', onClick: () => toast('Opening billing…') },
              })
            }
          >
            Urgent (priority 10)
          </button>
          <button
            onClick={() => {
              const start = Date.now() + 5_000;
              banner.warning('Flash sale: 20% off for 10 seconds', {
                startsAt: start,
                endsAt: start + 10_000,
              });
              toast.info('Scheduled: appears in 5s, disappears 10s later');
            }}
          >
            Scheduled
          </button>
          <button
            onClick={() =>
              banner.success('We use cookies to keep you signed in.', { dismissKey: 'cookies' })
            }
          >
            Remembered dismissal
          </button>
          <button onClick={() => banner.forget('cookies')}>Forget dismissal</button>
          <button onClick={() => banner.clear()}>Clear all</button>
        </Row>
        <p className="muted small">
          {banners.length} banner(s) in the queue, including scheduled ones.
        </p>
      </Card>

      <Card title="Standalone banner">
        <Banner
          variant="neutral"
          action={{ label: 'Try it', onClick: () => update('theme', 'dark') }}
        >
          New: dark mode is here
        </Banner>
      </Card>

      <Card title="Inline alerts">
        <div className="stack">
          <Alert variant="info" title="Heads up">
            Your trial ends in 3 days.
          </Alert>
          <Alert variant="success" title="Backup complete" />
          <Alert
            variant="warning"
            title="Unusual sign-in"
            actions={<button className="pingly-button">Review</button>}
          >
            We noticed a sign-in from a new device.
          </Alert>
          {alertOpen ? (
            <Alert variant="error" title="Sync failed" onDismiss={() => setAlertOpen(false)}>
              We'll retry automatically.
            </Alert>
          ) : (
            <button onClick={() => setAlertOpen(true)}>Bring back the error alert</button>
          )}
          <Alert variant="neutral" role="none" title="Static note">
            role="none" keeps static content from being announced.
          </Alert>
        </div>
      </Card>
    </>
  );
}
