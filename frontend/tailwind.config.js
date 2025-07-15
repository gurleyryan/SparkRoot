/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // MTG Color Identity
        'mtg-white': '#FFFBD5',
        'mtg-blue': '#0E68AB',
        'mtg-black': '#150B00',
        'mtg-red': '#D3202A',
        'mtg-green': '#00733E',
        
        // MTG Rarity Colors
        'rarity-common': '#1a1a1a',
        'rarity-uncommon': '#c0c0c0',
        'rarity-rare': '#ffd700',
        'rarity-mythic': '#ff8c00',
        
        // Dark theme base
        'dark-bg': '#0f0f0f',
        'dark-surface': '#1a1a1a',
        'dark-border': '#333333',
      },
      fontFamily: {
        // Primary MTG font stack using Next.js optimized fonts
        'mtg': [
          'var(--font-cinzel)', // Next.js optimized Cinzel
          'Times New Roman', // System fallback
          'serif'
        ],
        // For special headings and card names
        'mtg-display': [
          'var(--font-cinzel)', // Next.js optimized Cinzel
          'serif'
        ],
        // Clean body text font
        'mtg-body': [
          'var(--font-source-sans)', // Next.js optimized Source Sans 3
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif'
        ],
        // Monospace for code/data
        'mtg-mono': [
          'var(--font-jetbrains-mono)', // Next.js optimized JetBrains Mono
          'Consolas',
          'Monaco',
          'monospace'
        ]
      },
      boxShadow: {
        'rarity-common': '0 0 10px rgba(128, 128, 128, 0.3)',
        'rarity-uncommon': '0 0 10px rgba(192, 192, 192, 0.4)',
        'rarity-rare': '0 0 15px rgba(255, 215, 0, 0.5)',
        'rarity-mythic': '0 0 20px rgba(255, 140, 0, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
