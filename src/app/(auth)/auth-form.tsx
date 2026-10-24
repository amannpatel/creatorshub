"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, signup } from "@/server/actions/auth";
import { useServerAction } from "@/components/use-server-action";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    setError(null);
    run(() => (mode === "login" ? login(payload) : signup(payload)), {
      onSuccess: () => {
        router.replace(next ?? "/");
        router.refresh();
      },
      onError: (r) => setError(r.error),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 10 : 1}
          maxLength={128}
        />
        {mode === "signup" && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
