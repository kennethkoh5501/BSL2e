import { Timestamp } from "firebase/firestore";

export function formatTimestamp(value?: Timestamp | null): string {
  if (!value) {
    return "–";
  }

  const date = value instanceof Timestamp ? value.toDate() : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
