"use client";
import React, { useState } from "react";
import HelpModal from "@/components/HelpModal";

export default function HelpPage() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <HelpModal open={open} onClose={() => setOpen(false)} />
      {!open && (
        <button
          className="btn-primary mt-8"
          onClick={() => setOpen(true)}
          aria-label="Show help dialog"
        >
          Show Help
        </button>
      )}
    </div>
  );
}
