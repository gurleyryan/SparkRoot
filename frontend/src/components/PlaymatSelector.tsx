import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

interface PlaymatOption {
  label: string;
  value: string;
  preview: string;
}

export default function PlaymatSelector() {
  const playmat_texture = useAuthStore((s) => s.playmat_texture);
  const setPlaymatTexture = useAuthStore((s) => s.setPlaymatTexture);
  const [playmatOptions, setPlaymatOptions] = useState<PlaymatOption[]>([]);

  useEffect(() => {
    async function fetchPlaymats() {
  return (
    <div className="mb-8">
      <h3 className="font-mtg text-xl mb-2 text-mtg-white">Choose Your Playmat</h3>
      <div className="flex gap-6 overflow-x-auto md:flex-wrap md:overflow-x-visible pb-2" style={{maxWidth: '100vw'}}>
        {playmatOptions.map((option) => (
          <div key={option.value} className="flex flex-col items-center min-w-[96px] md:min-w-0 relative">
            <button
              type="button"
              className={`rounded-lg border-2 ${playmat_texture === option.value ? 'border-mtg-blue ring-2 ring-mtg-blue' : 'border-slate-700'} focus:outline-none focus:ring-2 focus:ring-mtg-blue transition-all`}
              style={{ width: 80, height: 56, backgroundImage: `url('${option.preview}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              aria-label={`Select ${option.label}`}
              onClick={() => setPlaymatTexture(option.value)}
            >
              {playmat_texture === option.value && (
                <span className="absolute top-1 right-1 bg-mtg-blue text-white rounded-full px-2 py-0.5 text-sm font-bold shadow">✓</span>
              )}
            </button>
            <span className="mt-2 text-sm text-mtg-white">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
    }
    fetchPlaymats();
  }, []);

  return (
    <div className="mb-8">
      <h3 className="font-mtg text-xl mb-2 text-mtg-white">Choose Your Playmat</h3>
      <div className="flex gap-6">
        {playmatOptions.map((option) => (
          <div key={option.value} className="flex flex-col items-center">
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
