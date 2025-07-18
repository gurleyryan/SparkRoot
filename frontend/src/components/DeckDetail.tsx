
import React, { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import DetailModal from "./DetailModal";
import { ApiClient } from "@/lib/api";
import { useToast } from "./ToastProvider";
import type { Deck, MTGCard } from "@/types";

interface DeckDetailProps {
  deckId: string;
}

const exportFormats = [
  { label: "TXT (MTGO/Arena)", value: "txt" },
  { label: "JSON", value: "json" },
  { label: "Moxfield", value: "moxfield" },
];

export default function DeckDetail({ deckId }: DeckDetailProps) {
  const showToast = useToast();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState("txt");
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCommander, setEditCommander] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch deck data on mount
  useEffect(() => {
    async function fetchDeck() {
      setLoading(true);
      setError(null);
      try {
        const api = new ApiClient();
        // Assume getDeckById exists, otherwise fetch from collections or decks endpoint
        const allDecks = (await api.getCollections()) as any[]; // fallback: get all, find by id
        let found: Deck | null = null;
        for (const col of allDecks) {
          if (col.id === deckId && col.cards) {
            found = {
              id: col.id,
              name: col.name,
              commander: col.cards[0], // crude guess, real app should store commander
              cards: col.cards,
              description: col.description || "",
              colors: [],
              total_cards: col.cards.length,
              mana_curve: {},
              created_at: col.created_at,
              updated_at: col.updated_at,
            };
            break;
          }
        }
        if (!found) throw new Error("Deck not found");
        setDeck(found);
        setEditName(found.name);
        setEditDesc(found.description || "");
        setEditCommander(found.commander?.name || "");
      } catch (err: any) {
        setError(err.message || "Failed to load deck");
        showToast(err.message || "Failed to load deck", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Edit deck handler
  const handleEditSave = async () => {
    if (!deck) return;
    setSaving(true);
    try {
      const api = new ApiClient();
      await api.saveCollection({
        ...deck,
        name: editName,
        description: editDesc,
        // Optionally update commander if UI allows
      });
      setDeck({ ...deck, name: editName, description: editDesc });
      setShowDetails(false);
      showToast("Deck updated", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update deck", "error");
    } finally {
      setSaving(false);
    }
  };

  // Export deck handler
  const handleExport = async () => {
    if (!deck) return;
    setExportResult(null);
    setShowExport(true);
    try {
      const api = new ApiClient();
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
        body: JSON.stringify({ deck_data: deck, as_file: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      setExportResult(text);
      showToast("Deck exported", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to export deck", "error");
      setExportResult(null);
    }
  };

  // Download exported deck as file
  const handleDownload = () => {
    if (!exportResult || !deck) return;
    const blob = new Blob([exportResult], { type: exportFormat === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name || "deck"}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Delete deck handler (placeholder, real API needed)
  const handleDelete = () => {
    setShowDelete(false);
    showToast("Deck deleted (not implemented)", "info");
  };

  if (loading) return <div className="text-mtg-white">Loading deck...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!deck) return <div className="text-mtg-white">Deck not found.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-mtg-white mb-4">Deck Details</h1>
      <div className="bg-mtg-gray rounded-xl p-6 text-mtg-white">
        <div className="mb-4"><b>Deck ID:</b> {deck.id}</div>
        <div className="mb-4"><b>Name:</b> {deck.name}</div>
        <div className="mb-4"><b>Commander:</b> {deck.commander?.name || "Unknown"}</div>
        <div className="mb-4"><b>Cards:</b> {deck.cards.length}</div>
        <div className="mb-4"><b>Description:</b> {deck.description || "-"}</div>
        <div className="flex gap-4 mt-6">
          <button className="btn-primary" onClick={() => setShowDetails(true)}>Edit</button>
          <button className="btn-secondary" onClick={handleExport}>Export</button>
          <button className="btn-secondary text-red-500 border-red-500" onClick={() => setShowDelete(true)}>Delete</button>
        </div>
      </div>
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
