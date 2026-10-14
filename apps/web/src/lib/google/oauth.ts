import "server-only";
import {OAuth2Client} from "google-auth-library";
import {serverEnv} from "@/lib/env.server";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_SCOPES = ["openid", "email", CALENDAR_SCOPE];
export const STATE_COOKIE = "google_oauth_state";

export function createOAuthClient() {
  const env = serverEnv();
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}