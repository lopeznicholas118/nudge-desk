import {randomBytes} from "node:crypto";
import {NextResponse, type NextRequest} from "next/server";
import {createOAuthClient, GOOGLE_SCOPES} from "@/lib/google/oauth";
import {createClient} from "@/lib/supabase/server";
import {STATE_COOKIE} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomBytes(32).toString("hex");
  const url = createOAuthClient().generateAuthUrl({
    access_type: "offline", // we need a refresh token
    prompt: "consent",      // ...and this guarantees Google issues one
    scope: GOOGLE_SCOPES,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/google",
  });
  return response;
}