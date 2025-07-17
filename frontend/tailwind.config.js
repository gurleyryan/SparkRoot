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
        /* MTG-inspired color palette */

        // Green (Forest)
        'mtg-green': '#00733E',
        'mtg-green-rgb': '0, 115, 62',
        'mtg-green-bg': '#C4D3CA',
        'mtg-green-bg-rgb': '196, 211, 202',

        // Blue (Island)
        'mtg-blue': '#0E68AB',
        'mtg-blue-rgb': '14, 104, 171',
        'mtg-blue-bg': '#B3CEEA',
        'mtg-blue-bg-rgb': '179, 206, 234',

        // Red (Mountain)
        'mtg-red': '#D3202A',
        'mtg-red-rgb': '211, 32, 42',
        'mtg-red-bg': '#EB9F82',
        'mtg-red-bg-rgb': '235, 159, 130',

        // White (Plains)
        'mtg-white': '#F9FAF4',
        'mtg-white-rgb': '249, 250, 244',
        'mtg-white-bg': '#F8E7B9',
        'mtg-white-bg-rgb': '248, 231, 185',

        // Black (Swamp)
        'mtg-black': '#150B00',
        'mtg-black-rgb': '21, 11, 0',
        'mtg-black-bg': '#A69F9D',
        'mtg-black-bg-rgb': '166, 159, 157',

        // Rarity colors
        'rarity-common': '#231F20',
        'rarity-common-rgb': '35, 31, 32',
        'rarity-uncommon': '#BBE2EF',
        'rarity-uncommon-rgb': '187, 226, 239',
        'rarity-rare': '#DCBF7D',
        'rarity-rare-rgb': '220, 191, 125',
        'rarity-mythic': '#F8991C',
        'rarity-mythic-rgb': '248, 153, 28',

        // Dark theme base
        'dark-bg': '#0f0f0f',
        'dark-surface': '#1a1a1a',
        'dark-border': '#333333',
      },
      fontFamily: {
        mtg: [
          'Cinzel',
          'Times New Roman',
          'serif'
        ],
        'mtg-display': [
          'Cormorant Small Caps',
          'Cinzel',
          'serif'
        ],
        'mtg-body': [
          'Crimson Text',
          'Lora',
          'serif'
        ],
        'mtg-mono': [
          'EB Garamond',
          'Cormorant',
          'JetBrains Mono',
          'Consolas',
          'Monaco',
          'monospace'
        ],
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
