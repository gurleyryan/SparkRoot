import React, { useEffect, useRef } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div
        className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-lg w-full relative border border-rarity-uncommon bg-mtg-black"
        ref={modalRef}
        style={{ outline: 'none' }}
      >
        <button
          className="absolute top-4 right-4 text-mtg-white hover:text-mtg-blue focus-visible:ring-2 focus-visible:ring-mtg-blue"
          onClick={onClose}
          aria-label="Close help dialog"
          ref={closeBtnRef}
          style={{ color: '#fff', background: 'transparent' }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id="help-modal-title" className="text-2xl font-bold mb-4 text-mtg-white">Welcome to MTG Deck Optimizer</h2>
        <ol className="list-decimal list-inside text-mtg-white space-y-2 mb-4">
          <li>Sign up or log in to save your collection and decks.</li>
          <li>Upload your card collection (CSV from ManaBox, Moxfield, etc.).</li>
          <li>Browse, search, and filter your collection.</li>
          <li>Use the Deck Builder to generate optimized Commander decks.</li>
          <li>Track card prices and collection value in the Pricing section.</li>
          <li>Customize your playmat and preferences in Settings.</li>
        </ol>
        <div className="text-mtg-blue font-mtg-body text-sm mt-4">
          Need more help? Contact support or check the [README](https://github.com/gurleyryan/MTG-Deck-Optimizer).
        </div>
      </div>
    </div>
  );
}
