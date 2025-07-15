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
  title: "MTG Collection Optimizer",
  description: "Optimize and manage your Magic: The Gathering collection with advanced filtering, pricing, and deck building tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-gray-900 text-white antialiased font-mtg-body">
        {children}
      </body>
    </html>
  );
}
