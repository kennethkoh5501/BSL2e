import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-slate-700">
      <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm">
        The page you are looking for does not exist. Use the navigation or return to the
        dashboard to continue working in LabWatch.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
