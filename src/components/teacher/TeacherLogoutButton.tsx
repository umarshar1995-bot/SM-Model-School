"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TeacherPortalClientHooks() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  }, []);

  return null;
}

export function TeacherLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="min-h-11 rounded-xl border border-blue-300/60 px-4 text-xs font-bold text-white hover:bg-white/10 transition cursor-pointer"
    >
      Sign out
    </button>
  );
}
