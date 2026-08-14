"use client";

// Error boundary for the console. A chain read failure or a crash renders a
// recoverable state instead of a blank screen.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-16 max-w-xl p-6 text-center">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">
        The console hit an unexpected error. Retry the read.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}
