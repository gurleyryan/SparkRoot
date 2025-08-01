"use client";
import React from "react";
import { Collection as BaseCollection, MTGCard } from "../types";

// Extend Collection to allow isInventory for UI purposes
type Collection = BaseCollection & { isInventory?: boolean };

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
  const isInventory = collection.isInventory || collection.id === "__inventory__";
  return (
    <div
      className={`sleeve-morphism shadow-md p-4 flex flex-col gap-2 cursor-pointer transition-all duration-150 hover:scale-101
        ${selected ? "ring-2 ring-mtg-blue" : ""}
        ${isInventory ? "border-4 border-rarity-rare bg-gradient-to-br from-rarity-mythic/10 to-rarity-rare/10 shadow-lg" : ""}
        ${className}`}
      style={isInventory ? {
        background: "linear-gradient(135deg, rgba(255,215,0,0.10) 0%, rgba(21,11,0,0.72) 100%)",
        borderColor: "var(--color-rarity-rare)"
      } : { backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}
      onClick={() => onSelect?.(collection.id)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {isInventory && (
            <span title="Inventory" className="inline-flex items-center justify-center text-rarity-rare">
              {/* Simple inventory icon (box) */}
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="14" height="10" rx="2" fill="var(--color-rarity-rare)" fillOpacity="0.25" stroke="var(--color-rarity-rare)" strokeWidth="1.5"/>
                <rect x="6" y="8" width="8" height="4" rx="1" fill="var(--color-rarity-rare)" fillOpacity="0.5"/>
              </svg>
            </span>
          )}
          <h3 className="text-xl font-bold text-rarity-rare flex items-center gap-2">
            {isInventory ? (
              <span className="px-2 py-0.5 rounded-full bg-rarity-rare text-mtg-black font-bold tracking-wide shadow border border-rarity-mythic">INVENTORY</span>
            ) : (
              collection.name
            )}
          </h3>
        </div>
        <button
          className={`btn-primary px-3 py-1 text-sm ${isInventory ? "bg-rarity-rare text-mtg-black border-rarity-mythic hover:bg-rarity-uncommon" : ""}`}
          onClick={e => {
            e.stopPropagation();
            onOpen?.(collection.id);
          }}
        >Open</button>
      </div>
      {collection.description && (
        <p className="text-slate-300 text-sm">{collection.description}</p>
      )}
      <div className={`flex gap-4 pt-2 ${isInventory ? "text-xl font-bold text-rarity-rare" : "text-xs text-slate-400"}`}>
        <span>
          Cards: {collection.total_cards ?? (Array.isArray(collection.cards) ? collection.cards.reduce((sum, card) => sum + (card.quantity || 1), 0) : 0)}
        </span>
        <span>
          Unique: {collection.unique_cards ?? (Array.isArray(collection.cards) ? new Set((collection.cards as MTGCard[]).map(card => card.id || card.name)).size : 0)}
        </span>
        {!isInventory && collection.created_at &&
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
