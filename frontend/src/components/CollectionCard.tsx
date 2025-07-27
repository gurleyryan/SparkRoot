"use client";
import React from "react";
import { Collection } from "../types";

export interface CollectionCardProps {
  collection: Collection;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  className?: string;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  selected = false,
  onSelect,
  onOpen,
  className = "",
}) => {
  return (
    <div
      className={`sleeve-morphism shadow-md p-4 flex flex-col gap-2 cursor-pointer transition-all duration-150 hover:scale-101 ${selected ? "ring-2 ring-mtg-blue" : ""} ${className}`}
      style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}
      onClick={() => onSelect?.(collection.id)}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-rarity-rare">{collection.name}</h3>
        <button
          className="btn-primary px-3 py-1 text-sm"
          onClick={e => {
            e.stopPropagation();
            onOpen?.(collection.id);
          }}
        >Open</button>
      </div>
      {collection.description && (
        <p className="text-slate-300 text-sm">{collection.description}</p>
      )}
      <div className="flex gap-4 text-xs text-slate-400 pt-2">
        <span>
          Cards: {collection.total_cards ?? (Array.isArray(collection.cards) ? collection.cards.reduce((sum, card) => sum + (card.quantity || 1), 0) : 0)}
        </span>
        <span>
          Unique: {collection.unique_cards ?? (Array.isArray(collection.cards) ? new Set((collection.cards as any[]).map(card => card.id || card.name)).size : 0)}
        </span>
        {collection.created_at &&
          Number(collection.created_at) !== 0 &&
          collection.created_at !== "0" &&
          collection.created_at !== null &&
          !isNaN(new Date(collection.created_at).getTime()) && (
            <span>Created: {new Date(collection.created_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
};

export default CollectionCard;
