import {createClient, type SupabaseClient, type SupabaseClientOptions} from "@supabase/supabase-js";
import type {Database} from "./database.types";

export type {Database, Json} from "./database.types";
export type DbClient = SupabaseClient<Database>;

type PublicSchema = Database["public"];
export type Row<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Insert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];

export function createDbClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">,
): DbClient {
  return createClient<Database>(url, key, options);
}
