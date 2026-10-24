import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-accent/40 to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <p className="text-lg font-semibold tracking-tight">CreatorsHub</p>
          <p className="text-sm text-muted-foreground">Every collaboration, deadline and payment — in one place.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
