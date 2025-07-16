"use client";

import React from "react";

const BRACKETS = [
  {
    value: 1,
    label: "1 – Exhibition",
    desc: "Ultra-casual, fun, and creative. No Game Changers, no combos, no land denial. Winning is not the primary goal.",
    details: [
      "No cards from the Game Changers list.",
      "No intentional two-card infinite combos, mass land denial, or extra-turn cards.",
      "Tutors should be sparse."
    ]
  },
  {
    value: 2,
    label: "2 – Core",
    desc: "Precon-level, laid-back, big swings, but not sudden wins. No Game Changers, no combos, limited extra turns.",
    details: [
      "No cards from the Game Changers list.",
      "No intentional two-card infinite combos or mass land denial.",
      "Extra-turn cards only in low quantities, not chained or looped.",
      "Tutors should be sparse."
    ]
  },
  {
    value: 3,
    label: "3 – Upgraded",
    desc: "Optimized homebrew. Up to 3 Game Changers. No early infinite combos. Limited extra turns.",
    details: [
      "Up to three cards from the Game Changers list.",
      "No intentional early-game two-card infinite combos.",
      "Extra-turn cards only in low quantities, not chained or looped.",
      "No mass land denial."
    ]
  },
  {
    value: 4,
    label: "4 – Optimized",
    desc: "High power, open META. No restrictions except format bans.",
    details: [
      "No restrictions (other than the banned list)."
    ]
  },
  {
    value: 5,
    label: "5 – Competitive (cEDH)",
    desc: "Tournament-level, metagame-focused. No restrictions except format bans.",
    details: [
      "No restrictions (other than the banned list)."
    ]
  }
];

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

export interface BracketPickerProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

const BracketPicker: React.FC<BracketPickerProps> = ({ value, onChange, className }) => {
  return (
    <div className={`flex flex-col gap-2 ${className || ""}`}>
      <label className="font-semibold text-slate-200 mb-1">Commander Bracket
        <span className="ml-2 text-xs text-slate-400 font-normal">
          <a href="https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">What is this?</a>
        </span>
      </label>
      <div className="flex gap-2 flex-wrap">
        {BRACKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
              ${value === b.value ? "bg-amber-600 border-amber-400 text-white" : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"}`}
            onClick={() => onChange(b.value)}
            title={b.desc}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-400 mt-1">
        <div className="font-semibold text-amber-400 mb-1">{BRACKETS.find((b) => b.value === value)?.label}</div>
        <div>{BRACKETS.find((b) => b.value === value)?.desc}</div>
        <ul className="list-disc ml-5 mt-1">
          {BRACKETS.find((b) => b.value === value)?.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <div className="mt-2">
          <button
            type="button"
            className="underline text-amber-400 cursor-pointer"
            onClick={() => {
              const el = document.getElementById('game-changers-list');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            View Game Changer List
          </button>
        </div>
      </div>
      {/* Game Changer List (hidden by default, scrolls into view) */}
      <div id="game-changers-list" className="mt-6 bg-slate-800/80 rounded-lg p-4 border border-slate-700 text-xs text-slate-300 max-h-64 overflow-y-auto">
        <div className="font-bold text-amber-400 mb-2">Game Changer Cards</div>
        <div className="mb-2">Cards that can dramatically warp Commander games. Bracket 1 & 2: Excluded. Bracket 3: Up to 3 allowed. Bracket 4 & 5: Unlimited.</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {GAME_CHANGERS.map((card) => (
            <div key={card} className="bg-slate-900/60 rounded px-2 py-1 border border-slate-700 text-slate-200">{card}</div>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          <a href="https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-april-22-2025" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">Latest Bracket Update (April 2025)</a>
          {" | "}
          <a href="https://magic.wizards.com/en/formats/commander" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">Commander Format Rules</a>
        </div>
      </div>
    </div>
  );
};

export default BracketPicker;
