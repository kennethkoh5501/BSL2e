"use client";

import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

type Session = {
  id: string;
  userName: string;
  lab: string;
  clockIn: Timestamp | null;
  clockOut: Timestamp | null;
};

type InventoryItem = {
  id: string;
  itemName: string;
  quantity: number;
  expiryDate: Timestamp | null;
};

export default function DashboardPage() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );

  useEffect(() => {
    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is not configured. Add your Firebase credentials to .env.local."
      );
      return;
    }

    setError(null);
    const sessionsRef = collection(firestore, "sessions");
    const activeQuery = query(sessionsRef, where("clockOut", "==", null));
    const unsubscribeSessions = onSnapshot(
      activeQuery,
      (snapshot) => {
        const sessionsData = snapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            id: doc.id,
            userName: typeof raw.userName === "string" ? raw.userName : "",
            lab: typeof raw.lab === "string" ? raw.lab : "",
            clockIn: raw.clockIn instanceof Timestamp ? raw.clockIn : null,
            clockOut: raw.clockOut instanceof Timestamp ? raw.clockOut : null
          } satisfies Session;
        });
        setActiveSessions(sessionsData);
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load active sessions. Check Firestore permissions."
          )
        );
      }
    );

    const inventoryRef = collection(firestore, "ppe_inventory");
    const unsubscribeInventory = onSnapshot(
      inventoryRef,
      (snapshot) => {
        const inventoryData = snapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            id: doc.id,
            itemName: typeof raw.itemName === "string" ? raw.itemName : "",
            quantity: typeof raw.quantity === "number" ? raw.quantity : 0,
            expiryDate: raw.expiryDate instanceof Timestamp ? raw.expiryDate : null
          } satisfies InventoryItem;
        });
        setInventory(inventoryData);
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load PPE inventory data. Check Firestore permissions."
          )
        );
      }
    );

    return () => {
      unsubscribeSessions();
      unsubscribeInventory();
    };
  }, [firestore, firebaseInitError]);

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.quantity < 5),
    [inventory]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          title="Active Users"
          value={activeSessions.length.toString()}
          description="Number of users currently clocked in"
        />
        <DashboardCard
          title="PPE Items"
          value={inventory.length.toString()}
          description="Total items tracked in inventory"
        />
        <DashboardCard
          title="Low Stock Alerts"
          value={lowStockItems.length.toString()}
          description="Items needing restock attention"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active Sessions</h2>
            <Link className="text-sm text-primary hover:underline" href="/clock-in">
              Manage
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {activeSessions.length === 0 && <li>No active sessions right now.</li>}
            {activeSessions.map((session) => (
              <li key={session.id} className="rounded-lg border border-slate-100 p-3">
                <div className="font-medium text-slate-900">{session.userName}</div>
                <div className="text-xs text-slate-500">Lab: {session.lab}</div>
                <div className="text-xs text-slate-500">
                  Clocked in at: {formatTimestamp(session.clockIn)}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <span className="text-xs uppercase tracking-wide text-slate-400">Shortcuts</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/clock-in", label: "Clock In" },
              { href: "/bsl2e-log", label: "BSL2e Log" },
              { href: "/ppe-log", label: "PPE Log" },
              { href: "/admin", label: "Admin Panel" }
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex h-24 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
              >
                {action.label}
                <span className="text-xs text-slate-400">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
