import React, { useEffect, useRef } from 'react';

interface DetailModalProps {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function DetailModal({ open, title, children, onClose }: DetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap and ESC to close
  useEffect(() => {
    if (!open) return;
    const focusable = [closeBtnRef.current].filter(Boolean) as HTMLElement[];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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
    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
      <div
        className="sleeve-morphism p-6 rounded-xl shadow-xl max-w-lg w-full relative border border-rarity-uncommon bg-mtg-black"
        ref={modalRef}
        style={{ outline: 'none' }}
      >
        <button
          className="absolute top-2 right-2 text-mtg-white hover:text-mtg-blue text-2xl font-bold focus-visible:ring-2 focus-visible:ring-mtg-blue"
          onClick={onClose}
          aria-label="Close details"
          ref={closeBtnRef}
          style={{ color: '#fff', background: 'transparent' }}
        >
          &times;
        </button>
        {title && <h2 id="detail-modal-title" className="text-xl font-bold mb-4 text-mtg-white">{title}</h2>}
        <div style={{ color: '#fff' }}>{children}</div>
      </div>
    </div>
  );
}
