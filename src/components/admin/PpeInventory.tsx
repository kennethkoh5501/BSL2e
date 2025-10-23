"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

interface InventoryRecord {
  id: string;
  itemName: string;
  quantity: number;
  batchNo: string | null;
  expiryDate: Timestamp | null;
  supplier: string | null;
  lastUpdated: Timestamp | null;
}

export default function PpeInventory() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newQuantity, setNewQuantity] = useState(0);
  const [newBatch, setNewBatch] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );
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
    const inventoryQuery = query(collection(firestore, "ppe_inventory"), orderBy("itemName", "asc"));
    const unsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => {
        const raw = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          itemName: typeof raw.itemName === "string" ? raw.itemName : "",
          quantity: typeof raw.quantity === "number" ? raw.quantity : 0,
          batchNo: typeof raw.batchNo === "string" ? raw.batchNo : null,
          supplier: typeof raw.supplier === "string" ? raw.supplier : null,
          expiryDate: raw.expiryDate instanceof Timestamp ? raw.expiryDate : null,
          lastUpdated: raw.lastUpdated instanceof Timestamp ? raw.lastUpdated : null
        } satisfies InventoryRecord;
      });
      setInventory(data);
    });
    return () => unsubscribe();
  }, [firestore, firebaseInitError]);

  const lowStock = useMemo(() => inventory.filter((item) => item.quantity < 5), [inventory]);

  const addAuditEntry = async (actionType: string, target: string) => {
    if (!firestore) {
      throw firebaseInitError ?? new Error("Firestore is not configured.");
    }

    await addDoc(collection(firestore, "audit_trail"), {
      adminName: "Admin",
      actionType,
      target,
      timestamp: serverTimestamp()
    });
  };

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!newItemName || newQuantity <= 0) {
      setError("Item name and positive quantity are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      await addDoc(collection(firestore, "ppe_inventory"), {
        itemName: newItemName,
        quantity: newQuantity,
        batchNo: newBatch || null,
        supplier: newSupplier || null,
        expiryDate: newExpiry ? Timestamp.fromDate(new Date(newExpiry)) : null,
        lastUpdated: serverTimestamp()
      });
      await addAuditEntry("Add PPE Item", newItemName);
      setNewItemName("");
      setNewQuantity(0);
      setNewBatch("");
      setNewSupplier("");
      setNewExpiry("");
    } catch (submitError) {
      console.warn(submitError);
      setError(getFirebaseErrorMessage(submitError, "Unable to add inventory item."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const restockItem = async (id: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a quantity to restock.");
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setError("Enter a valid quantity.");
      return;
    }

    const normalized = Math.max(0, Math.floor(parsed));
    const item = inventory.find((entry) => entry.id === id);

    if (!item) {
      setError("Inventory item not found.");
      return;
    }

    if (item.quantity === normalized) {
      return;
    }

    try {
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      setError(null);

      await updateDoc(doc(firestore, "ppe_inventory", id), {
        quantity: normalized,
        lastUpdated: serverTimestamp()
      });
      const name = item.itemName || id;
      await addAuditEntry("Restock PPE", `${name} -> ${normalized}`);
    } catch (restockError) {
      console.warn(restockError);
      setError(getFirebaseErrorMessage(restockError, "Unable to update inventory."));
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAddItem}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">Add PPE Item</h3>
        <p className="mt-1 text-sm text-slate-500">Capture batch numbers, suppliers, and expiry for traceability.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Item Name
            <input
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Nitrile Gloves"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Quantity
            <input
              type="number"
              min={0}
              value={newQuantity}
              onChange={(event) => setNewQuantity(Number(event.target.value))}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Batch / Lot Number
            <input
              value={newBatch}
              onChange={(event) => setNewBatch(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Supplier
            <input
              value={newSupplier}
              onChange={(event) => setNewSupplier(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Expiry Date
            <input
              type="date"
              value={newExpiry}
              onChange={(event) => setNewExpiry(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
          >
            {isSubmitting ? "Saving..." : "Add Item"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Inventory Overview</h3>
            <p className="mt-1 text-sm text-slate-500">Track current stock levels and expiry dates.</p>
          </div>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
            {lowStock.length} low stock
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {inventory.length === 0 && <p className="text-sm text-slate-500">No PPE items added yet.</p>}
          {inventory.map((item) => (
            <article key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{item.itemName}</h4>
                  <p className="text-xs text-slate-500">
                    Batch {item.batchNo ?? "–"} · Supplier {item.supplier ?? "–"}
                  </p>
                  {item.expiryDate && (
                    <p className="text-xs text-slate-500">
                      Expires on {item.expiryDate.toDate().toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={item.quantity}
                    onBlur={(event) => restockItem(item.id, event.target.value)}
                    className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">units</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${item.quantity < 5 ? "bg-red-400" : "bg-primary"}`}
                  style={{ width: `${Math.min(item.quantity, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Last updated: {item.lastUpdated ? item.lastUpdated.toDate().toLocaleString() : "–"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
