"use client";

import React, { useState, useRef, useEffect } from "react";

export interface CardProps {
  card: any;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, className = "" }) => {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);

  // Calculate popover position on expand
  useEffect(() => {
    if (expanded && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setPopoverPos({
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
      });
    }
  }, [expanded]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [expanded]);

  const rarity = (card.rarity || '').toLowerCase();
  let borderClass = 'border-slate-700';
  if (rarity === 'common') borderClass = 'border-rarity-common';
  else if (rarity === 'uncommon') borderClass = 'border-rarity-uncommon';
  else if (rarity === 'rare') borderClass = 'border-rarity-rare';
  else if (rarity === 'mythic') borderClass = 'border-rarity-mythic';

  return (
    <div ref={cardRef} className={`relative ${className}`} tabIndex={0}>
      <button
        type="button"
        className={`block rounded-xl border-4 ${borderClass} p-2 hover:bg-card-black transition group text-left w-full focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg`}
        title={card.name}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            className="rounded w-full mb-2 shadow group-hover:scale-105 transition-transform"
            style={{ aspectRatio: "3/4", objectFit: "cover" }}
          />
        ) : (
          <div className="w-full h-32 flex items-center justify-center bg-slate-800 rounded mb-2 text-xs text-slate-500">
            No image
          </div>
        )}
        <div className="font-semibold text-amber-300 text-xs mb-1 truncate" title={card.name}>
          {card.name}
        </div>
        <div className="text-xs text-slate-400 mb-1 truncate" title={card.type_line}>
          {card.type_line}
        </div>
        <div className="text-xs text-slate-200 line-clamp-3" title={card.oracle_text}>
          {card.oracle_text}
        </div>
      </button>
      {expanded && popoverPos && (
        <div
          className="absolute z-50 bg-mtg-black rounded-lg shadow-2xl border border-rarity-mythic p-4 min-w-[320px] max-w-xs sm:max-w-sm text-left animate-fade-in"
          style={{
            left: 0,
            top: "100%",
            marginTop: 8,
            width: "max-content",
            minWidth: 320,
            maxWidth: 360,
          }}
        >
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-amber-400 text-xl font-bold"
            aria-label="Close"
            tabIndex={-1}
          >
            ×
          </button>
          <div className="flex gap-4">
            {card.image && (
              <img
                src={card.image}
                alt={card.name}
                className="rounded w-20 h-auto self-center shadow"
                style={{ maxHeight: "140px" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-300 mb-1">{card.name}</div>
              <div className="text-xs text-slate-300 mb-1 truncate" title={card.type_line}>{card.type_line}</div>
              <div className="text-xs text-slate-100 whitespace-pre-line mb-1 line-clamp-4" title={card.oracle_text}>{card.oracle_text}</div>
              {card.flavor_text && (
                <div className="text-xs text-slate-400 mb-1 italic">{card.flavor_text}</div>
              )}
              {card.artist && (
                <div className="text-xs text-slate-400 mb-1 truncate">Illustrated by {card.artist}</div>
              )}
              {card.reserved && (
                <div className="text-xs text-slate-400 mb-1 truncate">Reserved List</div>
              )}
              {/* Add more details as needed */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;
