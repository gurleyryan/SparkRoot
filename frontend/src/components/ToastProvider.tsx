"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

export interface Toast {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast["type"] = "info", duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="sleeve-morphism fixed z-50 top-6 right-6 flex flex-col gap-3 items-end pointer-events-none" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-6 py-3 rounded-xl shadow-2xl font-mtg-mono text-base pointer-events-auto transition-all duration-300
              border-2 border-mtg-blue/60
              ${toast.type === "success"
                ? "bg-mtg-black/90 text-mtg-green border-mtg-green/70"
                : toast.type === "error"
                ? "bg-mtg-black/90 text-mtg-red border-mtg-red/70"
                : "bg-mtg-black/90 text-mtg-blue border-mtg-blue/70"}
              backdrop-blur-md
            `}
            role="alert"
            aria-live="assertive"
            style={{ minWidth: '260px', maxWidth: '400px', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.45)' }}
          >
            <span className="font-bold tracking-wide mr-2">
              {toast.type === "success" ? "✔" : toast.type === "error" ? "✖" : "ℹ"}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx.showToast;
}
