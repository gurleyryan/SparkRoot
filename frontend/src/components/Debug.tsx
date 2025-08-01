import React from "react";

export interface DebugPanelProps {
  messages: string[];
  title?: string;
  defaultExpanded?: boolean;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ messages, title = "The Undercurrent", defaultExpanded = false }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  return (
    <div className="mt-4 bg-black/40 rounded-xl p-4 border border-mtg-blue/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-mtg-white/70 font-bold">{title}</div>
        <button
          className="text-xs text-mtg-blue underline hover:text-rarity-rare focus:outline-none"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      {expanded && (
        <div className="max-h-40 overflow-y-auto text-xs text-mtg-white/60 font-mono">
          {messages.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
