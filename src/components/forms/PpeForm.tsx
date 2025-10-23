"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  batchNo?: string | null;
  expiryDate?: Timestamp | null;
  supplier?: string | null;
}

export default function PpeForm() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [userName, setUserName] = useState("");
  const [lab, setLab] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is not configured. Update your Firebase environment variables."
      );
      return;
    }

    setError(null);
    const inventoryRef = collection(firestore, "ppe_inventory");
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => {
        const raw = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          itemName: typeof raw.itemName === "string" ? raw.itemName : "",
          quantity: typeof raw.quantity === "number" ? raw.quantity : 0,
          batchNo: typeof raw.batchNo === "string" ? raw.batchNo : null,
          expiryDate: raw.expiryDate instanceof Timestamp ? raw.expiryDate : null,
          supplier: typeof raw.supplier === "string" ? raw.supplier : null
        } satisfies InventoryItem;
      });
      setInventory(data.filter((item) => item.itemName));
    });
    return () => unsubscribe();
  }, [firestore, firebaseInitError]);

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === itemId) ?? null,
    [inventory, itemId]
  );

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.quantity < 5),
    [inventory]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedQuantity = Number.isFinite(quantity)
      ? Math.max(0, Math.floor(quantity))
      : 0;

    if (!userName || !lab || !itemId || normalizedQuantity <= 0) {
      setError("All fields are required.");
      return;
    }

    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is unavailable. Check your Firebase credentials."
      );
      return;
    }

    const inventoryDocRef = doc(firestore, "ppe_inventory", itemId);

    try {
      setIsSubmitting(true);
      await runTransaction(firestore, async (transaction) => {
        const inventorySnapshot = await transaction.get(inventoryDocRef);
        if (!inventorySnapshot.exists()) {
          throw new Error("Inventory item not found.");
        }
        const currentQuantity = inventorySnapshot.data().quantity as number;
        if (currentQuantity < normalizedQuantity) {
          throw new Error("Requested quantity exceeds available stock.");
        }
        transaction.update(inventoryDocRef, {
          quantity: currentQuantity - normalizedQuantity,
          lastUpdated: serverTimestamp()
        });
      });

      const itemName = selectedItem?.itemName ?? "Unknown";

      await addDoc(collection(firestore, "ppe_logs"), {
        userName,
        lab,
        itemName,
        quantity: normalizedQuantity,
        timestamp: serverTimestamp()
      });

      setSuccess(`Recorded PPE usage: ${itemName} (${normalizedQuantity}).`);
      setUserName("");
      setLab("");
      setItemId("");
      setQuantity(1);
    } catch (submitError) {
      console.warn(submitError);
      setError(getFirebaseErrorMessage(submitError, "Unable to submit PPE log."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">PPE Usage</h2>
        <p className="mt-1 text-sm text-slate-500">Record PPE withdrawn from Lab Store 2.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            User Name
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Jane Doe"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Lab
            <input
              value={lab}
              onChange={(event) => setLab(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="BSL2e-8"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            PPE Item
            <select
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Select an item...</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemName} (Available: {item.quantity})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Quantity
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => {
                const value = Number(event.target.value);
                setQuantity(Number.isFinite(value) ? value : 0);
              }}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-green-600">{success}</p>}
        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
          >
            {isSubmitting ? "Saving..." : "Log PPE Usage"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Low Stock Alerts</h3>
        <p className="mt-1 text-sm text-slate-500">Items below the threshold of 5 units.</p>
        <ul className="mt-4 space-y-3">
          {lowStockItems.length === 0 && <li className="text-sm text-slate-500">Stock levels are healthy.</li>}
          {lowStockItems.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span className="font-semibold">{item.itemName}</span>
              <span>Remaining: {item.quantity}</span>
              {item.expiryDate && (
                <span>
                  Expires: {item.expiryDate.toDate().toLocaleDateString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
