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
  created_at: string;
  updated_at: string;
}

export default function UserSettingsPanel() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [socials, setSocials] = useState<SocialIntegration[]>([]);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [playmatOptions, setPlaymatOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [settingsRes, socialsRes, profileRes, playmatsRes] = await Promise.all([
          fetch('/api/user/settings'),
          fetch('/api/user/socials'),
          fetch('/api/user/profile'),
          fetch('/api/playmats'),
        ]);
        if (!settingsRes.ok || !socialsRes.ok || !profileRes.ok || !playmatsRes.ok)
          throw new Error('Failed to load user data');
        setSettings(await settingsRes.json());
        setSocials(await socialsRes.json());
        setProfile(await profileRes.json());
        const playmatData = await playmatsRes.json();
        setPlaymatOptions(Array.isArray(playmatData.files) ? playmatData.files : []);
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error('Failed to save settings');
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

  return (
    <div className="bg-slate-900/80 p-8 rounded-xl border border-rarity-uncommon mt-8">
      <h2 className="text-2xl font-mtg text-mtg-white mb-6">User Settings</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Price Source</label>
            <input className="form-input w-full" value={settings?.price_source || ''} onChange={e => setSettings(s => s ? { ...s, price_source: e.target.value } : s)} />
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Currency</label>
            <input className="form-input w-full" value={settings?.currency || ''} onChange={e => setSettings(s => s ? { ...s, currency: e.target.value } : s)} />
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Reference Price</label>
            <input className="form-input w-full" value={settings?.reference_price || ''} onChange={e => setSettings(s => s ? { ...s, reference_price: e.target.value } : s)} />
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Theme</label>
            <select className="form-input w-full" value={settings?.theme || ''} onChange={e => setSettings(s => s ? { ...s, theme: e.target.value } : s)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Default Format</label>
            <input className="form-input w-full" value={settings?.default_format || ''} onChange={e => setSettings(s => s ? { ...s, default_format: e.target.value } : s)} />
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Card Display</label>
            <select className="form-input w-full" value={settings?.card_display || ''} onChange={e => setSettings(s => s ? { ...s, card_display: e.target.value } : s)}>
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </div>
          <div>
            <label className="block text-mtg-white font-semibold mb-1">Playmat Texture</label>
            <select className="form-input w-full" value={settings?.playmat_texture || ''} onChange={e => setSettings(s => s ? { ...s, playmat_texture: e.target.value } : s)}>
              <option value="">Classic</option>
              {playmatOptions.map((file) => (
                <option key={file} value={file}>{file.replace('playmat-texture', '').replace(/[-_.]/g, ' ').replace(/\.[a-zA-Z0-9]+$/, '').trim() || 'Classic'}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-4 items-center mt-4 flex-wrap">
          <label className="text-mtg-white font-semibold">Profile Public</label>
          <input type="checkbox" checked={!!settings?.profile_public} onChange={e => setSettings(s => s ? { ...s, profile_public: e.target.checked } : s)} />
          <label className="text-mtg-white font-semibold">Notifications Enabled</label>
          <input type="checkbox" checked={!!settings?.notifications_enabled} onChange={e => setSettings(s => s ? { ...s, notifications_enabled: e.target.checked } : s)} />
          <label className="text-mtg-white font-semibold">Auto Save</label>
          <input type="checkbox" checked={!!settings?.auto_save} onChange={e => setSettings(s => s ? { ...s, auto_save: e.target.checked } : s)} />
        </div>
        {/* Notifications JSON */}
        <div className="mt-4">
          <label className="block text-mtg-white font-semibold mb-1">Notification Preferences</label>
          <div className="flex gap-4 flex-wrap">
            <label className="text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.price_alerts}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, price_alerts: e.target.checked } } : s)}
              /> Price Alerts
            </label>
            <label className="text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.deck_updates}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, deck_updates: e.target.checked } } : s)}
              /> Deck Updates
            </label>
            <label className="text-mtg-white">
              <input
                type="checkbox"
                checked={!!settings?.notifications?.collection_changes}
                onChange={e => setSettings(s => s ? { ...s, notifications: { ...s.notifications, collection_changes: e.target.checked } } : s)}
              /> Collection Changes
            </label>
          </div>
        </div>
        <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-2 font-semibold transition-colors" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
      {/* Social Integrations */}
      <div className="mt-8">
        <h3 className="text-xl font-mtg text-mtg-white mb-2">Social Integrations</h3>
        {socials.length === 0 ? <div className="text-mtg-gray-400">No social accounts connected.</div> : (
          <ul className="space-y-2">
            {socials.map(s => (
              <li key={s.provider} className="text-mtg-white">
                <span className="font-semibold">{s.provider}</span> ({s.provider_email || s.provider_id})<br />
                <span className="text-xs text-mtg-gray-400">Connected: {new Date(s.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Profile Info */}
      <div className="mt-8">
        <h3 className="text-xl font-mtg text-mtg-white mb-2">Profile Info</h3>
        {profile && (
          <div className="text-mtg-white">
            <div><span className="font-semibold">Username:</span> {profile.username}</div>
            <div><span className="font-semibold">Full Name:</span> {profile.full_name}</div>
            <div>
              <span className="font-semibold">Avatar:</span>{' '}
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="inline w-8 h-8 rounded-full" /> : 'None'}
            </div>
            <div><span className="font-semibold">Created:</span> {new Date(profile.created_at).toLocaleString()}</div>
            <div><span className="font-semibold">Updated:</span> {new Date(profile.updated_at).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
