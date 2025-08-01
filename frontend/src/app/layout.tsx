import React, { Suspense } from 'react';
import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import ClientShell from './ClientShell';

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
        url: "https://www.sparkroot.cards/SparkRootBanner.png",
        width: 1280,
        height: 640,
        alt: "SparkRoot Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SparkRoot",
    description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
    images: ["https://www.sparkroot.cards/SparkRootBanner.png"],
    site: "@SparkRoot",
  },
  metadataBase: new URL("https://www.sparkroot.cards/"),
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const themeColor = "#DCBF7D";

// Server Component RootLayout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preload" as="font" href="/fonts/mana-font/mana.woff?v=1.18.0" type="font/woff" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/fonts/mana-font/mana.min.css" />
        <meta property="og:image" content="https://www.sparkroot.cards/SparkRootBanner.png" />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="640" />
        <meta name="twitter:image" content="https://www.sparkroot.cards/SparkRootBanner.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body className="text-white antialiased font-mtg-body min-h-screen">
        <Suspense fallback={null}>
          <ClientShell>{children}</ClientShell>
        </Suspense>
      </body>
    </html>
  );
}