"use client";

import React from "react";
import Card from "./Card";
import { MTGCardWithFaces } from "./Card"; // Adjust the path if MTGCardWithFaces is defined elsewhere

export interface CardGridProps {
  cards: any[];
  className?: string;
}

const CardGrid: React.FC<{ cards: MTGCardWithFaces[]; className?: string }> = ({
  cards,
  className = "",
}) => {
  return (
    <div
      className={
        `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-screen max-w-none px-0 ` +
        className
      }
    >
      {cards.map((card, idx) => (
        <Card key={card.id || card.name || idx} card={card} />
      ))}
    </div>
  );
};

export default CardGrid;
