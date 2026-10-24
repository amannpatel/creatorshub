import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canSignUp } from "@/server/actions/auth";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

function safeNext(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : undefined;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getCurrentUser()) redirect("/");
  const params = await searchParams;
  const signupOpen = await canSignUp();
  return (
    <>
      <AuthForm mode="login" next={safeNext(params.next)} />
      {signupOpen && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          First time here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create your account
          </Link>
        </p>
      )}
    </>
  );
}
