import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/token";

const PUBLIC_PATHS = ["/login", "/signup", "/api/health"];

/**
 * Optimistic auth check only (signature + expiry). Real authorization happens in the data access
 * layer, which re-validates the session against the database on every request and server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt).*)"],
};
