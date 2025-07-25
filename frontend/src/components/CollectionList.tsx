"use client";
import React from "react";
import { Collection } from "../types";
import CollectionCard from "./CollectionCard";

export interface CollectionListProps {
  collections: Collection[];
  inventory?: Collection; // Optionally pass the user's inventory as a special collection
  viewMode?: "grid" | "list";
  selectedId?: string;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  className?: string;
}

const CollectionList: React.FC<CollectionListProps> = ({
  collections,
  inventory,
  viewMode = "grid",
  selectedId,
  onSelect,
  onOpen,
  className = "",
}) => {
  // Helper to render a CollectionCard for inventory (if provided)
  const renderInventoryCard = () =>
    inventory ? (
      <CollectionCard
        key={inventory.id}
        collection={inventory}
        selected={selectedId === inventory.id}
        onSelect={onSelect}
        onOpen={onOpen}
        className="border-mtg-blue border-2 bg-slate-800"
      />
    ) : null;

  if (viewMode === "list") {
    return (
      <div className={`flex flex-col gap-3 w-full ${className}`}>
        {inventory && renderInventoryCard()}
        {collections.map(col => (
          <CollectionCard
            key={col.id}
            collection={col}
            selected={selectedId === col.id}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }
  // grid view
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full ${className}`}>
      {inventory && (
        <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4">
          {renderInventoryCard()}
        </div>
      )}
      {collections.map(col => (
        <CollectionCard
          key={col.id}
          collection={col}
          selected={selectedId === col.id}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
};

export default CollectionList;
