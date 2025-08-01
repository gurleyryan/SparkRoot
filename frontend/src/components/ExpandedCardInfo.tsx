import React, { useEffect, useState } from "react";
import type { MTGCard } from '@/types/index';
// Extend MTGCard for Scryfall fields used in this component
type MTGCardExtended = MTGCard & {
  flavor_text?: string;
  artist?: string;
  reserved?: boolean;
  lang?: string;
  illustration_id?: string;
  released_at?: string;
  set_icon_svg_uri?: string;
  icon_svg_uri?: string;
};

interface ExpandedCardInfoProps {
  card: Partial<MTGCardExtended>;
  faces: Array<Partial<MTGCardExtended>>;
  faceIndex: number;
  isDoubleFaced: boolean;
  cardRect: DOMRect;
  borderClass: string;
  onClose: () => void;
  frameOnly?: boolean;
}

interface ExpandedCardInfoProps {
  card: Partial<MTGCardExtended>;
  faces: Array<Partial<MTGCardExtended>>;
  faceIndex: number;
  isDoubleFaced: boolean;
  cardRect: DOMRect;
  borderClass: string;
  onClose: () => void;
  frameOnly?: boolean; // If true, do not render art, only info around the card
}

// Helper to render mana cost as icons
function renderManaCost(manaCost: string | undefined) {
  if (!manaCost) return null;
  // Scryfall mana cost: "{B}{B}{2}{U/P}" etc.
  return manaCost.match(/\{.*?\}/g)?.map((symbol, i) => {
    const clean = symbol.replace(/[{}]/g, '').toLowerCase();
    return <span key={i} className={`ms ms-${clean} ms-cost inline-block align-middle text-lg`} aria-label={clean} />;
  });
}

// Helper to render set icon SVG and code, with rarity color
// (Removed duplicate renderSetIcon function; use RenderSetIcon component and useSetIconSvg hook below)
// Custom hook to get set icon SVG content
function useSetIconSvg(card: Partial<MTGCardExtended>) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    const iconSvg = card.set_icon_svg_uri || card.icon_svg_uri;
    if (iconSvg) {
      fetch(iconSvg)
        .then(res => res.text())
        .then(svg => {
          let recolored = svg.replace(/(<(?!svg)[^>]+)fill="#?[0-9a-fA-F]{3,6}"/g, '$1fill="currentColor"');
          recolored = recolored.replace(/(<svg[^>]*?)fill="currentColor"/i, '$1');
          recolored = recolored.replace(/stroke="#?[0-9a-fA-F]{3,6}"/g, 'stroke="#000"');
          if (!ignore) setSvgContent(recolored);
        });
    } else {
      setSvgContent(null);
    }
    return () => { ignore = true; };
  }, [card.set_icon_svg_uri, card.icon_svg_uri]);
  return svgContent;
}

function RenderSetIcon({ card }: { card: Partial<MTGCardExtended> }) {
  const rarity = (card.rarity || '').toLowerCase();
  let rarityColor = '#231F20';
  if (rarity === 'uncommon') rarityColor = '#BBE2EF';
  else if (rarity === 'rare') rarityColor = '#DCBF7D';
  else if (rarity === 'mythic') rarityColor = '#F8991C';
  const svgContent = useSetIconSvg(card);
  if (svgContent) {
    return (
      <span className="flex items-center gap-1">
        <span
          style={{ width: 24, height: 24, color: rarityColor, display: 'inline-block', verticalAlign: 'middle' }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </span>
    );
  }
  if (card.set) {
    let rarityClass = 'text-rarity-common';
    if (rarity === 'uncommon') rarityClass = 'text-rarity-uncommon';
    else if (rarity === 'rare') rarityClass = 'text-rarity-rare';
    else if (rarity === 'mythic') rarityClass = 'text-rarity-mythic';
    return (
      <span className="flex items-center gap-1">
        <span className={`ss ss-${card.set.toLowerCase()} ss-2x align-middle ${rarityClass}`} title={card.set.toUpperCase()} />
      </span>
    );
  }
  return <span className="ml-1 text-xs text-slate-400 font-mono">{card.set?.toUpperCase() || ''}</span>;
}
function ExpandedCardInfo({ card, faces, faceIndex, isDoubleFaced, cardRect, onClose }: ExpandedCardInfoProps) {
  const infoStyle: React.CSSProperties = {
    position: "fixed",
    left: cardRect.left,
    top: cardRect.top,
    width: cardRect.width,
    height: cardRect.height,
    zIndex: 52,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  };
  // Card content layout
  const face = isDoubleFaced ? faces[faceIndex] : card;

  // Layout: info above, below, left, right, with negative space in the center for the card
  // Use CSS grid for 3x3 layout, center cell is empty (card is visible through)
  return (
    <div style={infoStyle}>
      {/* Click outside to close */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 51,
          background: "transparent",
        }}
        onClick={onClose}
      />
      <div
        className={`absolute left-0 top-0 w-full h-full pointer-events-none`}
        style={{ zIndex: 0 }}
      />
      <div
        className={`relative bg-mtg-black/95 rounded-[28px] p-0 animate-fade-in-up`}
        style={{
          minWidth: cardRect.width + 80,
          maxWidth: 48,
          width: cardRect.width + 48,
          minHeight: cardRect.height + 48,
          height: cardRect.height + 48,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateColumns: 'auto 1fr auto',
          pointerEvents: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top info (name, mana) */}
        <div style={{ gridRow: 1, gridColumn: 2, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 0 24px', minHeight: 48 }}>
          <div className="font-bold text-amber-300 text-xl drop-shadow max-w-[70%]">
            {face?.name || card.name}
          </div>
          <div className="flex-shrink-0 text-right text-lg font-mtg-mono ml-4 flex items-center gap-1">
            {renderManaCost(face?.mana_cost || card.mana_cost)}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-slate-400 hover:text-amber-400 text-xl font-bold z-10"
            aria-label="Close"
            tabIndex={-1}
            style={{ pointerEvents: 'auto', background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>
        {/* Left info (type line, set, rarity, collector) */}
        <div style={{ gridRow: 2, gridColumn: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 8px', minWidth: 80 }}>
          <div className="text-xs text-slate-200 font-mtg-mono text-right mb-1">
            {face?.type_line || card.type_line || ''}
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-400 font-mtg-mono text-right items-end">
            <span className="flex items-center gap-1"><RenderSetIcon card={card} /><span>{card.collector_number || ''}</span></span>
            <span className="uppercase">{card.rarity?.charAt(0)}</span>
          </div>
        </div>
        {/* Center (negative space for card) */}
        <div style={{ gridRow: 2, gridColumn: 2 }} />
        {/* Right info (oracle text, flavor, artist, reserved) */}
        <div style={{ gridRow: 2, gridColumn: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 8px', minWidth: 120, maxWidth: 180 }}>
          <div className="w-full text-xs text-slate-100 whitespace-pre-line mb-1 mt-1" style={{ minHeight: 48 }}>
            {face?.oracle_text || card.oracle_text || ''}
          </div>
          {face?.flavor_text && (
            <div className="w-full text-xs text-slate-400 italic mb-1 mt-1">
              {face.flavor_text}
            </div>
          )}
          <div className="w-full text-xs text-slate-400 mt-1">
            {card.artist ? `Illustrated by ${card.artist}` : ''}
            {card.reserved && <span className="ml-2">Reserved List</span>}
          </div>
        </div>
        {/* Bottom info (stats) */}
        <div style={{ gridRow: 3, gridColumn: 2, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px 12px 24px', minHeight: 32 }}>
          <div className="text-xs text-slate-500 font-mtg-mono">
            {card.lang?.toUpperCase() || 'EN'}
            {card.illustration_id ? ` • ${card.illustration_id}` : ''}
            {card.released_at ? ` • ${card.released_at}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpandedCardInfo;
