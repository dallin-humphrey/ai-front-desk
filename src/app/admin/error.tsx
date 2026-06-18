"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error boundary]", error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-base font-semibold">Admin console hit an error.</h2>
      <p className="text-sm text-[var(--muted)] mt-1.5 max-w-sm">
        Check the console for details.
      </p>
      <button
        onClick={reset}
        className="mt-4 text-sm font-medium px-4 py-2 rounded-md bg-[var(--primary)] text-white hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
