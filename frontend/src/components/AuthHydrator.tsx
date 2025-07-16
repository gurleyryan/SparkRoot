"use client";
import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

export default function AuthHydrator() {
  const rehydrateUser = useAuthStore((s) => s.rehydrateUser);
  useEffect(() => {
    rehydrateUser && rehydrateUser();
  }, [rehydrateUser]);
  return null;
}
