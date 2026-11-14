import type { ReactNode } from 'react';
import { ICONS } from '../shared/icons';
import type { AnyInbox } from './InboxContext';
import type { InboxLabels } from './labels';
import { useInboxStore, useUnreadCount } from './useInbox';

export interface InboxHeaderProps {
  titleId: string;
  labels: InboxLabels;
  inbox?: AnyInbox;
  onSettings?: () => void;
  headingLevel?: 2 | 3;
  extra?: ReactNode;
}

export function InboxHeader({
  titleId,
  labels,
  inbox,
  onSettings,
  headingLevel = 2,
  extra,
}: InboxHeaderProps) {
  const store = useInboxStore(inbox);
  const unread = useUnreadCount(store);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="pingly-panel-header">
      <Heading id={titleId} className="pingly-panel-title">
        {labels.title}
      </Heading>
      <div className="pingly-panel-tools">
        {extra}
        <button
          type="button"
          className="pingly-text-button"
          disabled={unread === 0}
          onClick={() => void store.markAllRead()}
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS.checkAll }} />
          {labels.markAllRead}
        </button>
        {onSettings && (
          <button
            type="button"
            className="pingly-icon-button"
            aria-label={labels.settings}
            title={labels.settings}
            onClick={onSettings}
            dangerouslySetInnerHTML={{ __html: ICONS.settings }}
          />
        )}
      </div>
    </div>
  );
}
