
import React, { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import DetailModal from "./DetailModal";
import { ApiClient } from "@/lib/api";
import { useToast } from "./ToastProvider";
import type { Deck as DeckBase } from "@/types";

// Extend Deck type to allow analysis property (optional, any for now)
type Deck = DeckBase & {
  analysis?: any;
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-mtg-white mb-4">Deck Details</h1>
      <div className="bg-mtg-gray rounded-xl p-6 text-mtg-white">
        <div className="mb-4"><b>Deck ID:</b> {displayDeck.id}</div>
        <div className="mb-4"><b>Name:</b> {displayDeck.name}</div>
        <div className="mb-4"><b>Commander:</b> {displayDeck.commander?.name || "Unknown"}</div>
        <div className="mb-4"><b>Cards:</b> {displayDeck.cards.length}</div>
        <div className="mb-4"><b>Description:</b> {displayDeck.description || "-"}</div>
        <div className="flex gap-4 mt-6">
          <button className="btn-primary" onClick={() => setShowDetails(true)}>Edit</button>
          <button className="btn-secondary" onClick={handleExport}>Export</button>
          <button className="btn-secondary text-red-500 border-red-500" onClick={() => setShowDelete(true)}>Delete</button>
        </div>
      </div>
      {/* Deck Analysis Panel */}
      {displayDeck.analysis && (
        <div className="bg-slate-900 rounded-xl p-4 my-4 text-slate-100">
          <h3 className="text-xl font-bold mb-2">Deck Analysis</h3>
          <div className="mb-2">
            <strong>Overall Score:</strong> {displayDeck.analysis.overall_score} ({displayDeck.analysis.grade})
          </div>
          <div className="mb-2">
            <strong>Mana Curve:</strong> Avg CMC: {displayDeck.analysis.mana_curve?.average_cmc}
            <ul className="ml-4">
              {displayDeck.analysis.mana_curve?.distribution &&
                Object.entries(displayDeck.analysis.mana_curve.distribution).map(([cmc, pct]) => (
                  <li key={cmc}>CMC {cmc}: {Number(pct).toFixed(1)}%</li>
                ))}
            </ul>
            <strong>Ideal Distribution:</strong>
            <ul className="ml-4">
              {displayDeck.analysis.mana_curve?.ideal_distribution &&
                Object.entries(displayDeck.analysis.mana_curve.ideal_distribution).map(([cmc, pct]) => (
                  <li key={cmc}>CMC {cmc}: {Number(pct).toFixed(1)}%</li>
                ))}
            </ul>
          </div>
          <div className="mb-2">
            <strong>Card Types:</strong>
            <ul className="ml-4">
              {displayDeck.analysis.card_types?.distribution &&
                Object.entries(displayDeck.analysis.card_types.distribution).map(([type, count]) => (
                  <li key={type}>
                    {type}: {Number(count)} ({displayDeck.analysis.card_types.percentages?.[type] ? Number(displayDeck.analysis.card_types.percentages[type]).toFixed(1) : "?"}%)
                  </li>
                ))}
            </ul>
            <strong>Ideal Percentages:</strong>
            <ul className="ml-4">
              {displayDeck.analysis.card_types?.ideal_percentages &&
                Object.entries(displayDeck.analysis.card_types.ideal_percentages).map(([type, pct]) => (
                  <li key={type}>{type}: {Number(pct).toFixed(1)}%</li>
                ))}
            </ul>
          </div>
          <div className="mb-2">
            <strong>Synergies:</strong> {displayDeck.analysis.synergies?.primary_tribe} ({displayDeck.analysis.synergies?.tribal_count})
            <br />
            <strong>Themes:</strong>
            <ul className="ml-4">
              {displayDeck.analysis.synergies?.themes &&
                Object.entries(displayDeck.analysis.synergies.themes).map(([theme, pct]) => (
                  <li key={theme}>{theme}: {Number(pct).toFixed(1)}%</li>
                ))}
            </ul>
            <strong>Strongest Theme:</strong> {displayDeck.analysis.synergies?.strongest_theme}
          </div>
          <div className="mb-2">
            <strong>Balance:</strong> Score: {displayDeck.analysis.balance?.score}
            <ul className="ml-4">
              {displayDeck.analysis.balance?.categories &&
                Object.entries(displayDeck.analysis.balance.categories).map(([cat, val]) => (
                  <li key={cat}>{cat}: {val} (Ideal: {displayDeck.analysis.balance.ideal_targets?.[cat] ?? "?"})</li>
                ))}
            </ul>
          </div>
          {displayDeck.analysis.recommendations && displayDeck.analysis.recommendations.length > 0 && (
            <div className="mb-2">
              <strong>Recommendations:</strong>
              <ul className="ml-4">
                {displayDeck.analysis.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          {displayDeck.analysis.strengths && (
            <div className="mb-2">
              <strong>Strengths:</strong> {displayDeck.analysis.strengths.join(", ")}
            </div>
          )}
          {displayDeck.analysis.weaknesses && (
            <div className="mb-2">
              <strong>Weaknesses:</strong> {displayDeck.analysis.weaknesses.join(", ")}
            </div>
          )}
        </div>
      )}
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
