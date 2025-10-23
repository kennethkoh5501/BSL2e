import { FirebaseError } from "firebase/app";

export function getFirebaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "permission-denied":
        return "Permission denied. Check Firebase credentials and Firestore security rules.";
      case "not-found":
        return "Requested Firestore document was not found.";
      case "unauthenticated":
        return "You must be signed in or have public access enabled to perform this action.";
      case "unavailable":
        return "Firestore service is currently unavailable. Please try again.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
