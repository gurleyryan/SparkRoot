import React from 'react';
import { useAuthStore } from '@/store/authStore';

interface PlaymatOption {
  label: string;
  value: string;
  preview: string;
}

export default function PlaymatSelector() {
  const playmat_texture = useAuthStore((s) => s.playmat_texture);
  const setPlaymatTexture = useAuthStore((s) => s.setPlaymatTexture);
  const playmatFiles = [
    'playmat-texture-white.svg',
    'playmat-texture-blue.svg',
    'playmat-texture-black.svg',
    'playmat-texture-red.svg',
    'playmat-texture-green.svg',
    'playmat-texture-colorless.svg',
    'playmat-texture-multicolored.svg',
    'playmat-texture.svg',
  ];
  const loreMap: Record<string, string> = {
    white: 'Plains',
    blue: 'Island',
    black: 'Swamp',
    red: 'Mountain',
    green: 'Forest',
    colorless: 'Colorless',
    multicolored: 'Multicolored',
    classic: 'Classic',
  };
  const playmatOptions: PlaymatOption[] = playmatFiles.map((file) => {
    const match = file.match(/playmat-texture-?([a-z]*)/i);
    let key = match && match[1] ? match[1].toLowerCase() : '';
    if (!key) key = 'classic';
    const label = loreMap[key] || (file.replace('playmat-texture', '').replace(/[-_.]/g, ' ').replace(/\.[a-zA-Z0-9]+$/, '').trim() || 'Classic');
    return {
      label,
      value: file,
      preview: `/${file}`,
    };
  });

  return (
    <div className="mb-8">
      <h3 className="font-mtg text-xl mb-2 text-mtg-white">Choose Your Playmat</h3>
      <div className="flex gap-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-mtg-blue/60 scrollbar-track-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
        {playmatOptions.map((option) => (
          <div key={option.value} className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 180 }}>
            <div
              className={`border-4 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${playmat_texture === option.value ? 'border-rarity-mythic shadow-lg' : 'border-rarity-uncommon hover:border-mtg-blue'}`}
              style={{ width: 180, height: 120 }}
              onClick={() => setPlaymatTexture(option.value)}
            >
              <img src={option.preview} alt={option.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span className="mt-2 text-mtg-white font-mtg-body text-sm">{option.label}</span>
            {playmat_texture === option.value && (
              <span className="text-sm text-mtg-blue mt-1">Selected</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
