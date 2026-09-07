import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, passcodeIsConfigured, sessionIsValid } from "@/lib/auth";

/**
 * Everything behind the passcode, except the door itself.
 *
 * `/api` is deliberately not gated. Those routes carry their own credentials
 * — the Telegram webhook checks its secret header, the reminders cron checks
 * CRON_SECRET — and neither caller can present a browser cookie. Gating them
 * here would silently break the bot and the daily reminder.
 */
export async function middleware(request: NextRequest) {
  if (!passcodeIsConfigured()) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await sessionIsValid(token)) return NextResponse.next();

  const unlock = new URL("/unlock", request.url);

  // Come back to where they were headed. Path and query only: a full URL
  // here would be an open redirect.
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next !== "/" && !next.startsWith("/unlock")) unlock.searchParams.set("next", next);

  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   api          — authenticates itself, see above
     *   unlock       — the passcode screen
     *   _next/*      — build output
     *   *.png etc.   — icons and other public files
     */
    "/((?!api|unlock|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)",
  ],
};
