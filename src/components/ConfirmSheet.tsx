import type { ReactNode } from 'react';
import Button from './Button';
import Sheet from './Sheet';

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content rendered above the buttons (e.g. a text input). */
  children?: ReactNode;
}

/** A two-button confirmation sheet. Never a centred modal. */
export default function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} title={title} danger={danger}>
      {message ? (
        <p className="mb-4 text-center text-[16px] leading-snug" style={{ color: 'var(--ink-dim)' }}>
          {message}
        </p>
      ) : null}
      {children}
      <div className="mt-5 flex flex-col gap-3">
        <Button
          full
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'One moment…' : confirmLabel}
        </Button>
        <Button full variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
