import {NextResponse, type NextRequest} from "next/server";
import {saveConnection} from "@/lib/google/connection";
import {CALENDAR_SCOPE, createOAuthClient} from "@/lib/google/oauth";
import {serverEnv} from "@/lib/env.server";
import {createClient} from "@/lib/supabase/server";
import {STATE_COOKIE} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const done = (code: string) => {
    const response = NextResponse.redirect(new URL(`/dashboard?google=${code}`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return response;
  };

  // CSRF protection: the state we issued must come back unchanged.
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  const state = params.get("state");
  if (!expected || !state || expected !== state) return done("state_mismatch");
  if (params.get("error")) return done("denied");
  const code = params.get("code");
  if (!code) return done("error");

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const oauth = createOAuthClient();
    const {tokens} = await oauth.getToken(code);

    // Users can untick individual permissions on Google's consent screen.
    const granted = (tokens.scope ?? "").split(" ").filter(Boolean);
    if (!granted.includes(CALENDAR_SCOPE)) return done("missing_scope");
    if (!tokens.refresh_token || !tokens.id_token) return done("error");

    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: serverEnv().GOOGLE_CLIENT_ID,
    });
    const googleEmail = ticket.getPayload()?.email;
    if (!googleEmail) return done("error");

    await saveConnection({
      userId: user.id,
      googleEmail,
      scopes: granted,
      refreshToken: tokens.refresh_token,
    });
    return done("connected");
  } catch (err) {
    // Log only the message: Google client errors can embed the request body (with secrets).
    console.error("google callback failed:", err instanceof Error ? err.message : "unknown error");
    return done("error");
  }
}