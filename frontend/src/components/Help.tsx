import React from "react";

export interface HelpProps {
    // Optionally allow passing FAQ data or custom className
    className?: string;
}

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

export default function Help({ className = "" }: HelpProps) {
    return (
        <div className={`min-h-screen ${className}`}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="container mx-auto sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
                <div className="container mx-auto w-full shadow-md px-4 py-0 flex flex-col">
                    <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare">Help & FAQ</h2>
                    <ul className="space-y-4 text-lg mb-6">
                        <li><span className="font-bold text-rarity-rare">How do I upload my collection?</span></li>
                        <li><span className="text-mtg-white">Use the Collection page to upload a CSV or Excel file exported from Manabox, Moxfield, or similar tools.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I build a deck?</span></li>
                        <li><span className="text-mtg-white">Go to the Deck Builder page and select your collection and preferences.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I track prices?</span></li>
                        <li><span className="text-mtg-white">The Pricing page shows collection value trends, breakdowns, and advanced analytics.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I change my playmat?</span></li>
                        <li><span className="text-mtg-white">Go to Settings and pick a playmat background.</span></li>
                        <li><span className="font-bold text-rarity-rare">Need more help?</span></li>
                        <li><span className="text-mtg-white">
                            Contact support or check the project{" "}
                            <a
                                href="https://github.com/gurleyryan/MTG-Deck-Optimizer"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-rarity-mythic hover:text-rarity-uncommon"
                            >
                                README
                            </a>{" "}
                            for more info.
                        </span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
