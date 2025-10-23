"use client";

import { useEffect, useState } from "react";
import UserGuideModal from "@/components/modals/UserGuideModal";

const STORAGE_KEY = "labwatch.userGuideDismissed";

export default function Header() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setShowGuide(true);
    }
  }, []);

  const closeGuide = () => {
    setShowGuide(false);
    window.localStorage.setItem(STORAGE_KEY, "true");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">LabWatch BSL2e</h1>
        <p className="text-sm text-slate-500">Real-time laboratory operations dashboard</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/10"
        >
          User Guide
        </button>
      </div>
      <UserGuideModal open={showGuide} onClose={closeGuide} />
    </header>
  );
}
