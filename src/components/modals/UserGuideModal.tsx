"use client";

interface UserGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ open, onClose }: UserGuideModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Welcome to LabWatch</h2>
        <p className="mt-2 text-sm text-slate-600">
          This quick guide will help you decide which workflow to use.
        </p>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li>
            <strong>Clock In</strong> – Log your entry into the BSL2e suite before donning PPE.
          </li>
          <li>
            <strong>BSL2e Log</strong> – Document your activity and pathogens. Enter "NIL" for maintenance work.
          </li>
          <li>
            <strong>PPE Log</strong> – Record PPE collected from Lab Store 2 for ante room restocking.
          </li>
          <li>
            <strong>Reminder</strong> – Book your session in PPMS prior to lab work.
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
