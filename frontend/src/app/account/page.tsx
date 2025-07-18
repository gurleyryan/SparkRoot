"use client";
import ProfileSettings from "@/components/ProfileSettings";
import PlaymatSelector from "@/components/PlaymatSelector";

export default function AccountPage() {
  return (
    <div className="max-w-2xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue relative">
      <h2 className="text-3xl font-bold mb-6 text-mtg-white">Account Settings</h2>
      <ProfileSettings />
      <div className="mt-8">
        <PlaymatSelector />
      </div>
    </div>
  );
}