"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";

export interface CardProps {
  card: any;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, className = "" }) => {
  // Debug: log card data to inspect Tergrid and DFCs
  if (typeof window !== 'undefined') {
    // Only log in browser, not SSR
    console.log('Card debug:', card);
  }
  const [expanded, setExpanded] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0); // 0 = front, 1 = back (for DFCs)
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverShift, setPopoverShift] = useState(0);

  // Calculate popover horizontal shift to keep it in viewport
  useEffect(() => {
    if (expanded && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const popoverWidth = 360; // maxWidth of popover
      const padding = 16; // px from edge
      let shift = 0;
      if (rect.left + popoverWidth / 2 > window.innerWidth - padding) {
        shift = rect.left + popoverWidth / 2 - (window.innerWidth - padding);
      } else if (rect.left + rect.width / 2 - popoverWidth / 2 < padding) {
        shift = rect.left + rect.width / 2 - popoverWidth / 2 - padding;
      }
      setPopoverShift(shift);
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

  // Always prefer card_faces if present, then image_uris, then image
  let imageUrl = undefined;
  let isDoubleFaced = false;
  let faces = [];
  if (card.card_faces && Array.isArray(card.card_faces) && card.card_faces[0]?.image_uris) {
    faces = card.card_faces;
    isDoubleFaced = faces.length > 1 && faces[0]?.image_uris && faces[1]?.image_uris;
    imageUrl = faces[faceIndex]?.image_uris?.normal || faces[faceIndex]?.image_uris?.large;
  } else if (card.image_uris) {
    imageUrl = card.image_uris.normal || card.image_uris.large;
  } else if (card.image) {
    imageUrl = card.image;
  }

  // Handle click: flip for DFC, expand for normal
  const handleCardClick = (e: React.MouseEvent) => {
    if (isDoubleFaced) {
      setFaceIndex((prev) => (prev === 0 ? 1 : 0));
    } else {
      setExpanded((v) => !v);
    }
  };

  // Double click always expands (for both types)
  const handleCardDoubleClick = (e: React.MouseEvent) => {
    setExpanded((v) => !v);
  };

  return (
    <div ref={cardRef} className={`relative ${className}`} tabIndex={0}>
      <button
        type="button"
        className={`block rounded-[28px] border-4 ${borderClass} hover:bg-card-black transition group text-left w-full focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg`}
        title={card.name}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
        aria-expanded={expanded}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={card.name}
            width={488}
            height={680}
            className="rounded-[25px] w-full shadow group-hover:scale-105 transition-transform"
            sizes="(max-width: 768px) 100vw, 300px"
            priority={false}
          />
        ) : (
          <div className="w-full h-32 flex items-center justify-center bg-slate-800 rounded-[25px] text-xs text-slate-500">
            No image
          </div>
        )}
        {isDoubleFaced && (
          <div className="absolute bottom-2 right-2 bg-mtg-black/80 text-xs text-amber-300 px-2 py-1 rounded shadow pointer-events-none select-none">
            {faceIndex === 0 ? faces[0]?.name || 'Front' : faces[1]?.name || 'Back'}
          </div>
        )}
      </button>
      {expanded && (
        <div
          className="absolute left-1/2 top-1/2 z-40"
          style={{
            transform: `translate(-50%, -50%) translateX(${-popoverShift}px)`,
            minWidth: 320,
            maxWidth: 360,
            width: 'max-content',
            pointerEvents: 'auto',
          }}
        >
          <div
            className="bg-mtg-black border-4 border-rarity-mythic rounded-[25px] shadow-2xl p-6 text-left flex gap-4 animate-fade-in-up"
            style={{
              boxShadow: '0 0 32px 8px rgba(248,153,28,0.25), 0 0 0 8px rgba(248,153,28,0.10)',
              filter: 'drop-shadow(0 0 32px #F8991C88)',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 right-2 text-slate-400 hover:text-amber-400 text-xl font-bold"
              aria-label="Close"
              tabIndex={-1}
              style={{ pointerEvents: 'auto' }}
            >
              ×
            </button>
            {card.image && (
              <Image
                src={card.image}
                alt={card.name}
                width={120}
                height={168}
                className="rounded-[8px] w-24 h-auto self-center shadow-lg border-2 border-rarity-mythic"
                style={{ maxHeight: "180px" }}
                sizes="120px"
                priority={false}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-300 mb-1 text-lg drop-shadow">{card.name}</div>
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
