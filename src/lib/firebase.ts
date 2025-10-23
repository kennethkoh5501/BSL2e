import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import { initializeApp, getApps } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let initializationError: Error | null = null;

function ensureFirebaseApp() {
  if (app || initializationError) {
    return { app, firestore, initializationError };
  }

  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    const message =
      `Missing Firebase configuration values for: ${missingKeys.join(", ")}. ` +
      "Populate the NEXT_PUBLIC_FIREBASE_* variables in your .env.local file.";

    initializationError = new Error(message);

    if (typeof console !== "undefined") {
      console.error(message);
    }

    return { app, firestore, initializationError };
  }

  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  firestore = getFirestore(app);

  return { app, firestore, initializationError };
}

export function getFirestoreDb(): Firestore | null {
  return ensureFirebaseApp().firestore;
}

export function getFirebaseInitializationError(): Error | null {
  return ensureFirebaseApp().initializationError;
}
