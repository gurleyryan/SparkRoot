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
                    <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare"><i className="ms ms-party-wizard mr-2 ms-2x text-mtg-green group-hover:!text-rarity-uncommon"></i> Help & FAQ</h2>
                    <ul className="space-y-4 text-lg mb-6">
                        <li><span className="font-bold text-rarity-rare">Is this an official Magic The Gathering® product?</span></li>
                        <li><span className="text-mtg-white">No. Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is unofficial Fan Content permitted under the <a
                            href="https://company.wizards.com/en/legal/fancontentpolicy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-rarity-mythic hover:text-rarity-uncommon"
                        >
                            Fan Content Policy
                        </a>. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.</span></li>
                        <li><span className="font-bold text-rarity-rare">Something is slow, what gives?</span></li>
                        <li><span className="text-mtg-white">Many features rely on the the Scryfall entries in our Supabase, which contains the full Scryfall data for 108,566+ cards. We use cursor pagination to map uploaded cards to their respective Scryfall entries, and performance will vary depending on the size of the uploaded collection.</span></li>
                        <li><span className="font-bold text-rarity-rare">Something is broken, what gives?</span></li>
                        <li><span className="text-mtg-white">This project is in active development, and testing priority is given to the logged-in user experience. It is recommended to create an account for the best experience, but the goal is for the passing traveler to have a smooth journey as well—just without data persistence. In life there are no guarantees and we appreciate your understanding.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I upload my collection?</span></li>
                        <li><span className="text-mtg-white">Use the Collection page to upload a CSV or Excel file exported from <a
                                href="https://moxfield.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-rarity-mythic hover:text-rarity-uncommon"
                            >
                                Moxfield
                            </a>, <a
                                href="https://manabox.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-rarity-mythic hover:text-rarity-uncommon"
                            >
                                Manabox
                            </a>, or similar tools. You can choose whether to create a new collection or update an existing one, and whether to combine duplicate cards with those already in your account or replace them.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I build a deck?</span></li>
                        <li><span className="text-mtg-white">Go to the Deck Builder page and select your collection and preferences. You can choose your card pool from your inventory or collections, and then select a legal commander. There are generation options for <a
                            href="https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-rarity-mythic hover:text-rarity-uncommon"
                        >
                            Commander Bracket
                        </a>, <a
                            href="https://edhrec.com/top/salt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-rarity-mythic hover:text-rarity-uncommon"
                        >
                                salt
                            </a>, and house rules. House rules are Bracket 1 and no Sol Ring, nonland tutors, or some 'unfun' cards like Armageddon, Winter Orb, and Stasis.</span></li>
                        <li><span className="font-bold text-rarity-rare">How are decks generated?</span></li>
                        <li><span className="text-mtg-white">Currently, deck generation is done with a Python script that was informed by various sources and experiences. No blackbox AI is involved in the process... yet. You can view the code in the <a
                            href="https://github.com/gurleyryan/MTG-Deck-Optimizer"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-rarity-mythic hover:text-rarity-uncommon"
                        >
                            GitHub repository
                        </a>, which also includes a list of citations and attributions.</span></li>
                        <li><span className="font-bold text-rarity-rare">How do I track prices?</span></li>
                        <li><span className="text-mtg-white">The Pricing page is yet to be implemented.</span></li>
                        <li><span className="font-bold text-rarity-rare">Need more help?</span></li>
                        <li><span className="text-mtg-white">
                            Join the                             <a
                                href="https://discord.gg/3TC9QkPSc6"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-rarity-mythic hover:text-rarity-uncommon"
                            >
                                Discord
                            </a>{" "} or check the project{" "}
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
                        <li><span className="font-bold text-rarity-rare">How can I help?</span></li>
                        <li><span className="text-mtg-white">Well, if you insist, then you can check out my music and other creations or donate. My goal for SparkRoot is to establish a precedent for transparency, and I'd like any monetization to be done so ethically. If you have any insight or suggestions, feel free to reach out!</span></li>
                        <li><span className="font-bold text-rarity-rare">Who... who are you?</span></li>
                        <li><span className="text-mtg-white"><a
                            href="https://gurleymusic.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-rarity-mythic hover:text-rarity-uncommon"
                        >
                            Gurley.
                        </a></span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
