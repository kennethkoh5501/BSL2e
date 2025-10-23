"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

interface SessionRecord {
  id: string;
  userName: string;
  clockOut: Timestamp | null;
}

interface PathogenRule {
  id: string;
  pathogenA: string;
  pathogenB: string;
}

export default function Bsl2eForm() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [rules, setRules] = useState<PathogenRule[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [activity, setActivity] = useState("");
  const [pathogenInput, setPathogenInput] = useState("");
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is not configured. Update your Firebase environment variables."
      );
      return;
    }

    setError(null);
    const sessionQuery = query(collection(firestore, "sessions"), where("clockOut", "==", null));
    const unsubscribeSessions = onSnapshot(sessionQuery, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => {
        const raw = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          userName: typeof raw.userName === "string" ? raw.userName : "",
          clockOut: raw.clockOut instanceof Timestamp ? raw.clockOut : null
        } satisfies SessionRecord;
      });
      setSessions(data.filter((session) => session.userName));
    });

    const rulesRef = collection(firestore, "pathogen_rules");
    const unsubscribeRules = onSnapshot(rulesRef, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => {
        const raw = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          pathogenA: typeof raw.pathogenA === "string" ? raw.pathogenA : "",
          pathogenB: typeof raw.pathogenB === "string" ? raw.pathogenB : ""
        } satisfies PathogenRule;
      });
      setRules(data.filter((rule) => rule.pathogenA && rule.pathogenB));
    });

    return () => {
      unsubscribeSessions();
      unsubscribeRules();
    };
  }, [firestore, firebaseInitError]);

  const pathogenList = useMemo(
    () =>
      pathogenInput
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [pathogenInput]
  );

  const incompatibleRule = useMemo(() => {
    const normalized = pathogenList.map((name) => name.toLowerCase());
    for (const rule of rules) {
      const a = rule.pathogenA.toLowerCase();
      const b = rule.pathogenB.toLowerCase();
      if (normalized.includes(a) && normalized.includes(b)) {
        return rule;
      }
    }
    return null;
  }, [rules, pathogenList]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedSession) {
      setError("Please select an active user session.");
      return;
    }

    if (!activity) {
      setError("Provide an activity description.");
      return;
    }

    if (incompatibleRule) {
      setError(
        `Incompatible pathogen pair detected: ${incompatibleRule.pathogenA} and ${incompatibleRule.pathogenB}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      const sessionRef = doc(firestore, "sessions", selectedSession);
      await addDoc(collection(firestore, "bsl2e_logs"), {
        userName:
          sessions.find((session) => session.id === selectedSession)?.userName ?? "Unknown",
        activity,
        pathogens: pathogenList,
        sessionRef,
        timestamp: serverTimestamp()
      });

      setActivity("");
      setPathogenInput("");
      setSuccessMessage("BSL2e activity recorded successfully.");
    } catch (submitError) {
      console.warn(submitError);
      setError(getFirebaseErrorMessage(submitError, "Unable to record activity. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">BSL2e Activity Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record detailed activity information and perform pathogen compatibility checks.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-5">
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Active User
          <select
            value={selectedSession}
            onChange={(event) => setSelectedSession(event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Select user...</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.userName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Activity Description
          <textarea
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            className="mt-1 min-h-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="Describe the work being performed..."
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Pathogens Used
          <input
            value={pathogenInput}
            onChange={(event) => setPathogenInput(event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder="Comma-separated list (e.g. E.coli, Listeria)"
          />
        </label>
        {incompatibleRule && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Submission blocked: {incompatibleRule.pathogenA} is incompatible with {incompatibleRule.pathogenB}.
          </div>
        )}
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {successMessage && <p className="mt-4 text-sm text-green-600">{successMessage}</p>}
      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
        >
          {submitting ? "Saving..." : "Submit Log"}
        </button>
      </div>
    </form>
  );
}
