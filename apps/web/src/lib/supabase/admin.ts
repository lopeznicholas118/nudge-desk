import "server-only";
import {createClient} from "@supabase/supabase-js";
import type {Database} from "@nudge/db";
import {publicEnv} from "@/lib/env";
import {serverEnv} from "@/lib/env.server";

/**
 * Service-role client: BYPASSES RLS. Only for server code that must act without
 * the user's session (credential storage, later the cron job). Every query made with
 * it must filter by user_id explicitly.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
}