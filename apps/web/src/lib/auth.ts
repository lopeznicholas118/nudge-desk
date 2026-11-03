import "server-only";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

/** The signed-in user and a Supabase client acting as them (RLS applies), or a redirect to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return {supabase, user};
}