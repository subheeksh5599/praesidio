import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">That route does not exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Back to PRAESIDIO
      </Link>
    </main>
  );
}
