"use client";

import React from "react";
import CardGrid from "./CardGrid";

const GAME_CHANGERS = [
  // White
  "Drannith Magistrate", "Enlightened Tutor", "Humility", "Serra's Sanctum", "Smothering Tithe", "Teferi's Protection",
  // Blue
  "Consecrated Sphinx", "Cyclonic Rift", "Expropriate", "Force of Will", "Fierce Guardianship", "Gifts Ungiven", "Intuition", "Jin-Gitaxias, Core Augur", "Mystical Tutor", "Narset, Parter of Veils", "Rhystic Study", "Sway of the Stars", "Thassa's Oracle", "Urza, Lord High Artificer",
  // Black
  "Ad Nauseam", "Bolas's Citadel", "Braids, Cabal Minion", "Demonic Tutor", "Imperial Seal", "Necropotence", "Opposition Agent", "Orcish Bowmasters", "Tergrid, God of Fright", "Vampiric Tutor",
  // Red
  "Deflecting Swat", "Gamble", "Jeska's Will", "Underworld Breach",
  // Green (none unique, but included for completeness)
  // Multicolor
  "Aura Shards", "Coalition Victory", "Grand Arbiter Augustin IV", "Kinnan, Bonder Prodigy", "Yuriko, the Tiger's Shadow", "Notion Thief", "Winota, Joiner of Forces",
  // Colorless
  "Ancient Tomb", "Chrome Mox", "Field of the Dead", "Glacial Chasm", "Grim Monolith", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Panoptic Mirror", "The One Ring", "The Tabernacle at Pendrell Vale"
];

const GameChangers: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [gameChangerCards, setGameChangerCards] = React.useState<any[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [errorCards, setErrorCards] = React.useState<string | null>(null);

  // Fetch Scryfall data for all Game Changers on mount
  React.useEffect(() => {
    if (gameChangerCards.length === 0 && !loadingCards) {
      setLoadingCards(true);
      setErrorCards(null);
      Promise.all(
        GAME_CHANGERS.map(async (name) => {
          try {
            const resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
            if (!resp.ok) throw new Error('Not found');
            const data = await resp.json();
            return data; // Return full Scryfall card object for DFC support
          } catch {
            return { name, oracle_text: 'Not found' };
          }
        })
      ).then(setGameChangerCards)
        .catch(() => setErrorCards('Failed to load card data.'))
        .finally(() => setLoadingCards(false));
    }
  }, [gameChangerCards.length, loadingCards]);

  // Only render CardGrid with game changer cards
  if (loadingCards) {
    return <div className="text-slate-300 py-8 text-center w-full">Loading cards...</div>;
  }
  if (errorCards) {
    return <div className="text-red-400 py-8 text-center w-full">{errorCards}</div>;
  }
  return <CardGrid cards={gameChangerCards} />;
};

export default GameChangers;
