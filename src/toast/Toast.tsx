import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { store } from './instance';
import { CLOSE_ICON, TOAST_ICONS, cx, toastRole } from './dom';
import type { ToastData } from './types';

export interface ToastProps {
  toast: ToastData<ReactNode>;
  closeButton?: boolean;
}

export function Toast({ toast, closeButton = false }: ToastProps) {
  const { id, type, title, description, action, dismissible, className, state } = toast;
  const icon = TOAST_ICONS[type];

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key === 'Escape' && dismissible) store.dismiss(id);
  };

  const onAction = (event: MouseEvent<HTMLButtonElement>) => {
    action?.onClick(event);
    if (!event.defaultPrevented) store.dismiss(id);
  };

  return (
    <li
      className={cx('pingly-toast', className)}
      role={toastRole(type)}
      aria-atomic="true"
      data-type={type}
      data-state={state}
      onKeyDown={onKeyDown}
    >
      {icon && (
        <span
          className="pingly-icon"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      )}
      <div className="pingly-content">
        <div className="pingly-title">{title}</div>
        {description != null && <div className="pingly-description">{description}</div>}
      </div>
      {action && (
        <button type="button" className="pingly-action" onClick={onAction}>
          {action.label}
        </button>
      )}
      {closeButton && dismissible && (
        <button
          type="button"
          className="pingly-close"
          aria-label="Close notification"
          onClick={() => store.dismiss(id)}
          dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
        />
      )}
    </li>
  );
}
