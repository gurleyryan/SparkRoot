"use client";

export default function HelpPage() {
  // FAQPage JSON-LD schema for Google rich results
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How do I upload my collection?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use the Collection page to upload a CSV or Excel file exported from Manabox, Moxfield, or similar tools."
        }
      },
      {
        "@type": "Question",
        "name": "How do I build a deck?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Go to the Deck Builder page and select your collection and preferences."
        }
      },
      {
        "@type": "Question",
        "name": "How do I track prices?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Pricing page shows collection value trends, breakdowns, and advanced analytics."
        }
      },
      {
        "@type": "Question",
        "name": "How do I change my playmat?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Go to Settings and pick a playmat background."
        }
      },
      {
        "@type": "Question",
        "name": "Need more help?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Contact support or check the project README at https://github.com/gurleyryan/MTG-Deck-Optimizer for more info."
        }
      }
    ]
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-lg w-full border border-rarity-uncommon bg-mtg-black text-mtg-white">
          <h2 className="text-3xl font-bold mb-6">Help & FAQ</h2>
          <ul className="space-y-4 text-lg">
            <li><strong>How do I upload my collection?</strong> Use the Collection page to upload a CSV or Excel file exported from Manabox, Moxfield, or similar tools.</li>
            <li><strong>How do I build a deck?</strong> Go to the Deck Builder page and select your collection and preferences.</li>
            <li><strong>How do I track prices?</strong> The Pricing page shows collection value trends, breakdowns, and advanced analytics.</li>
            <li><strong>How do I change my playmat?</strong> Go to Settings and pick a playmat background.</li>
            <li><strong>Need more help?</strong> Contact support or check the project <a href="https://github.com/gurleyryan/MTG-Deck-Optimizer" target="_blank" rel="noopener noreferrer" className="underline text-mtg-blue hover:text-mtg-white">README</a> for more info.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
