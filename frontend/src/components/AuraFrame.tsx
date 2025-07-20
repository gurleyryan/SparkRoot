import React from "react";

interface AuraFrameProps {
  cardRect: DOMRect;
  borderClass: string;
}

// This component renders a glowing aura border around the card, matching its rarity
const AuraFrame: React.FC<AuraFrameProps> = ({ cardRect, borderClass }) => {
  if (!cardRect) return null;
  // Aura is 72px larger than card on all sides, absolutely positioned so it moves with the card
  const auraStyle: React.CSSProperties = {
    position: "fixed",
    left: (cardRect.left),
    top: (cardRect.top),
    width: cardRect.width,
    height: cardRect.height,
    pointerEvents: "none",
    zIndex: 51,
    borderRadius: 28,
    animation: "aura-pulse 2.5s infinite alternate",
  };
  // Map borderClass to color variable
  const borderColorVars: Record<string, string> = {
    "border-rarity-common": "#231F20",
    "border-rarity-uncommon": "#BBE2EF",
    "border-rarity-rare": "#DCBF7D",
    "border-rarity-mythic": "#F8991C",
  };
  const borderColor = borderColorVars[borderClass] || "#231F20";
  return (
    <div
      style={{
        ...auraStyle,
        borderColor,
        boxShadow: `0 0 64px 32px ${borderColor}88, 0 0 0 24px ${borderColor}44`,
      }}
      className="aura-glow"
    />
  );
};

export default AuraFrame;
