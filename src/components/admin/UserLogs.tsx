"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocumentReference } from "firebase/firestore";
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

interface SessionRecord {
  id: string;
  userName: string;
  lab: string;
  purpose: string;
  clockIn: Timestamp | null;
  clockOut: Timestamp | null;
}

interface ActivityLog {
  id: string;
  userName: string;
  activity: string;
  pathogens: string[];
  timestamp: Timestamp | null;
  sessionRef?: DocumentReference;
}

interface PpeLog {
  id: string;
  userName: string;
  itemName: string;
  quantity: number;
  timestamp: Timestamp | null;
}

export default function UserLogs() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [ppe, setPpe] = useState<PpeLog[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLab, setSelectedLab] = useState("");
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );

  useEffect(() => {
    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is not configured. Update your Firebase environment variables."
      );
      return;
    }

    setError(null);
    const sessionQuery = query(collection(firestore, "sessions"), orderBy("clockIn", "desc"));
    const unsubscribeSessions = onSnapshot(
      sessionQuery,
      (snapshot) => {
        const data = snapshot.docs.map((snapshotDoc) => {
          const raw = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            userName: typeof raw.userName === "string" ? raw.userName : "",
            lab: typeof raw.lab === "string" ? raw.lab : "",
            purpose: typeof raw.purpose === "string" ? raw.purpose : "",
            clockIn: raw.clockIn instanceof Timestamp ? raw.clockIn : null,
            clockOut: raw.clockOut instanceof Timestamp ? raw.clockOut : null
          } satisfies SessionRecord;
        });
        setSessions(data);
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load session data. Check Firestore permissions."
          )
        );
      }
    );

    const activityQuery = query(collection(firestore, "bsl2e_logs"), orderBy("timestamp", "desc"));
    const unsubscribeActivities = onSnapshot(
      activityQuery,
      (snapshot) => {
        const data = snapshot.docs.map((snapshotDoc) => {
          const raw = snapshotDoc.data();
          const sessionRef =
            raw.sessionRef && typeof raw.sessionRef === "object" && "id" in raw.sessionRef
              ? (raw.sessionRef as DocumentReference)
              : undefined;

          return {
            id: snapshotDoc.id,
            userName: typeof raw.userName === "string" ? raw.userName : "",
            activity: typeof raw.activity === "string" ? raw.activity : "",
            pathogens: Array.isArray(raw.pathogens)
              ? raw.pathogens.filter((item): item is string => typeof item === "string")
              : [],
            timestamp: raw.timestamp instanceof Timestamp ? raw.timestamp : null,
            sessionRef
          } satisfies ActivityLog;
        });
        setActivities(data);
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load activity logs. Check Firestore permissions."
          )
        );
      }
    );

    const ppeQuery = query(collection(firestore, "ppe_logs"), orderBy("timestamp", "desc"));
    const unsubscribePpe = onSnapshot(
      ppeQuery,
      (snapshot) => {
        const data = snapshot.docs.map((snapshotDoc) => {
          const raw = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            userName: typeof raw.userName === "string" ? raw.userName : "",
            itemName: typeof raw.itemName === "string" ? raw.itemName : "",
            quantity: typeof raw.quantity === "number" ? raw.quantity : 0,
            timestamp: raw.timestamp instanceof Timestamp ? raw.timestamp : null
          } satisfies PpeLog;
        });
        setPpe(data);
      },
      (snapshotError) => {
        console.warn(snapshotError);
        setError(
          getFirebaseErrorMessage(
            snapshotError,
            "Unable to load PPE logs. Check Firestore permissions."
          )
        );
      }
    );

    return () => {
      unsubscribeSessions();
      unsubscribeActivities();
      unsubscribePpe();
    };
  }, [firestore, firebaseInitError]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesUser = selectedUser ? session.userName === selectedUser : true;
      const matchesLab = selectedLab ? session.lab === selectedLab : true;
      return matchesUser && matchesLab;
    });
  }, [sessions, selectedUser, selectedLab]);

  const users = useMemo(() => Array.from(new Set(sessions.map((session) => session.userName))), [sessions]);
  const labs = useMemo(() => Array.from(new Set(sessions.map((session) => session.lab))), [sessions]);

  const activitiesByKey = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of activities) {
      const keys = [log.sessionRef?.id, log.userName].filter(Boolean) as string[];
      for (const key of keys) {
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(log);
      }
    }
    return map;
  }, [activities]);

  const ppeByUser = useMemo(() => {
    const map = new Map<string, PpeLog[]>();
    for (const log of ppe) {
      if (!map.has(log.userName)) {
        map.set(log.userName, []);
      }
      map.get(log.userName)!.push(log);
    }
    return map;
  }, [ppe]);

  const gatherLogs = <T extends { id: string }>(keys: (string | undefined)[], map: Map<string, T[]>) => {
    const seen = new Set<string>();
    const results: T[] = [];
    for (const key of keys) {
      if (!key) continue;
      const items = map.get(key) ?? [];
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        results.push(item);
      }
    }
    return results;
  };

  const getSessionWindow = (session: SessionRecord) => {
    const start = session.clockIn instanceof Timestamp ? session.clockIn.toMillis() : Number.NEGATIVE_INFINITY;
    const end = session.clockOut instanceof Timestamp ? session.clockOut.toMillis() : Number.POSITIVE_INFINITY;
    return [start, end] as const;
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            User
            <select
              value={selectedUser}
              onChange={(event) => setSelectedUser(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Lab
            <select
              value={selectedLab}
              onChange={(event) => setSelectedLab(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All labs</option>
              {labs.map((lab) => (
                <option key={lab} value={lab}>
                  {lab}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        {filteredSessions.length === 0 && (
          <p className="text-sm text-slate-500">No sessions match the current filters.</p>
        )}
        {filteredSessions.map((session) => {
          const [sessionStart, sessionEnd] = getSessionWindow(session);
          const relatedActivities = gatherLogs([session.id, session.userName], activitiesByKey).filter((activity) => {
            if (!(activity.timestamp instanceof Timestamp)) {
              return false;
            }
            const activityTime = activity.timestamp.toMillis();
            return activityTime >= sessionStart && activityTime <= sessionEnd;
          });
          const relatedPpe = gatherLogs([session.userName], ppeByUser).filter((log) => {
            if (!(log.timestamp instanceof Timestamp)) {
              return false;
            }
            const logTime = log.timestamp.toMillis();
            return logTime >= sessionStart && logTime <= sessionEnd;
          });

          return (
            <details key={session.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open>
              <summary className="flex cursor-pointer flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{session.userName}</p>
                  <p className="text-xs text-slate-500">
                    {session.lab} · {formatTimestamp(session.clockIn)}
                  </p>
                  <p className="text-xs text-slate-500">Purpose: {session.purpose}</p>
                  <p className="text-xs text-slate-500">
                    Status: {session.clockOut ? `Clocked out at ${formatTimestamp(session.clockOut)}` : "Active"}
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-primary">
                  {relatedActivities.length} activities · {relatedPpe.length} PPE logs
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Activities</h4>
                  <ul className="mt-2 space-y-2">
                    {relatedActivities.length === 0 && (
                      <li className="text-xs text-slate-500">No activities recorded.</li>
                    )}
                    {relatedActivities.map((activity) => (
                      <li key={activity.id} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{activity.activity}</p>
                        <p>Pathogens: {activity.pathogens.join(", ") || "NIL"}</p>
                        <p>Logged: {formatTimestamp(activity.timestamp)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">PPE Usage</h4>
                  <ul className="mt-2 space-y-2">
                    {relatedPpe.length === 0 && (
                      <li className="text-xs text-slate-500">No PPE usage recorded.</li>
                    )}
                    {relatedPpe.map((log) => (
                      <li key={log.id} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{log.itemName}</p>
                        <p>Quantity: {log.quantity}</p>
                        <p>Logged: {formatTimestamp(log.timestamp)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
