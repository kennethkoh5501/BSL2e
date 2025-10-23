"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

interface RuleRecord {
  id: string;
  pathogenA: string;
  pathogenB: string;
  createdAt?: Timestamp;
}

export default function PathogenRules() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [pathogenA, setPathogenA] = useState("");
  const [pathogenB, setPathogenB] = useState("");
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
    const rulesQuery = query(collection(firestore, "pathogen_rules"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      rulesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((snapshotDoc) => {
          const raw = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            pathogenA: typeof raw.pathogenA === "string" ? raw.pathogenA : "",
            pathogenB: typeof raw.pathogenB === "string" ? raw.pathogenB : "",
            createdAt: raw.createdAt instanceof Timestamp ? raw.createdAt : undefined
          } satisfies RuleRecord;
        });
        setRules(data.filter((rule) => rule.pathogenA && rule.pathogenB));
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load pathogen rules. Check Firestore permissions."
          )
        );
      }
    );
    return () => unsubscribe();
  }, [firestore, firebaseInitError]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedA = pathogenA.trim();
    const normalizedB = pathogenB.trim();

    if (!normalizedA || !normalizedB) {
      setError("Both pathogens are required.");
      return;
    }

    if (normalizedA.toLowerCase() === normalizedB.toLowerCase()) {
      setError("Pathogens must be different.");
      return;
    }

    const duplicate = rules.some((rule) => {
      const a = rule.pathogenA.toLowerCase();
      const b = rule.pathogenB.toLowerCase();
      return (
        (a === normalizedA.toLowerCase() && b === normalizedB.toLowerCase()) ||
        (a === normalizedB.toLowerCase() && b === normalizedA.toLowerCase())
      );
    });

    if (duplicate) {
      setError("This pathogen pair already exists.");
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

      await addDoc(collection(firestore, "pathogen_rules"), {
        pathogenA: normalizedA,
        pathogenB: normalizedB,
        createdAt: serverTimestamp()
      });
      await addAuditEntry("Add Rule", `${normalizedA} vs ${normalizedB}`);
      setPathogenA("");
      setPathogenB("");
    } catch (submitError) {
      console.warn(submitError);
      setError(getFirebaseErrorMessage(submitError, "Unable to add pathogen rule."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeRule = async (ruleId: string, label: string) => {
    try {
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      await deleteDoc(doc(firestore, "pathogen_rules", ruleId));
      await addAuditEntry("Delete Rule", label);
    } catch (deleteError) {
      console.warn(deleteError);
      setError(getFirebaseErrorMessage(deleteError, "Unable to delete rule. Try again."));
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">Add Compatibility Rule</h3>
        <p className="mt-1 text-sm text-slate-500">Prevent unsafe pathogen pairings before activity logs are saved.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Pathogen A
            <input
              value={pathogenA}
              onChange={(event) => setPathogenA(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Listeria"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Pathogen B
            <input
              value={pathogenB}
              onChange={(event) => setPathogenB(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="E.coli"
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
            {isSubmitting ? "Saving..." : "Add Rule"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Existing Rules</h3>
        <p className="mt-1 text-sm text-slate-500">Review and remove incompatible pathogen pairings.</p>
        <ul className="mt-4 space-y-3">
          {rules.length === 0 && <li className="text-sm text-slate-500">No rules configured yet.</li>}
          {rules.map((rule) => {
            const label = `${rule.pathogenA} / ${rule.pathogenB}`;
            return (
              <li key={rule.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  {rule.createdAt && (
                    <p className="text-xs text-slate-500">
                      Added on {rule.createdAt.toDate().toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id, label)}
                  className="inline-flex items-center rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
