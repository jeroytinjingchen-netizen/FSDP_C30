import { useEffect, useRef, useState } from 'react';
import { AlertCircleIcon, CheckCircleIcon, XIcon } from './Icons.jsx';

export const cn = (...parts) => parts.filter(Boolean).join(' ');

export const inputClass =
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-input bg-card text-foreground hover:bg-muted',
  danger: 'bg-destructive-solid text-on-destructive hover:opacity-90',
  ghost: 'text-foreground hover:bg-muted',
};

export function Button({ variant = 'primary', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

const iconTones = {
  default: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  warning: 'text-muted-foreground hover:bg-warning-soft hover:text-warning',
  success: 'text-muted-foreground hover:bg-accent-soft hover:text-accent-text',
  danger: 'text-muted-foreground hover:bg-destructive-soft hover:text-destructive',
};

export function IconButton({ label, tone = 'default', className, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg transition-colors duration-200',
        iconTones[tone],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, optional, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-foreground">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

export function StatusBadge({ active }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        active ? 'bg-accent-soft text-accent-text' : 'bg-muted text-muted-foreground'
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', active ? 'bg-current' : 'border border-current')}
      />
      {active ? 'Active' : 'Archived'}
    </span>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon size={24} />
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 4, cols }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="border-t" aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${55 + ((r + c) % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  ));
}

export function Toast({ alert, onDismiss }) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => dismissRef.current(), 5000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!alert) return null;
  const Icon = alert.error ? AlertCircleIcon : CheckCircleIcon;
  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] flex justify-end sm:left-auto">
      <div
        role={alert.error ? 'alert' : 'status'}
        className={cn(
          'animate-toast-in flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card p-3.5 text-sm shadow-lg sm:w-auto',
          alert.error ? 'border-destructive' : 'border-accent'
        )}
      >
        <span className={alert.error ? 'text-destructive' : 'text-accent-text'}>
          <Icon size={20} />
        </span>
        <p className="flex-1 font-medium text-foreground">{alert.text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ labelledBy, onClose, children, className }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (panel.querySelector('[data-autofocus]') || panel.querySelector(FOCUSABLE))?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panel.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-scrim p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn('animate-dialog-in w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl', className)}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <Modal labelledBy="confirm-title" onClose={onCancel}>
      <h2 id="confirm-title" className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} data-autofocus>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

