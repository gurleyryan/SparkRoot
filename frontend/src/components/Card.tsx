"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import AuraFrame from "./AuraFrame";
import ExpandedCardInfo from "./ExpandedCardInfo";
import type { MTGCard } from "@/types/index";

// Extend MTGCard locally to allow card_faces and image for compatibility
export type MTGCardWithFaces = MTGCard & {
  card_faces?: Array<Partial<MTGCard> & { image_uris?: { normal?: string; large?: string } }>;
  image?: string;
};

export interface CardProps {
  card: MTGCardWithFaces;
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
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);

  // When expanded, capture the card's bounding rect for overlay positioning
  useEffect(() => {
    if (expanded && cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    } else {
      setCardRect(null);
    }
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
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
  let faces: Partial<MTGCardWithFaces>[] = [];
  if (card.card_faces && Array.isArray(card.card_faces) && card.card_faces[0]?.image_uris) {
    faces = card.card_faces;
    isDoubleFaced = faces.length > 1 && Boolean(faces[0]?.image_uris) && Boolean(faces[1]?.image_uris);
    imageUrl = faces[faceIndex]?.image_uris?.normal || faces[faceIndex]?.image_uris?.large;
  } else if (card.image_uris) {
    imageUrl = card.image_uris.normal || card.image_uris.large;
  } else if (card.image) {
    imageUrl = card.image;
  }

  // Single click: expand/collapse for single-faced, flip for DFC (even when expanded)
  const handleCardClick = () => {
    if (isDoubleFaced) {
      // If expanded, only flip face, do not close overlay
      setFaceIndex((prev) => (prev === 0 ? 1 : 0));
    } else {
      setExpanded((v) => !v);
    }
  };

  // Double click: expand/collapse for DFC
  const handleCardDoubleClick = () => {
    if (isDoubleFaced) {
      setExpanded((v) => !v);
    }
    // For single-faced, do nothing (single click already handles expand/collapse)
  };

  // Compute classes for the card image wrapper: pop out if hovered or expanded
  const popOutClass = expanded ? 'scale-105 border-8' : '';

  return (
    <div ref={cardRef} className={`relative ${className}`} tabIndex={0}>
      <button
        type="button"
        className={`block rounded-[28px] hover:bg-card-black transition-colors transition-transform duration-200 group text-left w-full focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg`}
        title={card.name}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
        aria-expanded={expanded}
      >
        <div
          className={`relative rounded-[25px] border-4 ${borderClass} transition-all duration-200 w-full group-hover:scale-105 group-hover:border-8 ${popOutClass}`}
          style={{ boxSizing: 'border-box', cursor: isDoubleFaced ? 'pointer' : undefined }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={card.name}
              width={488}
              height={680}
              className="rounded-[21px] w-full shadow transition-transform duration-200"
              sizes="(max-width: 768px) 100vw, 300px"
              priority={false}
            />
          ) : (
            <div className="w-full h-32 flex items-center justify-center bg-slate-800 rounded-[21px] text-xs text-slate-500">
              No image
            </div>
          )}
          {/* Only show face label if there is no image for this face */}
          {isDoubleFaced && !imageUrl && (
            <div className="absolute bottom-2 right-2 bg-mtg-black/80 text-xs text-amber-300 px-2 py-1 rounded shadow pointer-events-none select-none">
              {faceIndex === 0 ? faces[0]?.name || 'Front' : faces[1]?.name || 'Back'}
            </div>
          )}
        </div>
      </button>
      {/* Aura and expanded info overlays (no card image, only info around the card) */}
      {expanded && cardRect && (
        <>
          <AuraFrame cardRect={cardRect} borderClass={borderClass} />
          <ExpandedCardInfo
            card={card}
            faces={faces}
            faceIndex={faceIndex}
            isDoubleFaced={isDoubleFaced}
            cardRect={cardRect}
            borderClass={borderClass}
            onClose={() => setExpanded(false)}
            // New prop to indicate "frame only" mode (no art)
            frameOnly={true}
          />
        </>
      )}
    </div>
  );
};

export default Card;
