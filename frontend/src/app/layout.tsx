import React from 'react';
import AuthHydrator from '../components/AuthHydrator';
import PlaymatHydrator from '../components/PlaymatHydrator';
import { ToastProvider } from '../components/ToastProvider';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
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
  title: "SparkRoot",
  description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
  icons: [
    { rel: "icon", url: "/favicon.ico", type: "image/x-icon" },
    { rel: "icon", url: "/logo.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/logo.png", type: "image/png" },
    { rel: "apple-touch-icon", url: "/logo.png" },
  ],
  openGraph: {
    type: "website",
    url: "https://www.sparkroot.cards/",
    title: "SparkRoot",
    description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
    images: [
      {
        url: "https://www.sparkroot.cards/logo.png",
        width: 512,
        height: 512,
        alt: "SparkRoot Logo",
        type: "image/png",
      },
      {
        url: "https://www.sparkroot.cards/logo.svg",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SparkRoot",
    description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
    images: ["https://www.sparkroot.cards/logo.png"],
    site: "@SparkRoot",
  },
  metadataBase: new URL("https://www.sparkroot.cards/"),
  themeColor: "#1a1a1a",
  viewport: "width=device-width, initial-scale=1",
  other: {
    // Schema.org JSON-LD for rich results
    'ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'SparkRoot',
      'url': 'https://www.sparkroot.cards/',
      'description': 'Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.',
      'applicationCategory': 'ProductivityApplication',
      'operatingSystem': 'All',
      'image': 'https://www.sparkroot.cards/logo.png',
      'author': {
        '@type': 'Organization',
        'name': 'SparkRoot'
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
          <Analytics />
          <SpeedInsights />
          <footer
            className="bg-mtg-black/50 font-mtg-body w-full text-center text-xs text-mtg-white py-4 mt-8"
            style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb), 0.5)" }}
          >
            Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}