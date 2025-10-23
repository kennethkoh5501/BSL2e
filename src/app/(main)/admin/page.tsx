"use client";

import { useState } from "react";
import PathogenRules from "@/components/admin/PathogenRules";
import PpeInventory from "@/components/admin/PpeInventory";
import UserLogs from "@/components/admin/UserLogs";
import DataExport from "@/components/admin/DataExport";

const tabs = [
  { id: "rules", label: "Pathogen Rules" },
  { id: "inventory", label: "PPE Inventory" },
  { id: "logs", label: "User Logs" },
  { id: "export", label: "Data Export" }
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Control Center</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage biosafety rules, PPE inventory, user logs, and export compliance reports.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "rules" && <PathogenRules />}
      {activeTab === "inventory" && <PpeInventory />}
      {activeTab === "logs" && <UserLogs />}
      {activeTab === "export" && <DataExport />}
    </div>
  );
}
