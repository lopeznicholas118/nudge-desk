import "server-only";
import type {Json} from "@nudge/db";
import {decryptSecret, encryptSecret} from "@/lib/crypto";
import {serverEnv} from "@/lib/env.server";
import {createAdminClient} from "@/lib/supabase/admin";
import {createOAuthClient} from "./oauth";

const encryptionKey = () => Buffer.from(serverEnv().TOKEN_ENCRYPTION_KEY, "base64");

export class GoogleConnectionError extends Error {
  reason: "not_connected" | "needs_reauth";
  constructor(reason: "not_connected" | "needs_reauth") {
    super(reason);
    this.reason = reason;
  }
}

export async function saveConnection(input: {
  userId: string;
  googleEmail: string;
  scopes: string[];
  refreshToken: string;
}) {
  const {error} = await createAdminClient()
    .from("google_connections")
    .upsert(
      {
        user_id: input.userId,
        google_email: input.googleEmail,
        scopes: input.scopes,
        refresh_token_encrypted: encryptSecret(input.refreshToken, encryptionKey()),
        status: "active",
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/** Never selects the token column. Safe to render. */
export async function getConnectionStatus(userId: string) {
  const {data, error} = await createAdminClient()
    .from("google_connections")
    .select("google_email, status, last_synced_at, last_sync_summary")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAuthorizedClient(userId: string) {
  const { data, error } = await createAdminClient()
    .from("google_connections")
    .select("refresh_token_encrypted, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GoogleConnectionError("not_connected");
  if (data.status !== "active") throw new GoogleConnectionError("needs_reauth");

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: decryptSecret(data.refresh_token_encrypted, encryptionKey()) });
  return client;
}

export async function markNeedsReauth(userId: string) {
  const {error} = await createAdminClient()
    .from("google_connections")
    .update({ status: "needs_reauth" })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function recordSync(userId: string, summary: Json) {
  const {error} = await createAdminClient()
    .from("google_connections")
    .update({ last_synced_at: new Date().toISOString(), last_sync_summary: summary, status: "active" })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function disconnectConnection(userId: string) {
  const admin = createAdminClient();
  const {data} = await admin
    .from("google_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    try {
      await createOAuthClient().revokeToken(decryptSecret(data.refresh_token_encrypted, encryptionKey()));
    } catch {
      // Already revoked or expired. Still remove our copy.
    }
  }
  const {error} = await admin.from("google_connections").delete().eq("user_id", userId);
  if (error) throw error;
}