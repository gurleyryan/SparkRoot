"use client";
import React from "react";
import ProfileSettings from "./ProfileSettings";
import PlaymatSelector from "./PlaymatSelector";
import UserSettingsPanel from "./UserSettingsPanel";

export default function AccountPage() {
  const [] = React.useState(false);
  return (
    <div className="min-h-screen">
      <div className="container sleeve-morphism mx-auto p-8 rounded-xl relative" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
        <h2 className="text-3xl font-bold mb-6 text-mtg-white">Account</h2>
        <ProfileSettings />
        <div className="mt-8">
          <PlaymatSelector />
        </div>
        <UserSettingsPanel />
      </div>
    </div>
  );
}
