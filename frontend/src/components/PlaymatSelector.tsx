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
      try {
        const resp = await fetch('/api/playmats');
        const data = await resp.json();
        if (data.success && Array.isArray(data.files)) {
          setPlaymatOptions(
            data.files.map((file: string, idx: number) => ({
              label: `Playmat ${idx + 1}`,
              value: file,
              preview: `/${file}`,
            }))
          );
        }
      } catch {
        // ...removed empty block...
      }
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
              <span className="text-xs text-mtg-blue mt-1">Selected</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
