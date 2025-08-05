import React, { useState, useEffect } from "react";
import Image from 'next/image';
import LiquidSleeve from "./LiquidSleeve";
import ConfirmModal from "./ConfirmModal";
import { ApiClient } from "@/lib/api";
import { useToast } from "./ToastProvider";
import type { Deck as DeckBase } from "@/types";

// Extend Deck type to allow analysis and color_identity properties
type Deck = DeckBase & {
  analysis?: {
    overall_score?: number;
    grade?: string;
    balance?: {
      score?: number;
      categories?: Record<string, number>;
      ideal_targets?: Record<string, number>;
    };
    recommendations?: string[];
    mana_curve?: {
      average_cmc?: number;
      actual_curve?: Record<string, number>;
      curve_targets?: Record<string, number>;
      mana_rocks?: number;
      mana_rocks_target?: number;
      lands?: number;
      lands_target?: number;
      curve_warnings?: string[];
      n_drop_count?: number;
    };
    card_types?: {
      distribution?: Record<string, number>;
      percentages?: Record<string, number>;
      ideal_counts?: Record<string, number>;
    };
    strengths?: string[];
    synergies?: {
      primary_kind?: string;
      kindred_count?: number;
      themes?: Record<string, number>;
      strongest_theme?: string;
    };
    weaknesses?: string[];
  };
  color_identity?: string[];
  tags?: string[];
  user_id?: string;
  collection_id?: string;
  is_public?: boolean;
  theme?: string;
};

interface DeckDetailProps {
  deckId?: string;
  deck?: Deck;
  showBasicLands?: boolean;
  setShowBasicLands?: (show: boolean) => void;
}

const exportFormats = [
  { label: "TXT (MTGO/Arena)", value: "txt" },
  { label: "JSON", value: "json" },
  { label: "Moxfield", value: "moxfield" },
];

export default function DeckDetail({
  deckId,
  deck,
  showBasicLands = true,
  setShowBasicLands,
}: DeckDetailProps) {
  // Toggle for showing/hiding basic lands
  const showToast = useToast();
  const [fetchedDeck, setFetchedDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(!deck);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState("txt");
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [editName, setEditName] = useState(deck?.name ?? "");
  const [editDesc, setEditDesc] = useState(deck?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveDeckLoading, setSaveDeckLoading] = useState(false);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  // The deck to display: either the prop or the fetched one
  const displayDeck = deck ?? fetchedDeck;

  // Fetch deck if deckId is provided and no deck prop
  useEffect(() => {
    if (!deck && deckId) {
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const api = new ApiClient();
          const result = await api.getDeckById(deckId);
          if (!result) throw new Error("Deck not found");
          const deckData = result as Deck;
          setFetchedDeck(deckData);
          setEditName(deckData.name);
          setEditDesc(deckData.description || "");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load deck";
          setError(message);
          showToast(message, "error");
        } finally {
          setLoading(false);
        }
      })();
    } else if (deck) {
      setEditName(deck.name);
      setEditDesc(deck.description || "");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, deckId]);

  // Edit deck handler
  const handleEditSave = async () => {
    if (!displayDeck) return;
    // If deckId is not present, just update local state and exit edit mode
    if (!deckId) {
      // For generated decks, just update local state
      setEditing(false);
      showToast("Deck details updated locally", "success");
      return;
    }
    // For saved decks, call API
    setSaving(true);
    try {
      const api = new ApiClient();
      await api.saveDeckDetails({
        ...displayDeck,
        name: editName,
        description: editDesc,
      });
      if (!deck) setFetchedDeck({ ...displayDeck, name: editName, description: editDesc });
      setEditing(false);
      showToast("Deck updated", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update deck";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Export deck handler
  const handleExport = () => {
    setShowExportOptions((prev) => !prev);
  };

  // Actual export after format selection
  const handleExportFormat = async (format: string) => {
    if (!displayDeck) return;
    if (!editName.trim()) {
      setNameWarning("Are you forgetting a name?");
      return;
    }
    setNameWarning(null);
    setExportResult(null);
    setExportFormat(format);
    try {
      let endpoint = "/api/export-deck/txt";
      if (format === "json") endpoint = "/api/export-deck/json";
      else if (format === "moxfield") endpoint = "/api/export-deck/moxfield";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_data: displayDeck, as_file: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setExportResult(text);
      showToast("Deck exported", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to export deck";
      showToast(message, "error");
      setExportResult(null);
    }
  };

  // Download exported deck as file
  const handleDownload = () => {
    if (!exportResult || !displayDeck) return;
    const blob = new Blob([exportResult], { type: exportFormat === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${displayDeck.name || "deck"}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Save Deck handler
  const handleSaveDeck = async () => {
    if (!displayDeck) return;
    if (!editName.trim()) {
      setNameWarning("Are you forgetting a name?");
      return;
    }
    setNameWarning(null);
    setSaveDeckLoading(true);
    try {
      // Only send non-redundant metadata in deck_data
      const { name, commander, analysis, color_identity, theme, tags, ...rest } = displayDeck;
      // Remove top-level fields from deck_data
      const deck_data = { ...rest, commander, cards: displayDeck.cards, total_cards: displayDeck.cards?.length || 0 };
      const payload = {
        user_id: displayDeck.user_id || "demo-user", // Replace with actual user_id from context/auth
        name: name,
        commander_name: commander?.name || "",
        deck_data,
        deck_analysis: analysis || null,
        collection_id: displayDeck.collection_id || null,
        bracket: displayDeck.bracket || 1,
        is_public: displayDeck.is_public || false,
        theme: theme || null,
        color_identity: color_identity || null,
        tags: tags || null
      };
      const res = await fetch("/api/save-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        showToast("Deck saved!", "success");
        // Optionally update local state with new deckId
        if (!deck && result.deck_id) {
          setFetchedDeck({ ...displayDeck, id: result.deck_id });
        }
      } else {
        throw new Error(result.error || "Failed to save deck");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save deck";
      showToast(message, "error");
    } finally {
      setSaveDeckLoading(false);
    }
  };

  // Delete deck handler (real API)
  const handleDelete = async () => {
    setShowDelete(false);
    if (!displayDeck) return;
    try {
      const api = new ApiClient();
      await api.deleteDeck(displayDeck.id);
      showToast("Deck deleted successfully", "success");
      if (!deck) setFetchedDeck(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete deck";
      showToast(message, "error");
    }
  };

  if (loading) return <div className="text-mtg-white">Loading deck...</div>;
  if (error) return <div className="text-mtg-red">{error}</div>;
  if (!displayDeck) return <div className="text-mtg-white">Deck not found.</div>;

  // Mana color accent for border
  const manaTheme = (() => {
    const ci = displayDeck.color_identity;
    if (Array.isArray(ci) && ci.length === 1) {
      const map = {
        W: "white",
        U: "blue",
        B: "black",
        R: "red",
        G: "green",
      } as const;
      return (map[ci[0] as keyof typeof map] || "blue") as
        | "white"
        | "blue"
        | "black"
        | "red"
        | "green";
    } else if (Array.isArray(ci) && ci.length > 1) {
      return "multicolor" as const;
    } else {
      return "colorless" as const;
    }
  })();

  return (
    <div className="flex flex-col items-center justify-center py-4 px-2">
      <div className="w-full mx-auto">
        <LiquidSleeve manaTheme={manaTheme} className="p-0 md:p-1">
          <div className="relative rounded-2xl bg-blur p-6 md:p-8 shadow-lg overflow-hidden" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
            <Image src="/logo.png" alt="SparkRoot Logo" className="m-auto" width={28} height={40} style={{ width: 'auto', height: 'auto' }} />
            <h1 className="text-3xl md:text-4xl font-bold text-rarity-rare text-center tracking-wide mb-2 drop-shadow-lg font-mtg">Deck Details</h1>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              {/* Name field: hidden until editing or if deck has a name */}
              <div className="text-mtg-white text-lg font-semibold font-mtg">
                {editing ? (
                  <input
                    className="form-input w-full"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter deck name"
                    required
                  />
                ) : (
                  editName ? editName : <span className="text-mtg-white">(No name)</span>
                )}
              </div>
              <div className="text-rarity-rare text-sm font-mtg">Deck ID: {displayDeck.id}</div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div className="text-mtg-white">Commander: <span className="font-bold text-rarity-rare">{displayDeck.commander?.name || "Unknown"}</span></div>
              <div className="text-mtg-white">Cards: {displayDeck.cards.length}</div>
            </div>
            <div className="mb-4 text-mtg-white italic">
              {editing ? (
                <textarea
                  className="form-input w-full"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Enter description"
                />
              ) : (
                editDesc || <span className="text-mtg-white">No description.</span>
              )}
            </div>
            {/* Name warning above Save/Export buttons */}
            {nameWarning && (
              <div className="text-rarity-mythic text-center font-bold mb-2">{nameWarning}</div>
            )}
            <div className="flex gap-3 justify-center mb-6">
              {!editing ? (
                <button className="btn-primary px-5 py-2 text-lg font-mtg" onClick={() => setEditing(true)}>Edit</button>
              ) : (
                <button className="btn-primary px-5 py-2 text-lg font-mtg" onClick={handleEditSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              )}
              <button className="btn-primary px-5 py-2 text-lg font-mtg" onClick={handleSaveDeck} disabled={saveDeckLoading}>
                {saveDeckLoading ? "Saving..." : "Save Deck"}
              </button>
              <button className="btn-secondary px-5 py-2 text-lg font-mtg" onClick={handleExport}>Export</button>
              {/* Hide Delete for generated decks (no deckId or not saved) */}
              {deckId && (
                <button className="btn-secondary px-5 py-2 text-lg font-mtg text-mtg-red border-mtg-red" onClick={() => setShowDelete(true)}>Delete</button>
              )}
            </div>
            {/* Export format options, shown after Export is pressed */}
            {showExportOptions && (
              <div className="flex gap-2 justify-center mb-4">
                {exportFormats.map(f => (
                  <button
                    key={f.value}
                    className={`btn-secondary px-4 py-2 font-mtg${exportFormat === f.value ? " border-mtg-blue" : ""}`}
                    onClick={() => handleExportFormat(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {/* Export result (text area and download) */}
            {exportResult && (
              <div className="mb-4">
                <textarea
                  className="w-full h-48 bg-slate-900 text-white p-2 rounded mb-4"
                  value={exportResult}
                  readOnly
                />
                <button className="btn-primary" onClick={handleDownload}>Download</button>
              </div>
            )}
            {/* Deck Analysis Panel */}
            {displayDeck.analysis && (
              <div className="mt-2">
                <LiquidSleeve manaTheme={manaTheme} className="p-6 mt-2">
                  <h3 className="text-2xl font-bold mb-4 text-rarity-rare font-mtg drop-shadow text-center">Deck Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Column 1: Score, Balance, Recommendations */}
                    <div className="flex flex-col gap-4">
                      {/* Score */}
                      <div className="rounded-xl p-4 flex flex-col items-center border border-rarity-rare" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                        <div className="text-rarity-rare text-3xl font-bold font-mtg">{displayDeck.analysis.overall_score}</div>
                        <div className="text-mtg-white text-sm">Overall Score</div>
                        <div className="text-rarity-rare text-s mt-1">Grade: {displayDeck.analysis.grade}</div>
                      </div>
                      {/* Balance */}
                      <div className="rounded-xl p-4 border border-rarity-rare" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                        <div className="text-rarity-rare text-lg font-bold font-mtg mb-1">Balance</div>
                        <div className="text-mtg-white text-s mb-1">Score: {displayDeck.analysis.balance?.score}</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.balance?.categories &&
                            Object.entries(displayDeck.analysis.balance.categories).map(([cat, val]) => (
                              <li key={cat}>{cat}: {val} (Ideal: {displayDeck.analysis?.balance?.ideal_targets?.[cat] ?? "?"})</li>
                            ))}
                        </ul>
                      </div>
                      {/* Recommendations */}
                      {displayDeck.analysis.recommendations && displayDeck.analysis.recommendations.length > 0 && (
                        <div className="rounded-xl p-4 border border-rarity-rare" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                          <div className="text-rarity-rare text-lg font-bold font-mtg mb-1">Recommendations</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.recommendations.map((rec: string, i: number) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {/* Column 2: Mana Curve */}
                    <div className="rounded-xl p-4 border border-mtg-blue self-start" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                      <div className="text-mtg-blue text-lg font-bold font-mtg mb-1">Mana Curve</div>
                      <div className="text-mtg-white text-s mb-1">Avg CMC: {displayDeck.analysis.mana_curve?.average_cmc}</div>
                      <div className="flex flex-row gap-6">
                        <div>
                          <div className="text-mtg-white text-s">Actual:</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.mana_curve?.actual_curve &&
                              Object.entries(displayDeck.analysis.mana_curve.actual_curve).map(([cmc, count]) => {
                                const ideal = displayDeck.analysis?.mana_curve?.curve_targets?.[cmc];
                                const actualCount = Number(count);
                                const off = Math.abs(actualCount - Number(ideal)) > 2;
                                return (
                                  <li key={cmc} className={off ? "text-mtg-red font-bold" : "text-mtg-white"}>
                                    CMC {cmc}: {actualCount} {ideal !== undefined && <span className="text-rarity-rare">/ {String(ideal)}</span>}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                        <div>
                          <div className="text-mtg-white text-s">Mana Rocks:</div>
                          <div className={Math.abs((displayDeck.analysis.mana_curve?.mana_rocks ?? 0) - (displayDeck.analysis.mana_curve?.mana_rocks_target ?? 0)) > 2 ? "text-mtg-red font-bold" : "text-mtg-white"}>
                            {displayDeck.analysis.mana_curve?.mana_rocks} <span className="text-rarity-rare">/ {displayDeck.analysis.mana_curve?.mana_rocks_target}</span>
                          </div>
                          <div className="text-mtg-white text-s mt-2">Lands:</div>
                          <div className={Math.abs((displayDeck.analysis.mana_curve?.lands ?? 0) - (displayDeck.analysis.mana_curve?.lands_target ?? 0)) > 2 ? "text-mtg-red font-bold" : "text-mtg-white"}>
                            {displayDeck.analysis.mana_curve?.lands} <span className="text-rarity-rare">/ {displayDeck.analysis.mana_curve?.lands_target}</span>
                          </div>
                        </div>
                      </div>
                      {/* Warnings and highlights */}
                      {displayDeck.analysis.mana_curve?.curve_warnings && displayDeck.analysis.mana_curve.curve_warnings.length > 0 && (
                        <div className="mt-3">
                          <div className="text-mtg-red font-bold mb-1">Curve Warnings</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.mana_curve.curve_warnings.map((w: string, i: number) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* N-drop warning */}
                      {(displayDeck.analysis.mana_curve?.n_drop_count ?? 0) > 0 && (
                        <div className="mt-2 text-rarity-mythic font-bold">
                          Warning: {(displayDeck.analysis.mana_curve?.n_drop_count ?? 0)} card(s) with CMC equal to commander ({displayDeck.commander?.cmc}). Review for synergy.
                        </div>
                      )}
                      {/* Sol Ring warning */}
                      {displayDeck.analysis.mana_curve?.curve_warnings?.some((w: string) => w.toLowerCase().includes("sol ring")) && (
                        <div className="mt-2 text-mtg-red font-bold">
                          Sol Ring is present but banned by House Rules.
                        </div>
                      )}
                    </div>
                    {/* Column 3: Card Types + Strengths */}
                    <div className="flex flex-col gap-4">
                      {/* Card Types */}
                      <div className="rounded-xl p-4 border border-mtg-green" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                        <div className="text-mtg-green text-lg font-bold font-mtg mb-1">Card Types</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.card_types?.distribution &&
                            Object.entries(displayDeck.analysis.card_types.distribution).map(([type, count]) => (
                              <li key={type}>
                                {type}: {Number(count)} ({displayDeck.analysis?.card_types?.percentages?.[type] ? Number(displayDeck.analysis.card_types.percentages[type]).toFixed(1) : "?"}%)
                              </li>
                            ))}
                        </ul>
                        <div className="text-mtg-white text-s mt-1">Ideal:</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.card_types?.ideal_counts &&
                            Object.entries(displayDeck.analysis.card_types.ideal_counts).map(([type, count]) => (
                              <li key={type}>{type}: {Number(count).toFixed(1)}%</li>
                            ))}
                        </ul>
                      </div>
                      {/* Strengths */}
                      {displayDeck.analysis.strengths && (
                        <div className="rounded-xl p-4 border border-mtg-green" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                          <div className="text-mtg-green font-bold mb-1">Strengths</div>
                          <div className="text-mtg-white text-s">{displayDeck.analysis.strengths.join(", ")}</div>
                        </div>
                      )}
                    </div>
                    {/* Column 4: Synergies + Weaknesses */}
                    <div className="flex flex-col gap-4">
                      {/* Synergies & Themes */}
                      <div className="rounded-xl p-4 border border-mtg-red" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                        <div className="text-mtg-red text-lg font-bold font-mtg mb-1">Synergies</div>
                        <div className="text-mtg-white text-s mb-1">Kindred: {displayDeck.analysis.synergies?.primary_kind} ({displayDeck.analysis.synergies?.kindred_count})</div>
                        <div className="text-mtg-white text-s">Themes:</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.synergies?.themes &&
                            Object.entries(displayDeck.analysis.synergies.themes).map(([theme, pct]) => (
                              <li key={theme}>{theme}: {Number(pct).toFixed(1)}%</li>
                            ))}
                        </ul>
                        <div className="text-mtg-white text-s mt-1">Strongest: <span className="text-rarity-rare font-bold">{displayDeck.analysis.synergies?.strongest_theme}</span></div>
                      </div>
                      {/* Weaknesses */}
                      {displayDeck.analysis.weaknesses && (
                        <div className="rounded-xl p-4 border border-mtg-red" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                          <div className="text-mtg-red font-bold mb-1">Weaknesses</div>
                          <div className="text-mtg-white text-s">{displayDeck.analysis.weaknesses.join(", ")}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </LiquidSleeve>
              </div>
            )}
            {/* Toggle button for basic lands */}
            {typeof setShowBasicLands === 'function' && (
              <div className="flex justify-end mt-6">
                <button
                  className={`btn-secondary px-3 py-1 rounded border font-semibold ml-2 ${showBasicLands ? 'bg-mtg-green' : ''} text-white`}
                  onClick={() => setShowBasicLands(!showBasicLands)}
                >
                  {showBasicLands ? "Hide Basic Lands" : "Show Basic Lands"}
                </button>
              </div>
            )}
          </div>
        </LiquidSleeve>
      </div>
      {/* Delete confirmation modal only for saved decks */}
      {deckId && showDelete && (
        <ConfirmModal
          open={showDelete}
          title="Delete Deck?"
          message="Are you sure you want to delete this deck? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
