"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <main className="flex flex-col w-full max-w-[480px] mx-auto min-h-dvh items-center justify-center px-6 text-center">
      <h2 className="text-base font-semibold text-[var(--foreground)]">
        Something went sideways.
      </h2>
      <p className="text-sm text-[var(--muted)] mt-1.5 max-w-sm">
        Sorry — give it another try, or call us at{" "}
        <a className="underline" href="tel:+18015550142">
          (801) 555-0142
        </a>
        .
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
