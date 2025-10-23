import { Timestamp } from "firebase/firestore";

type SupportedTimestamp = Timestamp | Date | null | undefined;

export function formatTimestamp(value?: SupportedTimestamp): string {
  if (!value) {
    return "–";
  }

  let date: Date | null = null;

  if (value instanceof Timestamp) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "–";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
