"use client";

import type { PointerEvent as ReactPointerEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { getFirebaseInitializationError, getFirestoreDb } from "@/lib/firebase";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { getFirebaseErrorMessage } from "@/utils/getFirebaseErrorMessage";

type Session = {
  id: string;
  userName: string;
  lab: string;
  purpose: string;
  signatureUrl: string;
  clockIn: Timestamp | null;
  clockOut: Timestamp | null;
};

export default function ClockInForm() {
  const firestore = getFirestoreDb();
  const firebaseInitError = getFirebaseInitializationError();
  const [userName, setUserName] = useState("");
  const [lab, setLab] = useState("");
  const [purpose, setPurpose] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    firebaseInitError ? firebaseInitError.message : null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!firestore) {
      setError(
        firebaseInitError?.message ??
          "Firestore is not configured. Update your Firebase environment variables."
      );
      return;
    }

    setError(null);
    const sessionsRef = collection(firestore, "sessions");
    const activeQuery = query(sessionsRef, where("clockOut", "==", null));
    const unsubscribe = onSnapshot(activeQuery, (snapshot) => {
      const data = snapshot.docs.map((snapshotDoc) => {
        const raw = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          userName: typeof raw.userName === "string" ? raw.userName : "",
          lab: typeof raw.lab === "string" ? raw.lab : "",
          purpose: typeof raw.purpose === "string" ? raw.purpose : "",
          signatureUrl:
            typeof raw.signatureUrl === "string" ? raw.signatureUrl : "",
          clockIn: raw.clockIn instanceof Timestamp ? raw.clockIn : null,
          clockOut: raw.clockOut instanceof Timestamp ? raw.clockOut : null
        } satisfies Session;
      });
      setSessions(data);
    });
    return () => unsubscribe();
  }, [firestore, firebaseInitError]);

  const isCanvasBlank = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return true;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 0) {
        return false;
      }
    }
    return true;
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.beginPath();
    context?.moveTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (context) {
      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = "#111827";
      context.lineTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.closePath();
    drawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedUserName = userName.trim();
    const normalizedLab = lab.trim();
    const normalizedPurpose = purpose.trim();

    if (!normalizedUserName || !normalizedLab || !normalizedPurpose) {
      setError("Please complete all fields.");
      return;
    }

    const duplicate = sessions.some(
      (session) => session.userName.trim().toLowerCase() === normalizedUserName.toLowerCase()
    );

    if (duplicate) {
      setError("User already has an active session. Please clock out first.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Signature pad unavailable.");
      return;
    }

    if (isCanvasBlank(canvas)) {
      setError("Please provide a digital signature.");
      return;
    }

    const signatureUrl = canvas.toDataURL("image/png");

    try {
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      setSubmitting(true);
      await addDoc(collection(firestore, "sessions"), {
        userName: normalizedUserName,
        lab: normalizedLab,
        purpose: normalizedPurpose,
        signatureUrl,
        clockIn: serverTimestamp(),
        clockOut: null
      });
      setUserName("");
      setLab("");
      setPurpose("");
      clearSignature();
    } catch (submitError) {
      console.warn(submitError);
      setError(getFirebaseErrorMessage(submitError, "Unable to clock in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async (sessionId: string) => {
    try {
      if (!firestore) {
        setError(
          firebaseInitError?.message ??
            "Firestore is unavailable. Check your Firebase credentials."
        );
        return;
      }

      await updateDoc(doc(firestore, "sessions", sessionId), {
        clockOut: serverTimestamp()
      });
    } catch (clockOutError) {
      console.warn(clockOutError);
      setError(getFirebaseErrorMessage(clockOutError, "Unable to clock out. Please try again."));
    }
  };

  const canvasSize = 320;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Clock In</h2>
        <p className="mt-1 text-sm text-slate-500">
          Record your entry to the BSL2e suite. All fields are required.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Full Name
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Jane Doe"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Lab / Suite
            <input
              value={lab}
              onChange={(event) => setLab(event.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="BSL2e-8"
              required
            />
          </label>
          <label className="md:col-span-2 flex flex-col text-sm font-medium text-slate-700">
            Purpose of Visit
            <textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              className="mt-1 min-h-[96px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Media prep, decontamination, equipment maintenance..."
              required
            />
          </label>
          <div className="md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Digital Signature</span>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end">
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize / 1.6}
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
              <button
                type="button"
                onClick={clearSignature}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear Signature
              </button>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
          >
            {submitting ? "Saving..." : "Clock In"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Active Sessions</h3>
        <p className="mt-1 text-sm text-slate-500">Clock out users when they exit the lab.</p>
        <ul className="mt-4 space-y-3">
          {sessions.length === 0 && <li className="text-sm text-slate-500">No active sessions.</li>}
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">{session.userName}</p>
                <p className="text-xs text-slate-500">{session.lab}</p>
                <p className="text-xs text-slate-400">
                  Clocked in: {formatTimestamp(session.clockIn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleClockOut(session.id)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow hover:bg-slate-700"
              >
                Clock Out
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
