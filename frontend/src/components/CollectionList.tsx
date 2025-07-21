"use client";
import React from "react";
import { Collection } from "../types";
import CollectionCard from "./CollectionCard";

export interface CollectionListProps {
  collections: Collection[];
  viewMode?: "grid" | "list";
  selectedId?: string;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  className?: string;
}

const CollectionList: React.FC<CollectionListProps> = ({
  collections,
  viewMode = "grid",
  selectedId,
  onSelect,
  onOpen,
  className = "",
}) => {
  if (viewMode === "list") {
    return (
      <div className={`flex flex-col gap-3 w-full ${className}`}>
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
