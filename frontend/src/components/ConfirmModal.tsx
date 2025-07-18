import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap and ESC to close
  useEffect(() => {
    if (!open) return;
    const focusable = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean) as HTMLElement[];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus cancel button by default
    setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 0);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-desc">
      <div
        className="sleeve-morphism p-6 rounded-xl shadow-xl max-w-sm w-full border border-rarity-uncommon bg-mtg-black"
        ref={modalRef}
        style={{ outline: 'none' }}
      >
        {title && <h2 id="confirm-modal-title" className="text-xl font-bold mb-4 text-mtg-white">{title}</h2>}
        <div id="confirm-modal-desc" className="mb-6 text-mtg-white" style={{ color: '#fff' }}>{message}</div>
        <div className="flex justify-end gap-4">
          <button
            className="btn-secondary focus-visible:ring-2 focus-visible:ring-mtg-blue"
            onClick={onCancel}
            ref={cancelBtnRef}
            style={{ color: '#fff', backgroundColor: '#444' }}
          >
            {cancelText}
          </button>
          <button
            className="btn-primary focus-visible:ring-2 focus-visible:ring-mtg-blue"
            onClick={onConfirm}
            ref={confirmBtnRef}
            style={{ color: '#fff', backgroundColor: '#1e40af' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
