import React from 'react';
import AuthHydrator from '../components/AuthHydrator';
import PlaymatHydrator from '../components/PlaymatHydrator';
import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "MTG Deck Optimizer",
  description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link href="/node_modules/mana-font/css/mana.min.css" rel="stylesheet" type="text/css" />
        <link href="https://cdn.jsdelivr.net/npm/mana-font@latest/css/mana.css" rel="stylesheet" type="text/css" />
        {/* Open Graph for social sharing */}
        <meta property="og:image" content="/logo.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="MTG Deck Optimizer Logo" />

        {/* SVG fallback for platforms that support it */}
        <meta property="og:image" content="/logo.svg" />
        <meta property="og:image:type" content="image/svg+xml" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/logo.png" />

        {/* Structured Data for Google */}
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "MTG Deck Optimizer",
              "url": "https://mtg-deck-optimizer.vercel.app/",
              "logo": "https://mtg-deck-optimizer.vercel.app/logo.png"
            }
          `}
        </script>
      </head>
      <body className="bg-mtg-black text-white antialiased font-mtg-body min-h-screen">
        <AuthHydrator />
        <PlaymatHydrator />
        {children}
        <footer className="w-full text-center text-xs text-mtg-white py-4 mt-8 border-t border-rarity-uncommon">
          Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. This is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.
        </footer>
      </body>
    </html>
  );
}
