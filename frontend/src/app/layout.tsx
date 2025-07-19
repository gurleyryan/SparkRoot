import React from 'react';
import AuthHydrator from '../components/AuthHydrator';
import PlaymatHydrator from '../components/PlaymatHydrator';
import { ToastProvider } from '../components/ToastProvider';
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
  icons: [
    { rel: "icon", url: "/favicon.ico", type: "image/x-icon" },
    { rel: "icon", url: "/logo.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/logo.png", type: "image/png" },
    { rel: "apple-touch-icon", url: "/logo.png" },
  ],
  openGraph: {
    type: "website",
    url: "https://mtgdeckoptimizer.com/",
    title: "MTG Deck Optimizer",
    description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
    images: [
      {
        url: "https://mtgdeckoptimizer.com/logo.png",
        width: 512,
        height: 512,
        alt: "MTG Deck Optimizer Logo",
        type: "image/png",
      },
      {
        url: "https://mtgdeckoptimizer.com/logo.svg",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MTG Deck Optimizer",
    description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
    images: ["https://mtgdeckoptimizer.com/logo.png"],
    site: "@MTGDeckOptimizer",
  },
  metadataBase: new URL("https://mtgdeckoptimizer.com/"),
  themeColor: "#1a1a1a",
  viewport: "width=device-width, initial-scale=1",
  other: {
    // Schema.org JSON-LD for rich results
    'ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'MTG Deck Optimizer',
      'url': 'https://mtgdeckoptimizer.com/',
      'description': 'Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.',
      'applicationCategory': 'ProductivityApplication',
      'operatingSystem': 'All',
      'image': 'https://mtgdeckoptimizer.com/logo.png',
      'author': {
        '@type': 'Organization',
        'name': 'MTG Deck Optimizer'
      },
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      }
    })
  }
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="stylesheet" href="/fonts/mana-font/mana.min.css" />
      </head>
      <body className="text-white antialiased font-mtg-body min-h-screen">
        <ToastProvider>
          <AuthHydrator />
          <PlaymatHydrator />
          {children}
          <footer
            className="bg-mtg-black/50 font-mtg-body w-full text-center text-xs text-mtg-white py-4 mt-8"
            style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb), 0.5)" }}
          >
            Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. This is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}