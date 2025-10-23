import { unparse } from "papaparse";

type Row = Record<string, string | number | null | undefined>;

export function exportToCSV(filename: string, data: Row[]) {
  const csv = unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
