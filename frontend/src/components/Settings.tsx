import React from "react";
import PlaymatSelector from "./PlaymatSelector";

export default function Settings() {
  // Placeholder for future theme support
  // const [theme, setTheme] = useState('dark');

  return (
    <div className="max-w-2xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue relative">
      <h2 className="text-3xl font-bold mb-6 text-mtg-white">Settings</h2>
      {/* Theme selection (future) */}
      {/* <div className="mb-8">
        <label className="block text-mtg-white font-mtg-body mb-2">Theme</label>
        <select
          className="form-input px-4 py-2 rounded border border-mtg-blue bg-black text-white"
          value={theme}
          onChange={e => setTheme(e.target.value)}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div> */}
      <div className="mb-8">
        <PlaymatSelector />
      </div>
      {/* Add more user preferences here */}
    </div>
  );
}
