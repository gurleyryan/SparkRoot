"use client";
import React, { useState } from "react";
import HelpModal from "@/components/HelpModal";

export default function HelpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-lg w-full border border-rarity-uncommon bg-mtg-black text-mtg-white">
        <h2 className="text-3xl font-bold mb-6">Help & FAQ</h2>
        <ul className="space-y-4 text-lg">
          <li><strong>How do I upload my collection?</strong> Use the Collection page to upload a CSV or Excel file exported from Manabox, Moxfield, or similar tools.</li>
          <li><strong>How do I build a deck?</strong> Go to the Deck Builder page and select your collection and preferences.</li>
          <li><strong>How do I track prices?</strong> The Pricing page shows collection value trends, breakdowns, and advanced analytics.</li>
          <li><strong>How do I change my playmat?</strong> Go to Settings and pick a playmat background.</li>
          <li><strong>Need more help?</strong> Contact support or check the project README for more info.</li>
        </ul>
      </div>
    </div>
  );
}
