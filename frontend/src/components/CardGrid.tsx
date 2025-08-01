"use client";
import React from "react";
import Card from "./Card";
import { MTGCard } from "@/types/index";

export interface CardGridProps {
  cards: MTGCard[];
  className?: string;
  showBasicLands?: boolean;
}

// Helper to detect basic lands
function isBasicLand(card: MTGCard) {
  if (!card || !card.type_line) return false;
  // Scryfall type_line for basic lands always includes 'Basic Land'
  return card.type_line.toLowerCase().includes('basic land');
}

const CardGrid: React.FC<CardGridProps> = ({
  cards,
  className = "",
  showBasicLands = true,
}) => {
  return (
    <div
      className={
        `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-screen max-w-none px-0 ` +
        className
      }
    >
      {cards.map((card, idx) => (
        <div
          key={card.id || card.name || idx}
          style={isBasicLand(card) && !showBasicLands ? { display: 'none' } : {}}
        >
          <Card card={card} quantity={card.quantity} />
        </div>
      ))}
    </div>
  );
};

export default CardGrid;
