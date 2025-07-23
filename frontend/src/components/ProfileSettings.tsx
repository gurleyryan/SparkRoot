import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';

export default function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    fullName: user?.full_name || '',
    password: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
      setError('New passwords do not match.');
      setLoading(false);
      return;
    }
    try {
      // Update profile fields (username, email, full_name)
      await updateProfile({
        username: form.username,
        email: form.email,
        full_name: form.fullName,
      });
      // If changing password, call changePassword
      if (form.newPassword) {
        if (!form.password) {
          setError('Current password is required to change password.');
          setLoading(false);
          return;
        }
        await changePassword({
          oldPassword: form.password,
          newPassword: form.newPassword,
        });
      }
      setMessage('Profile updated successfully.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex flex-col backdrop-blur-sm" >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left column */}
          <div className="flex-1 flex flex-col space-y-4">
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Username</label>
              <input name="username" value={form.username} onChange={handleChange} className="form-input w-full" />
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="form-input w-full" />
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Full Name</label>
              <input name="fullName" value={form.fullName} onChange={handleChange} className="form-input w-full" />
            </div>
          </div>
          {/* Right column */}
          <div className="flex-1 flex flex-col space-y-4">
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Current Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} className="form-input w-full" placeholder="Required to change email or password" />
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">New Password</label>
              <input name="newPassword" type="password" value={form.newPassword} onChange={handleChange} className="form-input w-full" />
            </div>
            <div>
              <label className="block text-mtg-white font-semibold mb-1">Confirm New Password</label>
              <input name="confirmNewPassword" type="password" value={form.confirmNewPassword} onChange={handleChange} className="form-input w-full" />
            </div>
          </div>
        </div>
        {error && <div className="text-mtg-red font-mtg-body">{error}</div>}
        {message && <div className="text-mtg-green font-mtg-body">{message}</div>}
        <button type="submit" className="bg-rarity-mythic hover:bg-rarity-rare text-white rounded-lg px-6 py-2 font-semibold transition-colors" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
