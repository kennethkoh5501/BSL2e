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
import { exportToCSV } from "@/utils/exportToCSV";
import { formatTimestamp } from "@/utils/formatTimestamp";

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

export default function DataExport() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [ppeLogs, setPpeLogs] = useState<PpeLog[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
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
    const unsubscribeSessions = onSnapshot(sessionQuery, (snapshot) => {
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
    });

    const activityQuery = query(collection(firestore, "bsl2e_logs"), orderBy("timestamp", "desc"));
    const unsubscribeActivities = onSnapshot(activityQuery, (snapshot) => {
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
    });

    const ppeQuery = query(collection(firestore, "ppe_logs"), orderBy("timestamp", "desc"));
    const unsubscribePpe = onSnapshot(ppeQuery, (snapshot) => {
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
      setPpeLogs(data);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeActivities();
      unsubscribePpe();
    };
  }, [firestore, firebaseInitError]);

  const users = useMemo(() => Array.from(new Set(sessions.map((session) => session.userName))), [sessions]);
  const labs = useMemo(() => Array.from(new Set(sessions.map((session) => session.lab))), [sessions]);

  const startMillis = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
  const endMillis = endDate ? new Date(endDate).getTime() + 86400000 : Number.POSITIVE_INFINITY;

  const getSessionWindow = (session: SessionRecord) => {
    const start = session.clockIn instanceof Timestamp ? session.clockIn.toMillis() : Number.NEGATIVE_INFINITY;
    const end = session.clockOut instanceof Timestamp ? session.clockOut.toMillis() : Number.POSITIVE_INFINITY;
    return [start, end] as const;
  };

  const isWithinRange = (timestamp: Timestamp | null, start: number, end: number) => {
    if (!(timestamp instanceof Timestamp)) {
      return false;
    }
    const value = timestamp.toMillis();
    return value >= start && value <= end;
  };

  const uniqueById = <T extends { id: string }>(items: T[]) =>
    Array.from(new Map(items.map((item) => [item.id, item])).values());

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const clockInTime = session.clockIn instanceof Timestamp ? session.clockIn.toMillis() : Number.NEGATIVE_INFINITY;
      const matchesDate = clockInTime >= startMillis && clockInTime <= endMillis;
      const matchesUser = userFilter ? session.userName === userFilter : true;
      const matchesLab = labFilter ? session.lab === labFilter : true;
      return matchesDate && matchesUser && matchesLab;
    });
  }, [sessions, startMillis, endMillis, userFilter, labFilter]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (!(activity.timestamp instanceof Timestamp)) {
        return false;
      }
      const time = activity.timestamp.toMillis();
      const matchesDate = time >= startMillis && time <= endMillis;
      const matchesUser = userFilter ? activity.userName === userFilter : true;
      return matchesDate && matchesUser;
    });
  }, [activities, startMillis, endMillis, userFilter]);

  const filteredPpe = useMemo(() => {
    return ppeLogs.filter((log) => {
      if (!(log.timestamp instanceof Timestamp)) {
        return false;
      }
      const time = log.timestamp.toMillis();
      const matchesDate = time >= startMillis && time <= endMillis;
      const matchesUser = userFilter ? log.userName === userFilter : true;
      return matchesDate && matchesUser;
    });
  }, [ppeLogs, startMillis, endMillis, userFilter]);

  const exportRows = useMemo(() => {
    return filteredSessions.map((session) => {
      const [windowStart, windowEnd] = getSessionWindow(session);

      const sessionActivities = uniqueById(
        filteredActivities.filter((activity) => {
          if (!(activity.timestamp instanceof Timestamp)) {
            return false;
          }
          const matchesRef = activity.sessionRef?.id === session.id;
          const matchesUserWindow =
            activity.userName === session.userName &&
            isWithinRange(activity.timestamp, windowStart, windowEnd);
          return matchesRef || matchesUserWindow;
        })
      );

      const sessionPpe = uniqueById(
        filteredPpe.filter((log) =>
          log.userName === session.userName && isWithinRange(log.timestamp, windowStart, windowEnd)
        )
      );

      return {
        SessionID: session.id,
        User: session.userName,
        Lab: session.lab,
        Purpose: session.purpose,
        ClockIn: formatTimestamp(session.clockIn),
        ClockOut: session.clockOut ? formatTimestamp(session.clockOut) : "Active",
        Activities: sessionActivities.map((activity) => activity.activity).join(" | "),
        Pathogens: sessionActivities.map((activity) => activity.pathogens.join(", ")).join(" | "),
        PPE: sessionPpe.map((log) => `${log.itemName} x${log.quantity}`).join(" | ")
      };
    });
  }, [filteredSessions, filteredActivities, filteredPpe]);

  const handleExport = () => {
    if (exportRows.length === 0) {
      alert("No data matches the selected filters.");
      return;
    }
    exportToCSV(`labwatch-export-${Date.now()}.csv`, exportRows);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Data Export</h3>
          <p className="mt-1 text-sm text-slate-500">Download combined session, activity, and PPE usage data.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90"
        >
          Export CSV
        </button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Start Date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          End Date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          User
          <select
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
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
            value={labFilter}
            onChange={(event) => setLabFilter(event.target.value)}
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
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p>
          {exportRows.length} session rows ready for export. Activities and PPE usage are aggregated per session to build a complete
          compliance trail.
        </p>
      </div>
    </div>
  );
}
