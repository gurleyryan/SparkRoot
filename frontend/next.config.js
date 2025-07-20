/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Temporarily disable ESLint during builds for optimization testing
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep TypeScript checking enabled
    ignoreBuildErrors: false,
  },
  images: {
    domains: [
      'c1.scryfall.com',
      'c2.scryfall.com',
      'c3.scryfall.com',
      'c4.scryfall.com',
      'img.scryfall.com',
      'cards.scryfall.io',
      'api.scryfall.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.scryfall.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'c1.scryfall.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'c2.scryfall.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'c3.scryfall.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'c4.scryfall.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.scryfall.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
