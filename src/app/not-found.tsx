import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <SearchX className="mb-3 size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">This page or record doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="mt-4 text-sm font-medium text-primary hover:underline">
        Back to dashboard
      </Link>
    </main>
  );
}
