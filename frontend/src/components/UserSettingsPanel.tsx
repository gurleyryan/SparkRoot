import { useAuthStore } from '@/store/authStore';
import React, { useEffect, useState } from 'react';

interface UserSettings {
  price_source: string;
  currency: string;
  reference_price: string;
  profile_public: boolean;
  notifications_enabled: boolean;
  playmat_texture: string | null;
  theme: string;
  default_format: string;
  card_display: string;
  auto_save: boolean;
  notifications: Record<string, boolean | undefined> & {
    price_alerts?: boolean;
    deck_updates?: boolean;
    collection_changes?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

interface SocialIntegration {
  provider: string;
  provider_id: string;
  provider_email: string | null;
  created_at: string;
}

interface ProfileInfo {
  username: string;
  full_name: string;
  avatar_url: string | null;
  email?: string;
  created_at: string;
  updated_at: string;
}

export default function UserSettingsPanel() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [socials] = useState<SocialIntegration[]>([]);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [] = useState<string[]>([ 
    'playmat-texture-white.svg',
    'playmat-texture-blue.svg',
    'playmat-texture-black.svg',
    'playmat-texture-red.svg',
    'playmat-texture-green.svg',
    'playmat-texture-colorless.svg',
    'playmat-texture-multicolored.svg',
    'playmat-texture.svg',
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const fetchWithAuth = useAuthStore.getState().fetchWithAuth;
        const [settingsRes, profileRes] = await Promise.all([
          fetchWithAuth('/api/settings'),
          fetchWithAuth('/api/auth/me'),
        ]);
        if (!settingsRes.ok) {
          const errText = await settingsRes.text();
          setError(`Settings fetch failed: ${settingsRes.status} ${errText}`);
          setLoading(false);
          return;
        }
        if (!profileRes.ok) {
          const errText = await profileRes.text();
          setError(`Profile fetch failed: ${profileRes.status} ${errText}`);
          setLoading(false);
          return;
        }
        const settingsData = await settingsRes.json();
        setSettings(settingsData.settings);
        setProfile(await profileRes.json());
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message || 'Failed to load user data');
        } else {
          setError('Failed to load user data');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Playmat selection handler: updates local state and persists to backend

  // Track initial settings for change detection
  const [initialSettings, setInitialSettings] = useState<UserSettings | null>(null);
  useEffect(() => {
    if (settings && !initialSettings) {
      setInitialSettings(settings);
    }
  }, [settings, initialSettings]);

  function getChangedSettings(): Partial<UserSettings> {
    if (!settings || !initialSettings) return {};
    const changed: Record<string, unknown> = {};
    for (const key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        if (JSON.stringify(settings[key as keyof UserSettings]) !== JSON.stringify(initialSettings[key as keyof UserSettings])) {
          changed[key] = settings[key as keyof UserSettings];
        }
      }
    }
    return changed as Partial<UserSettings>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!settings) {
      setError('Settings not loaded. Cannot save.');
      setSaving(false);
      return;
    }
    const changedSettings = getChangedSettings();
    if (Object.keys(changedSettings).length === 0) {
      setError('No changes to save.');
      setSaving(false);
      return;
    }
    try {
      const fetchWithAuth = useAuthStore.getState().fetchWithAuth;
      const payload = { settings: changedSettings };
      const resp = await fetchWithAuth('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('Settings PUT error:', errorText);
        throw new Error('Failed to save settings');
      } else {
        setInitialSettings(settings);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || 'Failed to save settings');
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-mtg-white">Loading settings...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  // If settings is null, show a message or default form
  if (!settings) return <div className="text-mtg-white">No settings found for this user.</div>;

  return (
    <div className=" rounded-xl mt-8">
      <h2 className="text-2xl font-mtg text-mtg-white mb-6">User Settings</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Column 1: Price Source, Reference Price, Default Format */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Price Source</label>
              <select className="form-input w-full" value={settings?.price_source || ''} onChange={e => setSettings(s => s ? { ...s, price_source: e.target.value } : s)}>
                <option value="tcgplayer">TCGPlayer</option>
                <option value="scryfall">Scryfall</option>
              </select>
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Reference Price</label>
              <select className="form-input w-full" value={settings?.reference_price || ''} onChange={e => setSettings(s => s ? { ...s, reference_price: e.target.value } : s)}>
                <option value="market">Market</option>
                <option value="low">Low</option>
                <option value="mid">Mid</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Default Format <span className="text-xs text-mtg-gray-400">(only Commander supported currently)</span></label>
              <select className="form-input w-full" value={settings?.default_format || ''} onChange={e => setSettings(s => s ? { ...s, default_format: e.target.value } : s)}>
                <option value="commander">Commander</option>
                <option value="standard" disabled>Standard (not supported yet)</option>
                <option value="modern" disabled>Modern (not supported yet)</option>
                <option value="pioneer" disabled>Pioneer (not supported yet)</option>
                <option value="legacy" disabled>Legacy (not supported yet)</option>
                <option value="vintage" disabled>Vintage (not supported yet)</option>
              </select>
            </div>
          </div>
          {/* Column 2: Currency, Theme, Card Display */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Currency <span className="text-xs text-mtg-gray-400">(only USD supported currently)</span></label>
              <select className="form-input w-full" value={settings?.currency || ''} onChange={e => setSettings(s => s ? { ...s, currency: e.target.value } : s)}>
                <option value="USD">USD</option>
                <option value="EUR" disabled>EUR (not supported yet)</option>
                <option value="GBP" disabled>GBP (not supported yet)</option>
                <option value="CAD" disabled>CAD (not supported yet)</option>
                <option value="AUD" disabled>AUD (not supported yet)</option>
              </select>
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Theme</label>
              <select className="form-input w-full" value={settings?.theme || ''} onChange={e => setSettings(s => s ? { ...s, theme: e.target.value } : s)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Card Display</label>
              <select className="form-input w-full" value={settings?.card_display || ''} onChange={e => setSettings(s => s ? { ...s, card_display: e.target.value } : s)}>
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </div>
          </div>
          {/* Column 3: Toggles */}
          <div className="flex flex-col gap-4 justify-center">
            <label className="flex items-center gap-2 text-mtg-white font-semibold">
              <input type="checkbox" checked={!!settings?.profile_public} onChange={e => setSettings(s => s ? { ...s, profile_public: e.target.checked } : s)} /> Profile Public
            </label>
            <label className="flex items-center gap-2 text-mtg-white font-semibold">
              <input type="checkbox" checked={!!settings?.notifications_enabled} onChange={e => setSettings(s => s ? { ...s, notifications_enabled: e.target.checked } : s)} /> Notifications Enabled
            </label>
            <label className="flex items-center gap-2 text-mtg-white font-semibold">
              <input type="checkbox" checked={!!settings?.auto_save} onChange={e => setSettings(s => s ? { ...s, auto_save: e.target.checked } : s)} /> Auto Save
            </label>
          </div>
          {/* Column 4: Notification Preferences */}
          <div className="flex flex-col gap-2 justify-center">
            <label className="block text-mtg-white font-semibold mb-1">Notification Preferences</label>
            <label className="flex items-center gap-2 text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.price_alerts}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, price_alerts: e.target.checked } } : s)}
              /> Price Alerts
            </label>
            <label className="flex items-center gap-2 text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.deck_updates}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, deck_updates: e.target.checked } } : s)}
              /> Deck Updates
            </label>
            <label className="flex items-center gap-2 text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.collection_changes}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, collection_changes: e.target.checked } } : s)}
              /> Collection Changes
            </label>
          </div>
        </div>
        {/* Save button, Social Integrations, Profile Info horizontally */}
        <div className="flex flex-col md:flex-row gap-8 items-start mt-8">
          <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-2 font-semibold transition-colors" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <div className="flex-1">
            <h3 className="text-xl font-mtg text-mtg-white mb-2">Social Integrations</h3>
            {socials.length === 0 ? <div className="text-mtg-gray-400">No social accounts connected.</div> : (
              <ul className="space-y-2">
                {socials.map(s => (
                  <li key={s.provider} className="text-mtg-white">
                     ({s.provider_email || s.provider_id})<br />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-mtg text-mtg-white mb-2">Profile Info</h3>
            {profile && (
              <div className="space-y-2">
                <div><span className="font-semibold">Username:</span> {profile.username}</div>
                <div><span className="font-semibold">Full Name:</span> {profile.full_name}</div>
                <div><span className="font-semibold">Email:</span> {profile.email || '—'}</div>
                <div><span className="font-semibold">Created:</span> {profile.created_at ? new Date(profile.created_at).toLocaleString() : '—'}</div>
                <div><span className="font-semibold">Updated:</span> {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : '—'}</div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
