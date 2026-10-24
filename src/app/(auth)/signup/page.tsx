import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canSignUp } from "@/server/actions/auth";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  const open = await canSignUp();
  if (!open) {
    return (
      <div className="rounded-xl border bg-card p-5 text-center text-sm">
        <p className="font-medium">Sign-ups are closed</p>
        <p className="mt-1 text-muted-foreground">This workspace already has an owner.</p>
        <Link href="/login" className="mt-4 inline-block font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <AuthForm mode="signup" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
