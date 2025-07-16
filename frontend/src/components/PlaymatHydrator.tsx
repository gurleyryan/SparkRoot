"use client";
import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

export default function PlaymatHydrator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playmat_texture = useAuthStore((s) => s.playmat_texture);
  const [bgPlaymat, setBgPlaymat] = useState<string | null>(null);

  useEffect(() => {
    async function pickRandomPlaymat() {
      if (!isAuthenticated) {
        try {
          const resp = await fetch("/api/playmats");
          const data = await resp.json();
          if (data.success && Array.isArray(data.files) && data.files.length > 0) {
            const random = data.files[Math.floor(Math.random() * data.files.length)];
            setBgPlaymat(`url('/${random}')`);
          }
        } catch {}
      } else {
        setBgPlaymat(playmat_texture ? `url('/${playmat_texture}')` : null);
      }
    }
    pickRandomPlaymat();
  }, [isAuthenticated, playmat_texture]);

  useEffect(() => {
    if (bgPlaymat) {
      document.body.style.backgroundImage = bgPlaymat;
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    } else {
      document.body.style.backgroundImage = '';
    }
  }, [bgPlaymat]);

  return null;
}
