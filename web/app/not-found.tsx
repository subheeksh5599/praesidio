import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">That route does not exist.</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Back to PRAESIDIO
      </Link>
    </main>
  );
}
