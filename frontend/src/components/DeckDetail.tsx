
import React, { useState, useEffect } from "react";
import Image from 'next/image';
import LiquidSleeve from "./LiquidSleeve";
import ConfirmModal from "./ConfirmModal";
import DetailModal from "./DetailModal";
import { ApiClient } from "@/lib/api";
import { useToast } from "./ToastProvider";
import type { Deck as DeckBase } from "@/types";

// Extend Deck type to allow analysis and color_identity properties
type Deck = DeckBase & {
  analysis?: any;
  color_identity?: string[];
};

interface DeckDetailProps {
  deckId?: string;
  deck?: Deck;
}

const exportFormats = [
  { label: "TXT (MTGO/Arena)", value: "txt" },
  { label: "JSON", value: "json" },
  { label: "Moxfield", value: "moxfield" },
];

export default function DeckDetail({ deckId, deck }: DeckDetailProps) {
  const showToast = useToast();
  const [fetchedDeck, setFetchedDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(!deck);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState("txt");
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [editName, setEditName] = useState(deck?.name ?? "");
  const [editDesc, setEditDesc] = useState(deck?.description ?? "");
  const [saving, setSaving] = useState(false);

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
        } catch (err: any) {
          setError(err.message || "Failed to load deck");
          showToast(err.message || "Failed to load deck", "error");
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
    setSaving(true);
    try {
      const api = new ApiClient();
      await api.saveCollection({
        ...displayDeck,
        name: editName,
        description: editDesc,
        // Optionally update commander if UI allows
      });
      if (!deck) setFetchedDeck({ ...displayDeck, name: editName, description: editDesc });
      setShowDetails(false);
      showToast("Deck updated", "success");
    } catch (err: any) {
      if (err instanceof Error) {
        showToast(err.message || "Failed to update deck", "error");
      } else {
        showToast("Failed to update deck", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // Export deck handler
  const handleExport = async () => {
    if (!displayDeck) return;
    setExportResult(null);
    setShowExport(true);
    try {
      let endpoint = "/api/export-deck/txt";
      let mediaType = "text/plain";
      if (exportFormat === "json") {
        endpoint = "/api/export-deck/json";
        mediaType = "application/json";
      } else if (exportFormat === "moxfield") {
        endpoint = "/api/export-deck/moxfield";
        mediaType = "text/plain";
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_data: displayDeck, as_file: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setExportResult(text);
      showToast("Deck exported", "success");
    } catch (err: any) {
      if (err instanceof Error) {
        showToast(err.message || "Failed to export deck", "error");
      } else {
        showToast("Failed to export deck", "error");
      }
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

  // Delete deck handler (real API)
  const handleDelete = async () => {
    setShowDelete(false);
    if (!displayDeck) return;
    try {
      const api = new ApiClient();
      await api.deleteDeck(displayDeck.id);
      showToast("Deck deleted successfully", "success");
      // Optionally redirect or update state
      if (!deck) setFetchedDeck(null);
    } catch (err: any) {
      if (err instanceof Error) {
        showToast(err.message || "Failed to delete deck", "error");
      } else {
        showToast("Failed to delete deck", "error");
      }
    }
  };

  if (loading) return <div className="text-mtg-white">Loading deck...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
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
          <div className="relative rounded-2xl bg-black/60 bg-blur p-6 md:p-8 border-mtg-gold/30 shadow-lg overflow-hidden">
            <Image src="/logo.svg" alt="SparkRoot Logo" className="m-auto" width={32} height={32} />
            <h1 className="text-3xl md:text-4xl font-bold text-mtg-gold text-center tracking-wide mb-2 drop-shadow-lg font-mtg">Deck Details</h1>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div className="text-mtg-white/80 text-lg font-semibold font-mtg">{displayDeck.name}</div>
              <div className="text-mtg-gold/80 text-sm font-mtg">Deck ID: {displayDeck.id}</div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div className="text-mtg-white/80">Commander: <span className="font-bold text-mtg-gold">{displayDeck.commander?.name || "Unknown"}</span></div>
              <div className="text-mtg-white/60">Cards: {displayDeck.cards.length}</div>
            </div>
            <div className="mb-4 text-mtg-white/80 italic">{displayDeck.description || <span className="text-mtg-white/40">No description.</span>}</div>
            <div className="flex gap-3 justify-center mb-6">
              <button className="btn-primary px-5 py-2 text-lg font-mtg" onClick={() => setShowDetails(true)}>Edit</button>
              <button className="btn-secondary px-5 py-2 text-lg font-mtg" onClick={handleExport}>Export</button>
              <button className="btn-secondary px-5 py-2 text-lg font-mtg text-red-500 border-red-500" onClick={() => setShowDelete(true)}>Delete</button>
            </div>
            {/* Deck Analysis Panel */}
            {displayDeck.analysis && (
              <div className="mt-2">
                <LiquidSleeve manaTheme={manaTheme} className="p-6 mt-2">
                  <h3 className="text-2xl font-bold mb-4 text-mtg-gold font-mtg drop-shadow text-center">Deck Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Column 1: Score, Balance, Recommendations */}
                    <div className="flex flex-col gap-4">
                      {/* Score */}
                      <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-mtg-gold/10">
                        <div className="text-mtg-gold text-3xl font-bold font-mtg">{displayDeck.analysis.overall_score}</div>
                        <div className="text-mtg-white/80 text-sm">Overall Score</div>
                        <div className="text-mtg-gold/70 text-s mt-1">Grade: {displayDeck.analysis.grade}</div>
                      </div>
                      {/* Balance */}
                      <div className="bg-black/40 rounded-xl p-4 border border-mtg-white/10">
                        <div className="text-mtg-white text-lg font-bold font-mtg mb-1">Balance</div>
                        <div className="text-mtg-white/80 text-s mb-1">Score: {displayDeck.analysis.balance?.score}</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.balance?.categories &&
                            Object.entries(displayDeck.analysis.balance.categories).map(([cat, val]) => (
                              <li key={cat}>{cat}: {val} (Ideal: {displayDeck.analysis.balance.ideal_targets?.[cat] ?? "?"})</li>
                            ))}
                        </ul>
                      </div>
                      {/* Recommendations */}
                      {displayDeck.analysis.recommendations && displayDeck.analysis.recommendations.length > 0 && (
                        <div className="bg-black/40 rounded-xl p-4 border border-mtg-gold/10">
                          <div className="text-mtg-gold text-lg font-bold font-mtg mb-1">Recommendations</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.recommendations.map((rec: string, i: number) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {/* Column 2: Mana Curve */}
                    <div className="bg-black/40 rounded-xl p-4 border border-mtg-blue/10 self-start">
                      <div className="text-mtg-blue text-lg font-bold font-mtg mb-1">Mana Curve</div>
                      <div className="text-mtg-white/80 text-s mb-1">Avg CMC: {displayDeck.analysis.mana_curve?.average_cmc}</div>
                      <div className="flex flex-row gap-6">
                        <div>
                          <div className="text-mtg-white/60 text-s">Distribution:</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.mana_curve?.distribution &&
                              Object.entries(displayDeck.analysis.mana_curve.distribution).map(([cmc, pct]) => (
                                <li key={cmc}>CMC {cmc}: {Number(pct).toFixed(1)}%</li>
                              ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-mtg-white/60 text-s">Ideal:</div>
                          <ul className="text-s ml-2">
                            {displayDeck.analysis.mana_curve?.ideal_distribution &&
                              Object.entries(displayDeck.analysis.mana_curve.ideal_distribution).map(([cmc, pct]) => (
                                <li key={cmc}>CMC {cmc}: {Number(pct).toFixed(1)}%</li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    {/* Column 3: Card Types + Strengths */}
                    <div className="flex flex-col gap-4">
                      {/* Card Types */}
                      <div className="bg-black/40 rounded-xl p-4 border border-mtg-green/10">
                        <div className="text-mtg-green text-lg font-bold font-mtg mb-1">Card Types</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.card_types?.distribution &&
                            Object.entries(displayDeck.analysis.card_types.distribution).map(([type, count]) => (
                              <li key={type}>
                                {type}: {Number(count)} ({displayDeck.analysis.card_types.percentages?.[type] ? Number(displayDeck.analysis.card_types.percentages[type]).toFixed(1) : "?"}%)
                              </li>
                            ))}
                        </ul>
                        <div className="text-mtg-white/60 text-s mt-1">Ideal:</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.card_types?.ideal_percentages &&
                            Object.entries(displayDeck.analysis.card_types.ideal_percentages).map(([type, pct]) => (
                              <li key={type}>{type}: {Number(pct).toFixed(1)}%</li>
                            ))}
                        </ul>
                      </div>
                      {/* Strengths */}
                      {displayDeck.analysis.strengths && (
                        <div className="bg-black/40 rounded-xl p-4 border border-green-400/20">
                          <div className="text-green-400 font-bold mb-1">Strengths</div>
                          <div className="text-mtg-white/90 text-s">{displayDeck.analysis.strengths.join(", ")}</div>
                        </div>
                      )}
                    </div>
                    {/* Column 4: Synergies + Weaknesses */}
                    <div className="flex flex-col gap-4">
                      {/* Synergies & Themes */}
                      <div className="bg-black/40 rounded-xl p-4 border border-mtg-red/10">
                        <div className="text-mtg-red text-lg font-bold font-mtg mb-1">Synergies</div>
                        <div className="text-mtg-white/80 text-s mb-1">Tribe: {displayDeck.analysis.synergies?.primary_tribe} ({displayDeck.analysis.synergies?.tribal_count})</div>
                        <div className="text-mtg-white/60 text-s">Themes:</div>
                        <ul className="text-s ml-2">
                          {displayDeck.analysis.synergies?.themes &&
                            Object.entries(displayDeck.analysis.synergies.themes).map(([theme, pct]) => (
                              <li key={theme}>{theme}: {Number(pct).toFixed(1)}%</li>
                            ))}
                        </ul>
                        <div className="text-mtg-white/60 text-s mt-1">Strongest: <span className="text-mtg-gold font-bold">{displayDeck.analysis.synergies?.strongest_theme}</span></div>
                      </div>
                      {/* Weaknesses */}
                      {displayDeck.analysis.weaknesses && (
                        <div className="bg-black/40 rounded-xl p-4 border border-red-400/20">
                          <div className="text-red-400 font-bold mb-1">Weaknesses</div>
                          <div className="text-mtg-white/90 text-s">{displayDeck.analysis.weaknesses.join(", ")}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </LiquidSleeve>
              </div>
            )}
          </div>
        </LiquidSleeve>
      </div>

      {/* Export Modal */}
      {/* Export Modal */}
      {showExport && (
        <DetailModal open={showExport} title="Export Deck" onClose={() => setShowExport(false)}>
          <div className="mb-4">
            <label className="block text-mtg-white mb-2">Format:</label>
            <select
              className="form-input px-2 py-1 rounded border border-mtg-blue bg-black text-white"
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value)}
            >
              {exportFormats.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          {exportResult && (
            <>
              <textarea
                className="w-full h-48 bg-slate-900 text-white p-2 rounded mb-4"
                value={exportResult}
                readOnly
              />
              <button className="btn-primary" onClick={handleDownload}>Download</button>
            </>
          )}
          {!exportResult && <div className="text-mtg-white">Exporting...</div>}
        </DetailModal>
      )}
      {/* Edit Modal */}
      <DetailModal open={showDetails} title="Edit Deck" onClose={() => setShowDetails(false)}>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleEditSave();
          }}
        >
          <div className="mb-4">
            <label className="block text-mtg-white mb-2">Name</label>
            <input
              className="form-input w-full"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-mtg-white mb-2">Description</label>
            <textarea
              className="form-input w-full"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
            />
          </div>
          {/* Commander editing could be added here if needed */}
          <div className="flex gap-4 justify-end">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setShowDetails(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </DetailModal>
      <ConfirmModal
        open={showDelete}
        title="Delete Deck?"
        message="Are you sure you want to delete this deck? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
