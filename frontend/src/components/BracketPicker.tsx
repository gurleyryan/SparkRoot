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


export interface BracketPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  onlyButtons?: boolean;
  onlyDescription?: boolean;
  disabledBrackets?: number[];
}

const BracketPicker: React.FC<BracketPickerProps> = ({ value, onChange, className, onlyButtons, onlyDescription, disabledBrackets }) => {
  // Only render bracket buttons
  if (onlyButtons) {
    return (
      <div className={`flex flex-col gap-2 ${className || ""}`}>
        <label className="font-semibold text-slate-200 mb-1">Commander Bracket
          <span className="ml-2 text-sm text-slate-400 font-normal">
            <a href="https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">What is this?</a>
          </span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {BRACKETS.map((b) => (
            <button
              key={b.value}
              type="button"
              className={
                `${value === b.value ? 'btn-primary' : 'btn-secondary'} ` +
                (disabledBrackets?.includes(b.value) ? ' opacity-50 cursor-not-allowed line-through' : '')
              }
              onClick={() => onChange(b.value)}
              title={b.desc}
              disabled={disabledBrackets?.includes(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Only render bracket description/details (no Game Changers button)
  if (onlyDescription) {
    return (
      <div className={`flex flex-col gap-2 ${className || ""}`}> 
        <div className="text-sm text-slate-400 mt-1">
          <div className="font-semibold text-amber-400 mb-1">{BRACKETS.find((b) => b.value === value)?.label}</div>
          <div>{BRACKETS.find((b) => b.value === value)?.desc}</div>
          <ul className="list-disc ml-5 mt-1">
            {BRACKETS.find((b) => b.value === value)?.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Default: full panel (legacy fallback)
  return null;
}

export default BracketPicker;
