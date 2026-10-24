"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

/** Runs a server action inside a transition and reports the result with a toast. */
export function useServerAction() {
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: { success?: string; onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void; onError?: (result: Extract<ActionResult<T>, { ok: false }>) => void } = {},
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (opts.success) toast.success(opts.success);
          opts.onSuccess?.(result as Extract<ActionResult<T>, { ok: true }>);
        } else {
          if (opts.onError) opts.onError(result);
          else toast.error(result.error);
        }
      } catch (err) {
        // Redirects (e.g. expired session) are thrown as special errors and must propagate.
        if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
        toast.error("Network error — please try again.");
      }
    });
  }

  return { pending, run };
}
